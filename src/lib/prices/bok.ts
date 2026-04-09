import type { PriceResult } from './types';

// 환율 API (USD/KRW)
const FALLBACK_USD_KRW = 1460;

let cachedRate: { rate: number; fetchedAt: number } | null = null;

export async function getUsdKrwRate(): Promise<number> {
  // 1시간 캐시
  if (cachedRate && Date.now() - cachedRate.fetchedAt < 3600 * 1000) {
    return cachedRate.rate;
  }

  // 방법 1: open.er-api.com (무료, 안정적)
  try {
    const res = await fetch('https://open.er-api.com/v6/latest/USD', {
      next: { revalidate: 3600 },
    });

    if (res.ok) {
      const data = await res.json();
      const rate = data?.rates?.KRW;
      if (rate && !isNaN(Number(rate))) {
        cachedRate = { rate: Number(rate), fetchedAt: Date.now() };
        return cachedRate.rate;
      }
    }
  } catch {
    // fall through
  }

  // 방법 2: 네이버 finance 페이지 스크래핑 (폴백)
  try {
    const res = await fetch(
      'https://finance.naver.com/marketindex/exchangeDailyQuote.naver?marketindexCd=FX_USDKRW',
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
        },
      },
    );

    if (res.ok) {
      const html = await res.text();
      const match = html.match(/<td class="num">([0-9,\.]+)<\/td>/);
      if (match) {
        const rate = Number(match[1].replace(/,/g, ''));
        if (!isNaN(rate)) {
          cachedRate = { rate, fetchedAt: Date.now() };
          return cachedRate.rate;
        }
      }
    }
  } catch {
    // fall through
  }

  return cachedRate?.rate ?? FALLBACK_USD_KRW;
}

export function convertUsdToKrw(priceResult: PriceResult, usdKrwRate: number): PriceResult {
  if (priceResult.currency === 'KRW') return priceResult;
  return {
    ...priceResult,
    price: Math.round(priceResult.price * usdKrwRate),
    // previousClose도 같은 레이트로 변환해야 당일 변동률 계산 시
    // 통화 단위가 일치한다. 이걸 빼먹으면 (KRW price - USD prev) / USD prev
    // = 약 1400배 × 14만% 같은 말도 안 되는 수치가 나옴.
    previousClose:
      priceResult.previousClose != null
        ? Math.round(priceResult.previousClose * usdKrwRate)
        : (priceResult.previousClose ?? null),
    currency: 'KRW',
  };
}
