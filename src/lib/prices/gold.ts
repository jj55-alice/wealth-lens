import type { PriceAdapter, PriceResult } from './types';

// 금 시세: 네이버 금융 금 시세 (그램당 KRW)
// https://finance.naver.com/marketindex/goldDetail.naver

const FALLBACK_GOLD_PRICE_PER_GRAM = 229000; // 2026년 4월 기준

async function fetchGoldPriceFromNaver(): Promise<number> {
  try {
    const res = await fetch('https://finance.naver.com/marketindex/goldDetail.naver', {
      headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36' },
    });

    if (!res.ok) throw new Error('Naver gold page failed');

    const buffer = await res.arrayBuffer();
    const decoder = new TextDecoder('euc-kr');
    const html = decoder.decode(buffer);

    // 네이버 금 시세 페이지에서 가격 추출 (첫 번째 큰 숫자가 매매기준율)
    const matches = html.match(/([0-9]{2,3},[0-9]{3})/g);
    if (matches && matches.length > 0) {
      // 첫 번째 매칭이 보통 국제 금시세 (USD/g 변환), 마지막 근처가 국내 금시세
      // 229,061 같은 패턴이 그램당 원화 시세
      for (const m of matches) {
        const price = Number(m.replace(',', ''));
        // 그램당 금 시세는 대략 150,000~400,000원 범위
        if (price >= 150000 && price <= 400000) {
          return price;
        }
      }
    }

    throw new Error('Could not parse gold price');
  } catch {
    return FALLBACK_GOLD_PRICE_PER_GRAM;
  }
}

export const goldAdapter: PriceAdapter = {
  async fetchPrice(_ticker: string): Promise<PriceResult> {
    const price = await fetchGoldPriceFromNaver();

    return {
      price,
      currency: 'KRW',
      timestamp: new Date(),
      source: 'gold_exchange',
      stale: price === FALLBACK_GOLD_PRICE_PER_GRAM,
    };
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
