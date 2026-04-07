import { NextResponse } from 'next/server';
import { createClient as createAdminClient, type SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseUrl, getServiceRoleKey } from '@/lib/env';
import { fetchNewsForHoldings } from '@/lib/news';
import { generateBriefing } from '@/lib/briefing/generate';
import type { HoldingContext } from '@/lib/briefing/types';

type Admin = SupabaseClient;

// 매일 06:00 KST cron이 호출. 가구별로 보유 종목 → 뉴스 → LLM → briefing_cards 저장.
// Vercel cron secret 검증으로 외부 호출 방지.
//
// POST /api/briefing/generate
//   Header: Authorization: Bearer <CRON_SECRET>  (Vercel cron이 자동 추가)
//   Body: { household_id?: string }  // 옵션: 특정 가구만. 없으면 전체.
export async function POST(request: Request) {
  // Vercel cron 호출 검증 (수동 트리거 시에는 service role token 또는 dev mode 허용)
  const authHeader = request.headers.get('authorization') ?? '';
  const cronSecret = process.env.CRON_SECRET;
  const isDev = process.env.NODE_ENV !== 'production';
  if (cronSecret && authHeader !== `Bearer ${cronSecret}` && !isDev) {
    return NextResponse.json({ error: '인증 필요' }, { status: 401 });
  }

  const admin = createAdminClient(getSupabaseUrl(), getServiceRoleKey());

  // body는 옵션
  let bodyHouseholdId: string | undefined;
  try {
    const body = await request.json().catch(() => ({}));
    bodyHouseholdId = body?.household_id;
  } catch {
    // ignore
  }

  // 가구 목록 조회
  let householdsQuery = admin.from('households').select('id');
  if (bodyHouseholdId) householdsQuery = householdsQuery.eq('id', bodyHouseholdId);

  const { data: households, error: hErr } = await householdsQuery;
  if (hErr) {
    return NextResponse.json({ error: hErr.message }, { status: 500 });
  }
  if (!households || households.length === 0) {
    return NextResponse.json({ generated: 0, message: '가구 없음' });
  }

  const results: { household_id: string; status: string; cards: number; cost_usd: number }[] = [];

  for (const hh of households) {
    const result = await generateForHousehold(admin, hh.id);
    results.push(result);
  }

  return NextResponse.json({
    generated: results.length,
    results,
  });
}

async function generateForHousehold(
  admin: Admin,
  householdId: string,
): Promise<{ household_id: string; status: string; cards: number; cost_usd: number }> {
  // 1. 보유 주식/코인 조회 (브리핑 대상은 stock + crypto, 부동산/현금은 제외)
  const { data: assets } = await admin
    .from('assets')
    .select('id, name, ticker, asset_class, quantity, manual_value, purchase_price, price_source, category')
    .eq('household_id', householdId)
    .in('category', ['stock', 'crypto'])
    .not('ticker', 'is', null);

  if (!assets || assets.length === 0) {
    return await saveResult(admin, householdId, {
      cards: [],
      status: 'empty',
      model: 'none',
      inputTokens: 0,
      outputTokens: 0,
      costUsd: 0,
    });
  }

  // 2. 가격 캐시 조회 (current_value 계산용)
  const tickers = assets.map((a) => a.ticker as string);
  const { data: prices } = await admin
    .from('price_cache')
    .select('ticker, price')
    .in('ticker', tickers);
  const priceMap = new Map<string, number>();
  for (const p of prices ?? []) priceMap.set(p.ticker, Number(p.price));

  // 3. holding 컨텍스트 만들기
  const enriched = assets.map((a) => {
    const price = priceMap.get(a.ticker as string) ?? 0;
    const qty = a.quantity ? Number(a.quantity) : 0;
    const currentValue = a.manual_value ? Number(a.manual_value) : price * qty;
    return { ...a, current_value: currentValue };
  });
  const totalValue = enriched.reduce((s, a) => s + a.current_value, 0);

  const holdings: HoldingContext[] = enriched.map((a) => {
    const pp = a.purchase_price ? Number(a.purchase_price) : null;
    const qty = a.quantity ? Number(a.quantity) : 0;
    const investedTotal = pp && qty ? pp * qty : null;
    const returnPct = investedTotal && investedTotal > 0
      ? ((a.current_value - investedTotal) / investedTotal) * 100
      : null;
    return {
      ticker: a.ticker as string,
      name: a.name,
      asset_class: a.asset_class,
      quantity: qty || null,
      purchase_price: pp,
      current_value: a.current_value,
      weight_pct: totalValue > 0 ? (a.current_value / totalValue) * 100 : 0,
      return_pct: returnPct,
      price_source: a.price_source,
    };
  });

  // 4. 뉴스 fetch (실패해도 계속 진행)
  const newsByTicker = await fetchNewsForHoldings(holdings, 5);

  // 5. LLM 호출
  const result = await generateBriefing(holdings, newsByTicker);

  // 6. DB 저장 (upsert by household_id + date)
  return await saveResult(admin, householdId, result);
}

async function saveResult(
  admin: Admin,
  householdId: string,
  result: Awaited<ReturnType<typeof generateBriefing>>,
): Promise<{ household_id: string; status: string; cards: number; cost_usd: number }> {
  const today = new Date().toISOString().slice(0, 10);
  await admin
    .from('briefing_cards')
    .upsert(
      {
        household_id: householdId,
        date: today,
        cards: result.cards,
        model: result.model,
        status: result.status,
        input_tokens: result.inputTokens,
        output_tokens: result.outputTokens,
        cost_usd: result.costUsd,
        error_message: result.errorMessage ?? null,
        generated_at: new Date().toISOString(),
      },
      { onConflict: 'household_id,date' },
    );

  return {
    household_id: householdId,
    status: result.status,
    cards: result.cards.length,
    cost_usd: result.costUsd,
  };
}
