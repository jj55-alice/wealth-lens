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
      // Upbit은 한국시간 00:00 기준 전일 종가를 prev_closing_price로 내려준다.
      // 코인은 24/7이라 "어제 종가"는 사실상 "24시간 전 UTC+9 자정 기준가".
      previousClose:
        typeof data[0].prev_closing_price === 'number'
          ? data[0].prev_closing_price
          : null,
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
        previousClose:
          typeof item.prev_closing_price === 'number'
            ? item.prev_closing_price
            : null,
        currency: 'KRW',
        timestamp: new Date(item.timestamp),
        source: 'upbit',
        stale: false,
      });
    }

    return results;
  },
};
