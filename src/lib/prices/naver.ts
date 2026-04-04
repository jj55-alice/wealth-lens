import type { PriceAdapter, PriceResult } from './types';

// 네이버 금융 비공식 API (국내 주식)
// 실패 시 수동 입력 폴백 안내
const NAVER_STOCK_API = 'https://m.stock.naver.com/api/stock';

export const naverAdapter: PriceAdapter = {
  async fetchPrice(ticker: string): Promise<PriceResult> {
    // 네이버 모바일 API: /api/stock/{ticker}/basic
    const res = await fetch(`${NAVER_STOCK_API}/${ticker}/basic`, {
      next: { revalidate: 300 },
      headers: {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X)',
      },
    });

    if (!res.ok) {
      throw new Error(`Naver API error: ${res.status} for ${ticker}`);
    }

    const data = await res.json();
    const price = data?.closePrice ?? data?.nowVal;

    if (!price) {
      throw new Error(`Naver: price not found for ${ticker}`);
    }

    // closePrice comes as string with commas: "72,300"
    const numericPrice =
      typeof price === 'string'
        ? Number(price.replace(/,/g, ''))
        : Number(price);

    if (isNaN(numericPrice)) {
      throw new Error(`Naver: invalid price format for ${ticker}: ${price}`);
    }

    return {
      price: numericPrice,
      currency: 'KRW',
      timestamp: new Date(),
      source: 'krx',
      stale: false,
    };
  },

  async fetchBatch(tickers: string[]): Promise<Map<string, PriceResult>> {
    const results = new Map<string, PriceResult>();
    const fetches = tickers.map(async (ticker) => {
      try {
        const result = await this.fetchPrice(ticker);
        results.set(ticker, result);
      } catch {
        // Skip failed
      }
    });
    await Promise.allSettled(fetches);
    return results;
  },
};
