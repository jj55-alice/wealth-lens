import { createClient } from '@supabase/supabase-js';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { getSupabaseUrl, getServiceRoleKey } from '@/lib/env';
import { fetchPricesBatch } from '@/lib/prices';
import { NextResponse } from 'next/server';
import type { PriceSource } from '@/types/database';

// 수동 스냅샷 생성
export async function POST() {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: '인증 필요' }, { status: 401 });
  }

  const supabaseAdmin = createClient(getSupabaseUrl(), getServiceRoleKey());

  const { data: membership } = await supabaseAdmin
    .from('household_members')
    .select('household_id')
    .eq('user_id', user.id)
    .single();

  if (!membership) {
    return NextResponse.json({ error: '가구 없음' }, { status: 404 });
  }

  const householdId = membership.household_id;

  // 시세 갱신
  const { data: allAssets } = await supabaseAdmin
    .from('assets')
    .select('id, ticker, price_source, quantity, manual_value')
    .eq('household_id', householdId);

  const tickerAssets = (allAssets ?? []).filter(a => a.ticker && a.price_source !== 'manual');
  if (tickerAssets.length > 0) {
    const prices = await fetchPricesBatch(
      tickerAssets.map(a => ({ ticker: a.ticker!, source: a.price_source as PriceSource }))
    );
    for (const [ticker, result] of prices) {
      await supabaseAdmin.from('price_cache').upsert(
        { ticker, price: result.price, currency: result.currency, source: result.source, fetched_at: new Date().toISOString() },
        { onConflict: 'ticker' }
      );
    }
  }

  // price_cache 로드
  const { data: cachedPrices } = await supabaseAdmin.from('price_cache').select('ticker, price');
  const priceMap = new Map<string, number>();
  for (const p of cachedPrices ?? []) {
    priceMap.set(p.ticker, p.price);
  }

  // 자산 스냅샷
  let totalAssets = 0;
  for (const asset of allAssets ?? []) {
    let value = 0;
    if (asset.manual_value) {
      value = Number(asset.manual_value);
    } else if (asset.ticker && asset.quantity) {
      const price = priceMap.get(asset.ticker);
      if (price) value = price * Number(asset.quantity);
    }
    totalAssets += value;

    await supabaseAdmin.from('asset_snapshots').upsert(
      { asset_id: asset.id, value, snapshot_date: new Date().toISOString().slice(0, 10) },
      { onConflict: 'asset_id,snapshot_date' }
    );
  }

  // 부채 스냅샷
  const { data: liabilities } = await supabaseAdmin
    .from('liabilities')
    .select('id, balance')
    .eq('household_id', householdId);

  let totalLiabilities = 0;
  for (const l of liabilities ?? []) {
    totalLiabilities += Number(l.balance);
    await supabaseAdmin.from('liability_snapshots').upsert(
      { liability_id: l.id, balance: Number(l.balance), snapshot_date: new Date().toISOString().slice(0, 10) },
      { onConflict: 'liability_id,snapshot_date' }
    );
  }

  // 가구 스냅샷
  const netWorth = totalAssets - totalLiabilities;
  await supabaseAdmin.from('household_snapshots').upsert(
    {
      household_id: householdId,
      total_assets: totalAssets,
      total_liabilities: totalLiabilities,
      net_worth: netWorth,
      snapshot_date: new Date().toISOString().slice(0, 10),
    },
    { onConflict: 'household_id,snapshot_date' }
  );

  return NextResponse.json({ totalAssets, totalLiabilities, netWorth, date: new Date().toISOString().slice(0, 10) });
}

// 스냅샷 히스토리 조회
export async function GET() {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: '인증 필요' }, { status: 401 });
  }

  const supabaseAdmin = createClient(getSupabaseUrl(), getServiceRoleKey());

  const { data: membership } = await supabaseAdmin
    .from('household_members')
    .select('household_id')
    .eq('user_id', user.id)
    .single();

  if (!membership) {
    return NextResponse.json([]);
  }

  const { data: snapshots } = await supabaseAdmin
    .from('household_snapshots')
    .select('total_assets, total_liabilities, net_worth, snapshot_date')
    .eq('household_id', membership.household_id)
    .order('snapshot_date', { ascending: true });

  return NextResponse.json(snapshots ?? []);
}
