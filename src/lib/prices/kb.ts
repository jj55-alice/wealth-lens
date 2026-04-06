import type { PriceAdapter, PriceResult } from './types';

// KB부동산 시세 조회
// KB부동산 API를 통해 아파트 시세 조회
const KB_API_BASE = 'https://api.kbland.kr';
const USER_AGENT = 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15';

export interface KbComplex {
  complexId: string;
  complexName: string;
  address: string;
  totalHousehold: number;
}

export interface KbArea {
  areaId: string;
  exclusiveArea: number; // 전용면적 (㎡)
  supplyArea: number; // 공급면적 (㎡)
}

export interface KbPriceInfo {
  dealPrice: number; // 매매 시세 (만원)
  jeonsePrice: number; // 전세 시세 (만원)
  priceDate: string;
}

/**
 * KB부동산에서 아파트 단지를 검색합니다.
 */
export async function searchKbComplex(query: string): Promise<KbComplex[]> {
  try {
    const res = await fetch(
      `${KB_API_BASE}/land-complex/complexSearch?searchWord=${encodeURIComponent(query)}&orderBy=ACC`,
      { headers: { 'User-Agent': USER_AGENT } }
    );

    if (!res.ok) return [];

    const data = await res.json();
    const items = data?.dataBody?.data ?? [];

    return items
      .filter((item: Record<string, unknown>) => item.complexType === 'APT')
      .slice(0, 10)
      .map((item: Record<string, unknown>) => ({
        complexId: String(item.complexNo ?? ''),
        complexName: String(item.complexName ?? ''),
        address: String(item.address ?? ''),
        totalHousehold: Number(item.totalHousehold ?? 0),
      }));
  } catch {
    return [];
  }
}

/**
 * KB부동산에서 단지의 면적 리스트를 가져옵니다.
 */
export async function getKbAreas(complexId: string): Promise<KbArea[]> {
  try {
    const res = await fetch(
      `${KB_API_BASE}/land-complex/complexDetail?complexNo=${complexId}`,
      { headers: { 'User-Agent': USER_AGENT } }
    );

    if (!res.ok) return [];

    const data = await res.json();
    const areas = data?.dataBody?.areaList ?? [];

    return areas.map((a: Record<string, unknown>) => ({
      areaId: String(a.areaNo ?? ''),
      exclusiveArea: Number(a.exclusiveArea ?? 0),
      supplyArea: Number(a.supplyArea ?? 0),
    }));
  } catch {
    return [];
  }
}

/**
 * KB부동산에서 특정 단지+면적의 시세를 조회합니다.
 */
export async function getKbPrice(complexId: string, areaId?: string): Promise<KbPriceInfo | null> {
  try {
    let url = `${KB_API_BASE}/land-price/priceInfo?complexNo=${complexId}`;
    if (areaId) url += `&areaNo=${areaId}`;

    const res = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT },
    });

    if (!res.ok) return null;

    const data = await res.json();
    const priceInfo = data?.dataBody;

    if (!priceInfo) return null;

    // KB시세는 만원 단위로 제공됨
    const dealPrice = Number(priceInfo.dealPrice ?? priceInfo.marketPrice ?? 0);
    const jeonsePrice = Number(priceInfo.jeonsePrice ?? priceInfo.leasePrice ?? 0);

    return {
      dealPrice,
      jeonsePrice,
      priceDate: String(priceInfo.priceDate ?? new Date().toISOString().slice(0, 10)),
    };
  } catch {
    return null;
  }
}

/**
 * PriceAdapter for KB real estate
 * ticker = kb_complex_id (e.g., "12345")
 */
export const kbAdapter: PriceAdapter = {
  async fetchPrice(ticker: string): Promise<PriceResult> {
    const priceInfo = await getKbPrice(ticker);

    if (!priceInfo || priceInfo.dealPrice === 0) {
      throw new Error(`KB: price not found for complex ${ticker}`);
    }

    // dealPrice는 만원 단위 → 원으로 변환
    return {
      price: priceInfo.dealPrice * 10000,
      currency: 'KRW',
      timestamp: new Date(),
      source: 'kb_real_estate',
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
