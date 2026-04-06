import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// GET: 목표 비율 조회
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: '인증 필요' }, { status: 401 });

  const { data: membership } = await supabase
    .from('household_members')
    .select('household_id')
    .eq('user_id', user.id)
    .maybeSingle();
  if (!membership) return NextResponse.json({ error: '가구 없음' }, { status: 404 });

  const { data: targets } = await supabase
    .from('rebalancing_targets')
    .select('asset_class, target_ratio')
    .eq('household_id', membership.household_id)
    .order('asset_class');

  return NextResponse.json({ targets: targets ?? [] });
}

// PUT: 목표 비율 저장 (전체 교체)
export async function PUT(request: Request) {
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
  const targets: { asset_class: string; target_ratio: number }[] = body.targets;

  if (!Array.isArray(targets)) {
    return NextResponse.json({ error: '잘못된 형식' }, { status: 400 });
  }

  // 합계 100% 검증
  const sum = targets.reduce((s, t) => s + t.target_ratio, 0);
  if (Math.abs(sum - 100) > 0.1) {
    return NextResponse.json({ error: `합계가 ${sum}%입니다. 100%여야 합니다.` }, { status: 400 });
  }

  // 기존 삭제 후 새로 삽입
  await supabase
    .from('rebalancing_targets')
    .delete()
    .eq('household_id', membership.household_id);

  const rows = targets
    .filter(t => t.target_ratio > 0)
    .map(t => ({
      household_id: membership.household_id,
      asset_class: t.asset_class,
      target_ratio: t.target_ratio,
    }));

  if (rows.length > 0) {
    const { error } = await supabase.from('rebalancing_targets').insert(rows);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true });
}
