import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { fetchDividendInfo, type DividendEvent, type DividendInfo } from '@/lib/dividends';
import {
  projectMonthlyDividends,
  summarizeProjection,
  type Holding,
} from '@/lib/dividends/projection';
import { getUsdKrwRate } from '@/lib/prices/bok';

interface AssetRow {
  ticker: string | null;
  price_source: string;
  quantity: number | string | null;
}

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: '인증 필요' }, { status: 401 });
  }

  const { data: membership } = await supabase
    .from('household_members')
    .select('household_id')
    .eq('user_id', user.id)
    .single();

  if (!membership) {
    return NextResponse.json({ error: '가구 없음' }, { status: 404 });
  }

  // 가구의 주식 자산
  const { data: stocksRaw } = await supabase
    .from('assets')
    .select('ticker, price_source, quantity')
    .eq('household_id', membership.household_id)
    .eq('category', 'stock')
    .not('ticker', 'is', null);

  const stocks = (stocksRaw ?? []) as AssetRow[];
  if (stocks.length === 0) {
    return NextResponse.json({
      dividends: [],
      events: [],
      projection: [],
      summary: { annualKrw: 0, monthlyAvgKrw: 0 },
    });
  }

  // 티커별 보유수량 합산 (여러 계좌 보유 케이스 병합)
  const holdingsMap = new Map<string, Holding>();
  const sourceMap = new Map<string, string>();
  for (const s of stocks) {
    if (!s.ticker) continue;
    const qty = Number(s.quantity ?? 0);
    if (!Number.isFinite(qty) || qty <= 0) continue;
    const existing = holdingsMap.get(s.ticker);
    const currency: 'KRW' | 'USD' =
      s.price_source === 'yahoo_finance' ? 'USD' : 'KRW';
    if (existing) {
      existing.quantity += qty;
    } else {
      holdingsMap.set(s.ticker, { ticker: s.ticker, quantity: qty, currency });
    }
    sourceMap.set(s.ticker, s.price_source);
  }

  const uniqueTickers = Array.from(holdingsMap.keys());

  // 현재가 조회 (yield 계산용)
  const { data: priceRows } = await supabase
    .from('price_cache')
    .select('ticker, price')
    .in('ticker', uniqueTickers);
  const priceMap = new Map<string, number>();
  for (const r of priceRows ?? []) priceMap.set(r.ticker, Number(r.price));

  // 캐시된 이벤트 먼저 읽기
  const { data: cachedEventsRaw } = await supabase
    .from('dividend_events')
    .select('ticker, ex_date, payment_date, record_date, amount_per_share, currency, source')
    .in('ticker', uniqueTickers)
    .gte('ex_date', new Date(Date.now() - 400 * 86400 * 1000).toISOString().slice(0, 10));

  const events: DividendEvent[] = (cachedEventsRaw ?? []).map((r) => ({
    ticker: r.ticker,
    exDate: r.ex_date,
    paymentDate: r.payment_date,
    recordDate: r.record_date,
    amountPerShare: Number(r.amount_per_share),
    currency: (r.currency === 'USD' ? 'USD' : 'KRW') as 'KRW' | 'USD',
    source: (r.source ?? 'fmp') as DividendEvent['source'],
  }));

  // 캐시에 없는 티커만 요약 fetch (UI legacy 섹션용). 이벤트 대량 fetch는 크론이 담당.
  const cachedTickers = new Set(events.map((e) => e.ticker));
  const missingTickers = uniqueTickers.filter((t) => !cachedTickers.has(t));

  const dividends: DividendInfo[] = [];
  if (missingTickers.length > 0) {
    const results = await Promise.allSettled(
      missingTickers.map((t) =>
        fetchDividendInfo(t, sourceMap.get(t) ?? 'manual', priceMap.get(t) ?? null),
      ),
    );
    for (const r of results) {
      if (r.status === 'fulfilled' && r.value) dividends.push(r.value);
    }
  }

  // 환율
  let usdKrw = 1400; // 기본 fallback
  try {
    const rate = await getUsdKrwRate();
    if (rate && rate > 0) usdKrw = rate;
  } catch { /* use default */ }

  // 월별 projection
  const projection = projectMonthlyDividends(
    Array.from(holdingsMap.values()),
    events,
    { months: 12, fxToKrw: { USD: usdKrw } },
  );
  const summary = summarizeProjection(projection);

  return NextResponse.json({
    dividends,
    events,
    projection,
    summary,
    exchangeRate: usdKrw,
  });
}
