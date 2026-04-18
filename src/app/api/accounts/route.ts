import { NextResponse } from 'next/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { getSupabaseUrl, getServiceRoleKey } from '@/lib/env';

// admin client는 RLS 우회. 인증은 server client로 검증, 데이터 query는 admin이 담당.
function getAdmin() {
  return createAdminClient(getSupabaseUrl(), getServiceRoleKey());
}

async function getAuthedUserAndHousehold() {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: '인증 필요' }, { status: 401 }) };

  const admin = getAdmin();
  const { data: membership } = await admin
    .from('household_members')
    .select('household_id')
    .eq('user_id', user.id)
    .maybeSingle();
  if (!membership) return { error: NextResponse.json({ error: '가구 없음' }, { status: 404 }) };

  return { user, householdId: membership.household_id, admin };
}

// GET: 가구 내 계좌 목록
// ?owner=<user_id> → 그 사용자의 계좌만
// ?owner=all → 가구 전체 (owner 필드 포함)
// 기본값: 본인 계좌
export async function GET(request: Request) {
  const ctx = await getAuthedUserAndHousehold();
  if ('error' in ctx) return ctx.error;
  const { user, householdId, admin } = ctx;

  const url = new URL(request.url);
  const ownerParam = url.searchParams.get('owner');
  const ownerFilter = ownerParam ?? user.id;

  let query = admin
    .from('household_accounts')
    .select('id, brokerage, alias, account_type, user_id')
    .eq('household_id', householdId)
    .order('brokerage')
    .order('alias');

  if (ownerFilter !== 'all') {
    query = query.eq('user_id', ownerFilter);
  }

  const { data: accounts, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message, accounts: [] }, { status: 500 });
  }

  return NextResponse.json({ accounts: accounts ?? [] });
}

// POST: 새 계좌 추가
// body: { brokerage, alias, user_id? } — user_id 미지정 시 본인
export async function POST(request: Request) {
  const ctx = await getAuthedUserAndHousehold();
  if ('error' in ctx) return ctx.error;
  const { user, householdId, admin } = ctx;

  const body = await request.json();
  const brokerage = (body.brokerage ?? '').toString().trim();
  const alias = (body.alias ?? '').toString().trim();
  const accountType = (body.account_type ?? 'other').toString();
  const targetUserId = (body.user_id ?? user.id).toString();

  if (!brokerage || !alias) {
    return NextResponse.json({ error: '금융사와 별칭을 모두 입력해주세요' }, { status: 400 });
  }
  if (brokerage.length > 50 || alias.length > 50) {
    return NextResponse.json({ error: '50자 이내로 입력해주세요' }, { status: 400 });
  }
  const VALID_TYPES = ['pension', 'isa', 'irp', 'espp', 'other'];
  if (!VALID_TYPES.includes(accountType)) {
    return NextResponse.json({ error: '잘못된 계좌 유형입니다' }, { status: 400 });
  }

  // user_id가 같은 가구의 멤버인지 검증 (security)
  const { data: targetMember } = await admin
    .from('household_members')
    .select('user_id')
    .eq('household_id', householdId)
    .eq('user_id', targetUserId)
    .maybeSingle();
  if (!targetMember) {
    return NextResponse.json({ error: '해당 사용자는 같은 가구 멤버가 아닙니다' }, { status: 400 });
  }

  const { data, error } = await admin
    .from('household_accounts')
    .insert({
      household_id: householdId,
      user_id: targetUserId,
      brokerage,
      alias,
      account_type: accountType,
    })
    .select('id, brokerage, alias, account_type, user_id')
    .single();

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: '이미 등록된 계좌입니다' }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ account: data });
}

