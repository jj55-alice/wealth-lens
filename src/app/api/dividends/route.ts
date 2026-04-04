import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { fetchDividendInfo } from '@/lib/dividends';

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: '인증 필요' }, { status: 401 });
  }

  // Get user's household
  const { data: membership } = await supabase
    .from('household_members')
    .select('household_id')
    .eq('user_id', user.id)
    .single();

  if (!membership) {
    return NextResponse.json({ error: '가구 없음' }, { status: 404 });
  }

  // Get stock assets
  const { data: stocks } = await supabase
    .from('assets')
    .select('ticker, price_source')
    .eq('household_id', membership.household_id)
    .eq('category', 'stock')
    .not('ticker', 'is', null);

  if (!stocks || stocks.length === 0) {
    return NextResponse.json([]);
  }

  // Fetch dividend info for each stock
  const results = await Promise.allSettled(
    stocks.map((s) => fetchDividendInfo(s.ticker!, s.price_source))
  );

  const dividends = results
    .map((r) => (r.status === 'fulfilled' ? r.value : null))
    .filter(Boolean);

  return NextResponse.json(dividends);
}
