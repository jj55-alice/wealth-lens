import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// GET: 가구 내 계좌 목록
// ?owner=<user_id> → 그 사용자의 계좌만
// ?owner=all → 가구 전체 (owner 필드도 함께 반환)
// 기본값: 본인 계좌
export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: '인증 필요' }, { status: 401 });

  const { data: membership } = await supabase
    .from('household_members')
    .select('household_id')
    .eq('user_id', user.id)
    .maybeSingle();
  if (!membership) return NextResponse.json({ error: '가구 없음' }, { status: 404 });

  const url = new URL(request.url);
  const ownerParam = url.searchParams.get('owner');
  const ownerFilter = ownerParam ?? user.id;

  let query = supabase
    .from('household_accounts')
    .select('id, brokerage, alias, user_id')
    .eq('household_id', membership.household_id)
    .order('brokerage')
    .order('alias');

  if (ownerFilter !== 'all') {
    query = query.eq('user_id', ownerFilter);
  }

  const { data: accounts } = await query;
  return NextResponse.json({ accounts: accounts ?? [] });
}

// POST: 새 계좌 추가
// body: { brokerage, alias, user_id? } — user_id 미지정 시 본인
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: '인증 필요' }, { status: 401 });

  const { data: membership } = await supabase
    .from('household_members')
    .select('household_id')
    .eq('user_id', user.id)
    .maybeSingle();
  if (!membership) return NextResponse.json({ error: '가구 없음' }, { status: 404 });

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

  // user_id가 같은 가구의 멤버인지 검증
  const { data: targetMember } = await supabase
    .from('household_members')
    .select('user_id')
    .eq('household_id', membership.household_id)
    .eq('user_id', targetUserId)
    .maybeSingle();
  if (!targetMember) {
    return NextResponse.json({ error: '해당 사용자는 같은 가구 멤버가 아닙니다' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('household_accounts')
    .insert({
      household_id: membership.household_id,
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

// DELETE: ?id=xxx
export async function DELETE(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: '인증 필요' }, { status: 401 });

  const url = new URL(request.url);
  const id = url.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id 필요' }, { status: 400 });

  const { error } = await supabase.from('household_accounts').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
