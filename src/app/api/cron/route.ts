import { createClient } from '@supabase/supabase-js';
import { fetchPricesBatch } from '@/lib/prices';
import { getKbPrice } from '@/lib/prices/kb';
import { getSupabaseUrl, getServiceRoleKey, getCronSecret } from '@/lib/env';
import { NextResponse } from 'next/server';
import type { PriceSource } from '@/types/database';

// Daily cron: fetch prices, create snapshots, check milestones
// Trigger via Vercel cron (vercel.json) at 18:00 KST
export async function GET(request: Request) {
  const cronSecret = getCronSecret();
  const authHeader = request.headers.get('authorization');
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabaseAdmin = createClient(getSupabaseUrl(), getServiceRoleKey());

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

    // Fetch ALL assets and liabilities in bulk (avoid N+1)
    const { data: allAssetRows } = await supabaseAdmin
      .from('assets')
      .select('id, household_id, ticker, quantity, manual_value');
    const { data: allLiabilityRows } = await supabaseAdmin
      .from('liabilities')
      .select('id, household_id, balance');

    const assetsByHH = new Map<string, typeof allAssetRows>();
    for (const a of allAssetRows ?? []) {
      const list = assetsByHH.get(a.household_id) ?? [];
      list.push(a);
      assetsByHH.set(a.household_id, list);
    }
    const liabilitiesByHH = new Map<string, typeof allLiabilityRows>();
    for (const l of allLiabilityRows ?? []) {
      const list = liabilitiesByHH.get(l.household_id) ?? [];
      list.push(l);
      liabilitiesByHH.set(l.household_id, list);
    }

    const assetSnapshotBatch: { asset_id: string; value: number; snapshot_date: string }[] = [];
    const liabilitySnapshotBatch: { liability_id: string; balance: number; snapshot_date: string }[] = [];
    const householdSnapshotBatch: { household_id: string; total_assets: number; total_liabilities: number; net_worth: number; snapshot_date: string }[] = [];

    for (const hh of households) {
      const assets = assetsByHH.get(hh.id) ?? [];
      let totalAssets = 0;
      for (const a of assets) {
        const value = a.manual_value
          ? Number(a.manual_value)
          : (a.ticker && a.quantity ? (priceLookup.get(a.ticker) ?? 0) * Number(a.quantity) : 0);
        totalAssets += value;
        assetSnapshotBatch.push({ asset_id: a.id, value, snapshot_date: today });
      }

      const liabilities = liabilitiesByHH.get(hh.id) ?? [];
      let totalLiabilities = 0;
      for (const l of liabilities) {
        const bal = Number(l.balance);
        totalLiabilities += bal;
        liabilitySnapshotBatch.push({ liability_id: l.id, balance: bal, snapshot_date: today });
      }

      householdSnapshotBatch.push({
        household_id: hh.id,
        total_assets: totalAssets,
        total_liabilities: totalLiabilities,
        net_worth: totalAssets - totalLiabilities,
        snapshot_date: today,
      });
      snapshotsCreated++;
    }

    // Batch insert all snapshots (3 queries instead of N*M)
    if (assetSnapshotBatch.length > 0) {
      await supabaseAdmin.from('asset_snapshots').upsert(assetSnapshotBatch, { onConflict: 'asset_id,snapshot_date', ignoreDuplicates: true });
    }
    if (liabilitySnapshotBatch.length > 0) {
      await supabaseAdmin.from('liability_snapshots').upsert(liabilitySnapshotBatch, { onConflict: 'liability_id,snapshot_date', ignoreDuplicates: true });
    }
    if (householdSnapshotBatch.length > 0) {
      await supabaseAdmin.from('household_snapshots').upsert(householdSnapshotBatch, { onConflict: 'household_id,snapshot_date', ignoreDuplicates: true });
    }
  }

  // 3. Update KB real estate estimated values (weekly: only on Mondays KST)
  let kbUpdated = 0;
  const kstNow = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const dayOfWeekKST = kstNow.getUTCDay(); // 0=Sun, 1=Mon (in KST)
  if (dayOfWeekKST === 1) {
    const { data: kbAssets } = await supabaseAdmin
      .from('assets')
      .select('id, kb_complex_id, category')
      .not('kb_complex_id', 'is', null);

    if (kbAssets && kbAssets.length > 0) {
      for (const asset of kbAssets) {
        try {
          const priceInfo = await getKbPrice(asset.kb_complex_id!);
          if (priceInfo && priceInfo.dealPrice > 0) {
            await supabaseAdmin
              .from('assets')
              .update({
                kb_estimated_value: priceInfo.dealPrice * 10000,
                kb_estimated_at: new Date().toISOString(),
              })
              .eq('id', asset.id);
            kbUpdated++;
          }
        } catch {
          // Silent fail per asset — keep existing value
        }
      }
    }
  }

  return NextResponse.json({
    prices_updated: pricesUpdated,
    snapshots_created: snapshotsCreated,
    kb_updated: kbUpdated,
    date: today,
  });
}
