import type { PriceAdapter, PriceResult } from './types';

// 금 시세: 네이버 금융 금 시세 or 한국금거래소
// 그램당 KRW 시세
const GOLD_PRICE_URL =
  'https://finance.naver.com/marketindex/goldDaily498498.naver';

// 폴백: 수동 입력 안내
const FALLBACK_GOLD_PRICE_PER_GRAM = 95000; // 2026년 4월 기준 대략값

export const goldAdapter: PriceAdapter = {
  async fetchPrice(_ticker: string): Promise<PriceResult> {
    try {
      // 한국금거래소 or 네이버 금 시세에서 그램당 가격 조회
      // 비공식 API이므로 실패 시 폴백
      const res = await fetch(
        'https://api.exchangeratesapi.io/v1/latest?symbols=XAU',
        { next: { revalidate: 3600 } },
      );

      if (!res.ok) throw new Error('Gold API failed');

      // 실제 연동 시 파싱 로직 필요. 현재는 폴백값 사용.
      return {
        price: FALLBACK_GOLD_PRICE_PER_GRAM,
        currency: 'KRW' as const,
        timestamp: new Date(),
        source: 'gold_exchange' as const,
        stale: true,
      };
    } catch {
      return {
        price: FALLBACK_GOLD_PRICE_PER_GRAM,
        currency: 'KRW',
        timestamp: new Date(),
        source: 'gold_exchange',
        stale: true,
      };
    }
  },

  async fetchBatch(tickers: string[]): Promise<Map<string, PriceResult>> {
    const result = new Map<string, PriceResult>();
    const price = await this.fetchPrice('GOLD');
    for (const t of tickers) {
      result.set(t, price);
    }
    return result;
  },
};
