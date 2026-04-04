import { createClient } from '@supabase/supabase-js';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { fetchPricesBatch } from '@/lib/prices';
import { getSupabaseUrl, getServiceRoleKey } from '@/lib/env';
import { NextResponse } from 'next/server';
import type { PriceSource } from '@/types/database';

export async function POST() {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: '인증 필요' }, { status: 401 });
  }

  const supabaseAdmin = createClient(getSupabaseUrl(), getServiceRoleKey());

  // Get user's household
  const { data: membership } = await supabaseAdmin
    .from('household_members')
    .select('household_id')
    .eq('user_id', user.id)
    .single();

  if (!membership) {
    return NextResponse.json({ error: '가구 없음' }, { status: 404 });
  }

  // Get all assets with tickers
  const { data: assets } = await supabaseAdmin
    .from('assets')
    .select('id, ticker, price_source')
    .eq('household_id', membership.household_id)
    .not('ticker', 'is', null);

  if (!assets || assets.length === 0) {
    return NextResponse.json({ updated: 0 });
  }

  // Fetch prices in batch
  const items = assets
    .filter((a) => a.ticker && a.price_source !== 'manual')
    .map((a) => ({
      ticker: a.ticker as string,
      source: a.price_source as PriceSource,
    }));

  const prices = await fetchPricesBatch(items);

  // Update price cache
  let updated = 0;
  for (const [ticker, result] of prices) {
    const { error } = await supabaseAdmin.from('price_cache').upsert(
      {
        ticker,
        price: result.price,
        currency: result.currency,
        source: result.source,
        fetched_at: new Date().toISOString(),
      },
      { onConflict: 'ticker' },
    );
    if (!error) updated++;
  }

  return NextResponse.json({ updated, total: items.length });
}
