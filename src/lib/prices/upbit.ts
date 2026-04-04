import type { PriceAdapter, PriceResult } from './types';

const UPBIT_API = 'https://api.upbit.com/v1';

export const upbitAdapter: PriceAdapter = {
  async fetchPrice(ticker: string): Promise<PriceResult> {
    const market = ticker.startsWith('KRW-') ? ticker : `KRW-${ticker}`;
    const res = await fetch(`${UPBIT_API}/ticker?markets=${market}`, {
      next: { revalidate: 300 }, // 5분 캐시
    });

    if (!res.ok) {
      throw new Error(`Upbit API error: ${res.status}`);
    }

    const data = await res.json();
    if (!data?.[0]?.trade_price) {
      throw new Error(`Upbit: ticker not found: ${ticker}`);
    }

    return {
      price: data[0].trade_price,
      currency: 'KRW',
      timestamp: new Date(data[0].timestamp),
      source: 'upbit',
      stale: false,
    };
  },

  async fetchBatch(tickers: string[]): Promise<Map<string, PriceResult>> {
    const markets = tickers
      .map((t) => (t.startsWith('KRW-') ? t : `KRW-${t}`))
      .join(',');

    const res = await fetch(`${UPBIT_API}/ticker?markets=${markets}`);
    const results = new Map<string, PriceResult>();

    if (!res.ok) {
      return results;
    }

    const data = await res.json();
    for (const item of data) {
      const ticker = item.market.replace('KRW-', '');
      results.set(ticker, {
        price: item.trade_price,
        currency: 'KRW',
        timestamp: new Date(item.timestamp),
        source: 'upbit',
        stale: false,
      });
    }

    return results;
  },
};
