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
    .select('id, brokerage, alias, user_id')
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
  const targetUserId = (body.user_id ?? user.id).toString();

  if (!brokerage || !alias) {
    return NextResponse.json({ error: '금융사와 별칭을 모두 입력해주세요' }, { status: 400 });
  }
  if (brokerage.length > 50 || alias.length > 50) {
    return NextResponse.json({ error: '50자 이내로 입력해주세요' }, { status: 400 });
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
    })
    .select('id, brokerage, alias, user_id')
    .single();

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: '이미 등록된 계좌입니다' }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ account: data });
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
