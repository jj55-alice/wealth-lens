import { createClient } from '@supabase/supabase-js';
import { fetchPricesBatch } from '@/lib/prices';
import { NextResponse } from 'next/server';
import type { PriceSource } from '@/types/database';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

// Daily cron: fetch prices, create snapshots, check milestones
// Trigger via Vercel cron (vercel.json) at 18:00 KST
export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const today = new Date().toISOString().split('T')[0];
  let pricesUpdated = 0;
  let snapshotsCreated = 0;

  // 1. Fetch all assets with tickers across all households
  const { data: allAssets } = await supabaseAdmin
    .from('assets')
    .select('id, household_id, ticker, price_source, quantity, manual_value')
    .not('ticker', 'is', null);

  if (allAssets && allAssets.length > 0) {
    // Deduplicate tickers
    const uniqueItems = new Map<string, { ticker: string; source: PriceSource }>();
    for (const a of allAssets) {
      if (a.ticker && a.price_source !== 'manual') {
        uniqueItems.set(a.ticker, {
          ticker: a.ticker,
          source: a.price_source as PriceSource,
        });
      }
    }

    // Batch fetch prices
    const prices = await fetchPricesBatch(Array.from(uniqueItems.values()));

    // Update price cache
    for (const [ticker, result] of prices) {
      await supabaseAdmin.from('price_cache').upsert(
        {
          ticker,
          price: result.price,
          currency: result.currency,
          source: result.source,
          fetched_at: new Date().toISOString(),
        },
        { onConflict: 'ticker' },
      );
      pricesUpdated++;
    }
  }

  // 2. Create snapshots for all households
  const { data: households } = await supabaseAdmin
    .from('households')
    .select('id');

  if (households) {
    // Get all cached prices
    const { data: priceCache } = await supabaseAdmin
      .from('price_cache')
      .select('ticker, price');
    const priceLookup = new Map(
      (priceCache ?? []).map((p) => [p.ticker, Number(p.price)]),
    );

    for (const hh of households) {
      // Get assets
      const { data: assets } = await supabaseAdmin
        .from('assets')
        .select('id, ticker, quantity, manual_value')
        .eq('household_id', hh.id);

      let totalAssets = 0;
      for (const a of assets ?? []) {
        if (a.manual_value) {
          totalAssets += Number(a.manual_value);
        } else if (a.ticker && a.quantity) {
          const price = priceLookup.get(a.ticker);
          if (price) totalAssets += price * Number(a.quantity);
        }

        // Asset snapshot
        const value = a.manual_value
          ? Number(a.manual_value)
          : (a.ticker && a.quantity ? (priceLookup.get(a.ticker) ?? 0) * Number(a.quantity) : 0);

        await supabaseAdmin.from('asset_snapshots').insert({
          asset_id: a.id,
          value,
          snapshot_date: today,
        });
      }

      // Get liabilities
      const { data: liabilities } = await supabaseAdmin
        .from('liabilities')
        .select('id, balance')
        .eq('household_id', hh.id);

      let totalLiabilities = 0;
      for (const l of liabilities ?? []) {
        totalLiabilities += Number(l.balance);

        await supabaseAdmin.from('liability_snapshots').insert({
          liability_id: l.id,
          balance: Number(l.balance),
          snapshot_date: today,
        });
      }

      // Household snapshot
      await supabaseAdmin.from('household_snapshots').insert({
        household_id: hh.id,
        total_assets: totalAssets,
        total_liabilities: totalLiabilities,
        net_worth: totalAssets - totalLiabilities,
        snapshot_date: today,
      });

      snapshotsCreated++;
    }
  }

  return NextResponse.json({
    prices_updated: pricesUpdated,
    snapshots_created: snapshotsCreated,
    date: today,
  });
}
