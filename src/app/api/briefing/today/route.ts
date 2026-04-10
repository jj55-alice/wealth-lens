import { NextResponse } from 'next/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { getSupabaseUrl, getServiceRoleKey } from '@/lib/env';

// GET /api/briefing/today
// 본인 가구의 오늘 (또는 가장 최근) 브리핑 카드 반환.
// stale 검사: generated_at이 어제 이전이면 status=stale 표시.
export async function GET() {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: '인증 필요' }, { status: 401 });

  const admin = createAdminClient(getSupabaseUrl(), getServiceRoleKey());

  const { data: membership } = await admin
    .from('household_members')
    .select('household_id')
    .eq('user_id', user.id)
    .maybeSingle();
  if (!membership) return NextResponse.json({ error: '가구 없음' }, { status: 404 });

  // 가장 최근 카드 1행
  const { data: card } = await admin
    .from('briefing_cards')
    .select('*')
    .eq('household_id', membership.household_id)
    .order('date', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!card) {
    return NextResponse.json({ briefing: null });
  }

  // stale 판정 (오늘이 아니면 stale)
  const today = new Date().toISOString().slice(0, 10);
  const stale = card.date !== today;

  return NextResponse.json({
    briefing: {
      id: card.id,
      date: card.date,
      generated_at: card.generated_at,
      cards: card.cards ?? [],
      status: card.status,
      model: card.model,
      cost_usd: card.cost_usd,
      error_message: card.error_message,
      pace: card.pace ?? null,
      stale,
    },
  });
}
