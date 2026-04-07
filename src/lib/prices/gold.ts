import type { PriceAdapter, PriceResult } from './types';

// 금 시세: 네이버 금융 금 시세 (그램당 KRW, 매도가 기준)
// https://finance.naver.com/marketindex/goldDetail.naver
//
// 평가 기준: "계좌 (고객출금 시)" 가격 = 사용자가 매도 시 실제 받는 금액.
// 자산 평가는 보수적으로 매도가를 사용한다 (매수가는 거래 비용이 포함되어 있음).

const FALLBACK_GOLD_PRICE_PER_GRAM = 222000; // 2026년 4월 기준 (g당 매도가)

/**
 * 네이버 금 시세 페이지 HTML에서 그램당 매도가를 추출한다.
 * export되어 있어 테스트에서 직접 호출 가능.
 */
export function parseNaverGoldPrice(html: string): number | null {
  // 1순위: "계좌 (고객출금 시)" 라벨 다음의 숫자 (매도가 = 자산 평가 기준)
  // HTML 태그가 사이에 끼어있을 수 있으니 너그러운 정규식 사용
  const sellMatch = html.match(/고객출금[^0-9]{0,200}([0-9]{3},[0-9]{3})(?:\.[0-9]+)?/);
  if (sellMatch) {
    const price = Number(sellMatch[1].replace(/,/g, ''));
    if (price >= 100000 && price <= 500000) return price;
  }

  // 2순위: "계좌 (고객입금 시)" — 매수가
  const buyMatch = html.match(/고객입금[^0-9]{0,200}([0-9]{3},[0-9]{3})(?:\.[0-9]+)?/);
  if (buyMatch) {
    const price = Number(buyMatch[1].replace(/,/g, ''));
    if (price >= 100000 && price <= 500000) return price;
  }

  return null;
}

async function fetchGoldPriceFromNaver(): Promise<number> {
  try {
    const res = await fetch('https://finance.naver.com/marketindex/goldDetail.naver', {
      headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36' },
    });

    if (!res.ok) throw new Error('Naver gold page failed');

    const buffer = await res.arrayBuffer();
    const decoder = new TextDecoder('euc-kr');
    const html = decoder.decode(buffer);

    const price = parseNaverGoldPrice(html);
    if (price !== null) return price;

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
