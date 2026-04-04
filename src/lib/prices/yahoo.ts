import type { PriceAdapter, PriceResult } from './types';

const YAHOO_API = 'https://query1.finance.yahoo.com/v8/finance/chart';

export const yahooAdapter: PriceAdapter = {
  async fetchPrice(ticker: string): Promise<PriceResult> {
    const res = await fetch(`${YAHOO_API}/${ticker}?interval=1d&range=1d`, {
      next: { revalidate: 300 },
      headers: { 'User-Agent': 'Mozilla/5.0' },
    });

    if (!res.ok) {
      throw new Error(`Yahoo Finance API error: ${res.status}`);
    }

    const data = await res.json();
    const meta = data?.chart?.result?.[0]?.meta;
    if (!meta?.regularMarketPrice) {
      throw new Error(`Yahoo: ticker not found: ${ticker}`);
    }

    return {
      price: meta.regularMarketPrice,
      currency: meta.currency === 'KRW' ? 'KRW' : 'USD',
      timestamp: new Date(),
      source: 'yahoo_finance',
      stale: false,
    };
  },

  async fetchBatch(tickers: string[]): Promise<Map<string, PriceResult>> {
    const results = new Map<string, PriceResult>();
    // Yahoo doesn't have a great batch API, fetch individually with Promise.allSettled
    const fetches = tickers.map(async (ticker) => {
      try {
        const result = await this.fetchPrice(ticker);
        results.set(ticker, result);
      } catch {
        // Skip failed tickers
      }
    });
    await Promise.allSettled(fetches);
    return results;
  },
};