// PATCH: ?id=xxx — 계좌 수정 (brokerage/alias/account_type).
// body: { brokerage?, alias?, account_type? } — 제공된 필드만 업데이트.
// 매칭되는 기존 자산의 brokerage/account_alias/subcategory 도 동시에 동기화
// (계좌는 assets 와 FK 없이 텍스트 매칭이라 수동 sync 필요).
export async function PATCH(request: Request) {
  const ctx = await getAuthedUserAndHousehold();
  if ('error' in ctx) return ctx.error;
  const { householdId, admin } = ctx;

  const url = new URL(request.url);
  const id = url.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id 필요' }, { status: 400 });

  const body = await request.json();
  const updates: { brokerage?: string; alias?: string; account_type?: string } = {};

  if (typeof body.brokerage === 'string') {
    const v = body.brokerage.trim();
    if (!v || v.length > 50) {
      return NextResponse.json({ error: '금융사는 1-50자여야 합니다' }, { status: 400 });
    }
    updates.brokerage = v;
  }
  if (typeof body.alias === 'string') {
    const v = body.alias.trim();
    if (!v || v.length > 50) {
      return NextResponse.json({ error: '별칭은 1-50자여야 합니다' }, { status: 400 });
    }
    updates.alias = v;
  }
  if (typeof body.account_type === 'string') {
    const VALID_TYPES = ['pension', 'isa', 'irp', 'espp', 'other'];
    if (!VALID_TYPES.includes(body.account_type)) {
      return NextResponse.json({ error: '잘못된 계좌 유형입니다' }, { status: 400 });
    }
    updates.account_type = body.account_type;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: '변경할 필드가 없습니다' }, { status: 400 });
  }

  // 수정 전 원본 읽기 (자산 동기화 시 old brokerage/alias 매칭용)
  const { data: original } = await admin
    .from('household_accounts')
    .select('id, household_id, user_id, brokerage, alias, account_type')
    .eq('id', id)
    .maybeSingle();
  if (!original || original.household_id !== householdId) {
    return NextResponse.json({ error: '권한 없음' }, { status: 403 });
  }

  // 계좌 update
  const { data: updated, error: updateError } = await admin
    .from('household_accounts')
    .update(updates)
    .eq('id', id)
    .select('id, brokerage, alias, account_type, user_id')
    .single();

  if (updateError) {
    if (updateError.code === '23505') {
      return NextResponse.json({ error: '이미 같은 금융사·별칭 계좌가 있습니다' }, { status: 409 });
    }
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  // 자산 동기화: 원본 (user_id, brokerage, alias)로 매칭되는 자산의
  // brokerage/account_alias/subcategory 를 새 값으로 업데이트.
  // 매칭 튜플이 바뀌는 경우와 account_type 만 바뀌는 경우 모두 처리.
  const assetUpdates: { brokerage?: string; account_alias?: string; subcategory?: string } = {};
  if (updates.brokerage) assetUpdates.brokerage = updates.brokerage;
  if (updates.alias) assetUpdates.account_alias = updates.alias;
  if (updates.account_type) assetUpdates.subcategory = updates.account_type;

  let syncedAssets = 0;
  if (Object.keys(assetUpdates).length > 0) {
    const { data: synced, error: syncError } = await admin
      .from('assets')
      .update(assetUpdates)
      .eq('household_id', householdId)
      .eq('owner_user_id', original.user_id)
      .eq('category', 'stock')
      .eq('brokerage', original.brokerage)
      .eq('account_alias', original.alias)
      .select('id');
    if (syncError) {
      // 계좌는 이미 업데이트됨. 자산 sync 실패는 warning 으로 반환 (계좌 복구 X).
      return NextResponse.json({
        account: updated,
        syncedAssets: 0,
        warning: `자산 동기화 실패: ${syncError.message}`,
      });
    }
    syncedAssets = synced?.length ?? 0;
  }

  return NextResponse.json({ account: updated, syncedAssets });
}

// DELETE: ?id=xxx — 본인 가구의 계좌만 삭제 가능
export async function DELETE(request: Request) {
  const ctx = await getAuthedUserAndHousehold();
  if ('error' in ctx) return ctx.error;
  const { householdId, admin } = ctx;

  const url = new URL(request.url);
  const id = url.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id 필요' }, { status: 400 });

  // 같은 가구의 계좌인지 확인 (security: 다른 가구 계좌 삭제 방지)
  const { data: account } = await admin
    .from('household_accounts')
    .select('household_id')
    .eq('id', id)
    .maybeSingle();
  if (!account || account.household_id !== householdId) {
    return NextResponse.json({ error: '권한 없음' }, { status: 403 });
  }

  const { error } = await admin.from('household_accounts').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
