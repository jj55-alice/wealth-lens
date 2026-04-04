import type { AssetCategory, AssetClass } from '@/types/database';

/**
 * 자산 클래스 자동 분류
 *
 * 우선순위:
 * 1. ETF 이름 키워드 매칭
 * 2. 종목 섹터 정보 (국내/해외 구분)
 * 3. 비주식 자산 기본 매핑
 */

const ETF_KEYWORDS: { keywords: string[]; class: AssetClass }[] = [
  { keywords: ['미국채', '국채', '채권', 'bond', 'treasury'], class: 'bond' },
  {
    keywords: ['S&P500', '나스닥', 'NASDAQ', '미국', 'US', '선진국', '글로벌', 'MSCI'],
    class: 'foreign_equity',
  },
  {
    keywords: ['금', '골드', 'GOLD', '원유', 'OIL', '원자재', 'commodity', '은', 'SILVER'],
    class: 'commodity',
  },
  {
    keywords: ['머니마켓', 'MMF', '단기채', 'CD금리', '파킹'],
    class: 'cash_equiv',
  },
  {
    keywords: ['리츠', 'REIT', '부동산'],
    class: 'alternative',
  },
];

// 비주식 자산의 기본 매핑
const CATEGORY_CLASS_MAP: Partial<Record<AssetCategory, AssetClass>> = {
  real_estate: 'alternative',
  gold: 'commodity',
  crypto: 'alternative',
  cash: 'cash_equiv',
  pension: 'domestic_equity', // 기본값, 사용자 수정 가능
};

/**
 * 종목명/ETF 이름으로 자산 클래스를 추론합니다.
 * 매칭 실패 시 null 반환 (사용자 수동 설정 필요).
 */
export function classifyAsset(
  name: string,
  category: AssetCategory,
  ticker?: string | null,
): AssetClass | null {
  // 비주식 자산은 카테고리 기본 매핑
  if (category !== 'stock') {
    return CATEGORY_CLASS_MAP[category] ?? null;
  }

  // 주식/ETF: 이름 키워드 매칭
  const upperName = (name + ' ' + (ticker ?? '')).toUpperCase();
  for (const rule of ETF_KEYWORDS) {
    if (rule.keywords.some((kw) => upperName.includes(kw.toUpperCase()))) {
      return rule.class;
    }
  }

  // 해외 종목 추정: 영문 ticker만 있는 경우
  if (ticker && /^[A-Z]{1,5}$/.test(ticker)) {
    return 'foreign_equity';
  }

  // 기본: 국내주식
  return 'domestic_equity';
}
