import type { PriceAdapter, PriceResult } from './types';

// 부동산 시세 조회
// 직방 API로 아파트 검색, 시세는 수동 입력 또는 추후 공공데이터 API 연동
const ZIGBANG_API = 'https://apis.zigbang.com';
const USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36';

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
 * 직방 API로 아파트 단지를 검색합니다.
 * (기존 KB API 대체 — KB API 엔드포인트 폐쇄됨 2026-04)
 */
export async function searchKbComplex(query: string): Promise<KbComplex[]> {
  try {
    const res = await fetch(
      `${ZIGBANG_API}/v2/search?q=${encodeURIComponent(query)}&type=apt`,
      { headers: { 'User-Agent': USER_AGENT } }
    );

    if (!res.ok) return [];

    const data = await res.json();
    const items = data?.items ?? [];

    return items
      .filter((item: Record<string, unknown>) => item.type === 'apartment')
      .slice(0, 10)
      .map((item: Record<string, unknown>) => {
        const source = (item._source ?? {}) as Record<string, unknown>;
        return {
          complexId: String(item.id ?? ''),
          complexName: String(item.name ?? ''),
          address: String(item.description ?? ''),
          totalHousehold: Number(source.household ?? 0),
        };
      });
  } catch {
    return [];
  }
}

/**
 * 직방 API로 단지 상세 정보를 가져옵니다.
 * 면적 정보는 직방에서 직접 제공하지 않으므로 빈 배열 반환.
 */
export async function getKbAreas(_complexId: string): Promise<KbArea[]> {
  // 직방 API에서는 면적별 조회를 지원하지 않음
  // 추후 공공데이터 API로 면적 정보 연동 예정
  return [];
}

/**
 * 시세 조회 — 현재 자동 시세 조회 불가 (KB API 폐쇄, 직방은 시세 비공개)
 * 추후 공공데이터 실거래가 API (data.go.kr) 연동 예정
 */
export async function getKbPrice(_complexId: string, _areaId?: string): Promise<KbPriceInfo | null> {
  // KB API 폐쇄로 자동 시세 조회 불가
  // 공공데이터 실거래가 API 키 발급 후 연동 예정
  return null;
}

/**
 * PriceAdapter for real estate (currently manual-only)
 * ticker = complex_id (e.g., "1456")
 */
export const kbAdapter: PriceAdapter = {
  async fetchPrice(_ticker: string): Promise<PriceResult> {
    // 자동 시세 조회 불가 — manual_value 또는 kb_estimated_value 사용
    throw new Error('Real estate auto-pricing not available (KB API deprecated)');
  },

  async fetchBatch(tickers: string[]): Promise<Map<string, PriceResult>> {
    const results = new Map<string, PriceResult>();
    // 자동 시세 조회 불가 — 빈 결과 반환
    void tickers;
    return results;
  },
};
