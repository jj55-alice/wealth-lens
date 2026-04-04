import type { PriceResult } from './types';

// 한국은행 환율 API (USD/KRW)
// 폴백: 고정값 사용

const FALLBACK_USD_KRW = 1380;

let cachedRate: { rate: number; fetchedAt: number } | null = null;

export async function getUsdKrwRate(): Promise<number> {
  // 1시간 캐시
  if (cachedRate && Date.now() - cachedRate.fetchedAt < 3600 * 1000) {
    return cachedRate.rate;
  }

  try {
    // 네이버 환율 API
    const res = await fetch(
      'https://m.stock.naver.com/front-api/v1/marketIndex/prices?category=exchange&reutersCode=FX_USDKRW',
      {
        next: { revalidate: 3600 },
        headers: {
          'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X)',
        },
      },
    );

    if (!res.ok) throw new Error(`Exchange rate API error: ${res.status}`);

    const data = await res.json();
    const rate = data?.result?.[0]?.closePrice;

    if (rate) {
      const numericRate = typeof rate === 'string' ? Number(rate.replace(/,/g, '')) : Number(rate);
      if (!isNaN(numericRate)) {
        cachedRate = { rate: numericRate, fetchedAt: Date.now() };
        return numericRate;
      }
    }
    throw new Error('Could not parse rate');
  } catch {
    return cachedRate?.rate ?? FALLBACK_USD_KRW;
  }
}

export function convertUsdToKrw(priceResult: PriceResult, usdKrwRate: number): PriceResult {
  if (priceResult.currency === 'KRW') return priceResult;
  return {
    ...priceResult,
    price: Math.round(priceResult.price * usdKrwRate),
    currency: 'KRW',
  };
}
