import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { getSupabaseUrl, getServiceRoleKey } from '@/lib/env';
import { StockPortfolio } from '@/components/stock-portfolio';
import { Button } from '@/components/ui/button';
import { getUsdKrwRate } from '@/lib/prices/bok';
import {
  projectMonthlyDividends,
  summarizeProjection,
  type Holding,
} from '@/lib/dividends/projection';
import type { DividendEvent, DividendInfo } from '@/lib/dividends';
import type { AssetWithPrice, Asset } from '@/types/database';

// 동적 렌더 — 사용자 데이터
export const dynamic = 'force-dynamic';

export default async function StocksPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: membership } = await supabase
    .from('household_members')
    .select('household_id')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!membership) redirect('/dashboard');

  // 병렬: assets, exchange rate. 나머지는 tickers 나온 뒤 이어서 병렬.
  const [assetsRes, usdKrw] = await Promise.all([
    supabase
      .from('assets')
      .select('*')
      .eq('household_id', membership.household_id)
      .eq('category', 'stock')
      .order('created_at'),
    getUsdKrwRate(),
  ]);

  const rawStocks = (assetsRes.data ?? []) as Asset[];
  const tickers = rawStocks.map((a) => a.ticker).filter(Boolean) as string[];

  // 병렬: price_cache + dividend_events (둘 다 tickers 필요)
  const admin = createAdminClient(getSupabaseUrl(), getServiceRoleKey());
  const [pricesRes, eventsRes] = tickers.length
    ? await Promise.all([
        admin
          .from('price_cache')
          .select('ticker, price, previous_close, fetched_at')
          .in('ticker', tickers),
        admin
          .from('dividend_events')
          .select('ticker, ex_date, payment_date, record_date, amount_per_share, currency, source')
          .in('ticker', tickers)
          .gte(
            'ex_date',
            new Date(Date.now() - 400 * 86400 * 1000).toISOString().slice(0, 10),
          ),
      ])
    : [{ data: [] }, { data: [] }];

  const priceMap = new Map<
    string,
    { price: number; previous_close: number | null; fetched_at: string }
  >();
  for (const p of pricesRes.data ?? []) {
    priceMap.set(p.ticker, {
      price: Number(p.price),
      previous_close: p.previous_close != null ? Number(p.previous_close) : null,
      fetched_at: p.fetched_at,
    });
  }

  const stocks: AssetWithPrice[] = rawStocks.map((asset) => {
    const cached = asset.ticker ? priceMap.get(asset.ticker) : null;
    const currentPrice = cached?.price ?? null;
    const previousClose = cached?.previous_close ?? null;
    const qty = asset.quantity != null ? Number(asset.quantity) : null;
    const currentValue =
      currentPrice && qty != null ? currentPrice * qty : 0;
    const isStale = cached
      ? Date.now() - new Date(cached.fetched_at).getTime() > 24 * 60 * 60 * 1000
      : false;
    const dailyChangeRate =
      currentPrice != null && previousClose != null && previousClose > 0
        ? ((currentPrice - previousClose) / previousClose) * 100
        : null;
    return {
      ...asset,
      quantity: qty,
      manual_value:
        asset.manual_value != null ? Number(asset.manual_value) : null,
      current_price: currentPrice,
      current_value: currentValue,
      price_updated_at: cached?.fetched_at ?? null,
      is_stale: isStale,
      previous_close: previousClose,
      daily_change_rate: dailyChangeRate,
    } as AssetWithPrice;
  });

  // 배당 이벤트 + 월별 projection
  const events: DividendEvent[] = (eventsRes.data ?? []).map((r) => ({
    ticker: r.ticker,
    exDate: r.ex_date,
    paymentDate: r.payment_date,
    recordDate: r.record_date,
    amountPerShare: Number(r.amount_per_share),
    currency: (r.currency === 'USD' ? 'USD' : 'KRW') as 'KRW' | 'USD',
    source: (r.source ?? 'fmp') as DividendEvent['source'],
  }));

  // 보유 종목별 수량 합산
  const holdingsMap = new Map<string, Holding>();
  for (const s of stocks) {
    if (!s.ticker || !s.quantity || s.quantity <= 0) continue;
    const currency: 'KRW' | 'USD' =
      s.price_source === 'yahoo_finance' ? 'USD' : 'KRW';
    const existing = holdingsMap.get(s.ticker);
    if (existing) existing.quantity += s.quantity;
    else holdingsMap.set(s.ticker, { ticker: s.ticker, quantity: s.quantity, currency });
  }

  const projection = projectMonthlyDividends(
    Array.from(holdingsMap.values()),
    events,
    { months: 12, fxToKrw: { USD: usdKrw } },
  );
  const summary = summarizeProjection(projection);

  // 요약 카드용 dividends (레거시 — 각 티커별 최근 1건)
  const latestByTicker = new Map<string, DividendEvent>();
  for (const ev of events) {
    const cur = latestByTicker.get(ev.ticker);
    if (!cur || ev.exDate > cur.exDate) latestByTicker.set(ev.ticker, ev);
  }
  const dividends: DividendInfo[] = Array.from(latestByTicker.values()).map((ev) => ({
    ticker: ev.ticker,
    dividendPerShare: ev.amountPerShare,
    dividendYield: 0,
    exDate: ev.exDate,
    paymentDate: ev.paymentDate,
    frequency: null,
    currency: ev.currency,
    source: ev.source,
  }));

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border px-6 py-4">
        <div className="mx-auto max-w-5xl flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/dashboard">
              <Button variant="ghost" size="sm">← 대시보드</Button>
            </Link>
            <h1 className="text-lg font-semibold">주식 포트폴리오</h1>
          </div>
          <Link
            href="/assets/new"
            className="rounded-lg bg-primary px-4 py-2 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            + 주식 추가
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-8">
        {stocks.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-4xl mb-4">📈</p>
            <h2 className="text-lg font-semibold">주식이 없습니다</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              주식을 등록하면 수익률과 배당 정보를 확인할 수 있습니다
            </p>
            <Link
              href="/assets/new"
              className="mt-4 inline-block rounded-lg bg-primary px-6 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              주식 등록하기
            </Link>
          </div>
        ) : (
          <StockPortfolio
            stocks={stocks}
            dividends={dividends}
            projection={projection}
            annualKrw={summary.annualKrw}
            monthlyAvgKrw={summary.monthlyAvgKrw}
            exchangeRate={usdKrw}
          />
        )}
      </main>
    </div>
  );
}
