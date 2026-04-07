import { NextResponse } from 'next/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { getSupabaseUrl, getServiceRoleKey } from '@/lib/env';

// POST /api/briefing/feedback
// body: { briefing_id: string, card_index: number, feedback: 1 | -1 | null }
// 카드 배열의 특정 index에 feedback 필드를 업데이트.
export async function POST(request: Request) {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: '인증 필요' }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const briefingId = body?.briefing_id;
  const cardIndex = body?.card_index;
  const feedback = body?.feedback;

  if (!briefingId || typeof cardIndex !== 'number') {
    return NextResponse.json({ error: 'briefing_id, card_index 필요' }, { status: 400 });
  }
  if (feedback !== 1 && feedback !== -1 && feedback !== null) {
    return NextResponse.json({ error: 'feedback은 1, -1, null만 허용' }, { status: 400 });
  }

  const admin = createAdminClient(getSupabaseUrl(), getServiceRoleKey());

  // 본인 가구의 briefing인지 확인
  const { data: membership } = await admin
    .from('household_members')
    .select('household_id')
    .eq('user_id', user.id)
    .maybeSingle();
  if (!membership) return NextResponse.json({ error: '가구 없음' }, { status: 404 });

  const { data: briefing } = await admin
    .from('briefing_cards')
    .select('id, household_id, cards')
    .eq('id', briefingId)
    .maybeSingle();

  if (!briefing || briefing.household_id !== membership.household_id) {
    return NextResponse.json({ error: '권한 없음' }, { status: 403 });
  }

  const cards = Array.isArray(briefing.cards) ? [...briefing.cards] : [];
  if (cardIndex < 0 || cardIndex >= cards.length) {
    return NextResponse.json({ error: 'card_index 범위 초과' }, { status: 400 });
  }

  cards[cardIndex] = { ...cards[cardIndex], feedback };

  const { error } = await admin
    .from('briefing_cards')
    .update({ cards })
    .eq('id', briefingId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
