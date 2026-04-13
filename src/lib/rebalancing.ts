import type { AssetWithPrice } from '@/types/database';

export interface RebalancingTarget {
  asset_class: string;
  target_ratio: number;
}

export interface AllocationItem {
  assetClass: string;
  currentValue: number;
  currentRatio: number;
  targetRatio: number;
  diffRatio: number;
  diffAmount: number;
  isStale: boolean;
  staleRatio: number;
}

export interface RebalancingSuggestion {
  assetClass: string;
  action: 'sell' | 'buy' | 'hold';
  amount: number;
  currentRatio: number;
  targetRatio: number;
  diffPercent: number;
}

export type RebalancingStatus = 'balanced' | 'needs_adjustment' | 'urgent';

export interface TradeGuide {
  assetClass: string;
  ticker: string;
  name: string;
  action: 'sell' | 'buy';
  shares: number;
  amount: number;
  currentPrice: number;
  currentValue: number;
  weight: number; // 해당 클래스 내 비중 (%)
}

const CLASS_LABELS: Record<string, string> = {
  domestic_equity: '국내주식',
  foreign_equity: '해외주식',
  bond: '채권',
  commodity: '원자재',
  crypto: '크립토',
  cash_equiv: '현금성',
};

export { CLASS_LABELS };

/**
 * 유동 자산만 필터 (부동산 제외)
 */
export function filterLiquidAssets(assets: AssetWithPrice[]): AssetWithPrice[] {
  return assets.filter(a => a.asset_class !== 'real_estate' && a.asset_class !== 'alternative');
}

/**
 * 현재 배분 vs 목표 배분을 비교하고 제안을 생성합니다.
 */
export function computeRebalancing(
  assets: AssetWithPrice[],
  targets: RebalancingTarget[],
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _exchangeRate?: number | null,
): { allocations: AllocationItem[]; suggestions: RebalancingSuggestion[]; status: RebalancingStatus; totalLiquid: number; hasStaleWarning: boolean } {
  const liquid = filterLiquidAssets(assets);

  // current_value는 항상 KRW로 정규화되어 있음 (price_cache가 USD→KRW 변환 후 저장).
  // 따라서 환율 곱셈 없이 그대로 합산. 대시보드와 동일한 처리.
  const totalLiquid = liquid.reduce((sum, a) => sum + a.current_value, 0);

  if (totalLiquid === 0 || targets.length === 0) {
    return { allocations: [], suggestions: [], status: 'balanced', totalLiquid, hasStaleWarning: false };
  }

  // 클래스별 합산
  const classValues = new Map<string, { value: number; staleCount: number; totalCount: number }>();

  for (const a of liquid) {
    const cls = a.asset_class ?? 'cash_equiv';
    const prev = classValues.get(cls) ?? { value: 0, staleCount: 0, totalCount: 0 };
    const value = a.current_value;
    classValues.set(cls, {
      value: prev.value + value,
      staleCount: prev.staleCount + (a.is_stale ? 1 : 0),
      totalCount: prev.totalCount + 1,
    });
  }

  const allocations: AllocationItem[] = [];
  const suggestions: RebalancingSuggestion[] = [];
  let hasStaleWarning = false;
  let maxDiffPercent = 0;

  for (const t of targets) {
    const cv = classValues.get(t.asset_class) ?? { value: 0, staleCount: 0, totalCount: 0 };
    const currentRatio = totalLiquid > 0 ? (cv.value / totalLiquid) * 100 : 0;
    const diffRatio = currentRatio - t.target_ratio;
    const diffAmount = (diffRatio / 100) * totalLiquid;
    const staleRatio = cv.totalCount > 0 ? cv.staleCount / cv.totalCount : 0;
    const isStale = staleRatio >= 0.3;

    if (isStale) hasStaleWarning = true;
    if (Math.abs(diffRatio) > maxDiffPercent) maxDiffPercent = Math.abs(diffRatio);

    allocations.push({
      assetClass: t.asset_class,
      currentValue: cv.value,
      currentRatio,
      targetRatio: t.target_ratio,
      diffRatio,
      diffAmount,
      isStale,
      staleRatio,
    });

    // 임계값: 1%p 미만 차이는 무시
    if (Math.abs(diffRatio) < 1) {
      suggestions.push({
        assetClass: t.asset_class,
        action: 'hold',
        amount: 0,
        currentRatio,
        targetRatio: t.target_ratio,
        diffPercent: diffRatio,
      });
    } else {
      suggestions.push({
        assetClass: t.asset_class,
        action: diffRatio > 0 ? 'sell' : 'buy',
        amount: Math.abs(diffAmount),
        currentRatio,
        targetRatio: t.target_ratio,
        diffPercent: diffRatio,
      });
    }
  }

  // 가장 큰 갭 기준으로 정렬 (매도/매수 우선)
  suggestions.sort((a, b) => Math.abs(b.diffPercent) - Math.abs(a.diffPercent));

  // 상태 판정: 3%p 기준 균형, 7%p 기준 긴급
  let status: RebalancingStatus = 'balanced';
  if (maxDiffPercent >= 7) status = 'urgent';
  else if (maxDiffPercent >= 3) status = 'needs_adjustment';

  return { allocations, suggestions, status, totalLiquid, hasStaleWarning };
}

/**
 * 자산군별 매매 금액을 종목 단위로 분해합니다.
 * 매도: 비중 높은 종목부터, 매수: 비중 낮은 종목부터.
 */
export function computeTradeGuides(
  assets: AssetWithPrice[],
  suggestions: RebalancingSuggestion[],
): TradeGuide[] {
  const liquid = filterLiquidAssets(assets);
  const guides: TradeGuide[] = [];

  for (const s of suggestions) {
    if (s.action === 'hold') continue;

    // 해당 클래스의 종목들
    const classAssets = liquid
      .filter(a => (a.asset_class ?? 'cash_equiv') === s.assetClass)
      .filter(a => a.ticker && a.current_value > 0);

    if (classAssets.length === 0) {
      // 매수인데 해당 클래스에 종목이 없음 → 클래스 레벨 제안만 표시
      continue;
    }

    const classTotal = classAssets.reduce((sum, a) => sum + a.current_value, 0);
    let remaining = s.amount;

    if (s.action === 'sell') {
      // 비중 높은 종목부터 매도
      const sorted = [...classAssets].sort((a, b) => b.current_value - a.current_value);
      for (const asset of sorted) {
        if (remaining <= 0) break;
        const price = asset.current_value / (asset.quantity ? Number(asset.quantity) : 1);
        if (price <= 0) continue;
        const sellAmount = Math.min(remaining, asset.current_value);
        const shares = Math.floor(sellAmount / price);
        if (shares <= 0) continue;
        const actualAmount = shares * price;
        guides.push({
          assetClass: s.assetClass,
          ticker: asset.ticker ?? '',
          name: asset.name,
          action: 'sell',
          shares,
          amount: actualAmount,
          currentPrice: price,
          currentValue: asset.current_value,
          weight: classTotal > 0 ? (asset.current_value / classTotal) * 100 : 0,
        });
        remaining -= actualAmount;
      }
    } else {
      // 매수: 비중 낮은 종목부터 (목표에 가까워지도록)
      const sorted = [...classAssets].sort((a, b) => a.current_value - b.current_value);
      // 균등 분배 후 종목별 주수 계산
      const perAsset = remaining / sorted.length;
      for (const asset of sorted) {
        if (remaining <= 0) break;
        const price = asset.current_value / (asset.quantity ? Number(asset.quantity) : 1);
        if (price <= 0) continue;
        const buyAmount = Math.min(perAsset, remaining);
        const shares = Math.floor(buyAmount / price);
        if (shares <= 0) continue;
        const actualAmount = shares * price;
        guides.push({
          assetClass: s.assetClass,
          ticker: asset.ticker ?? '',
          name: asset.name,
          action: 'buy',
          shares,
          amount: actualAmount,
          currentPrice: price,
          currentValue: asset.current_value,
          weight: classTotal > 0 ? (asset.current_value / classTotal) * 100 : 0,
        });
        remaining -= actualAmount;
      }
    }
  }

  return guides;
}

/**
 * 프리셋 목표 비율
 */
export const PRESETS: Record<string, RebalancingTarget[]> = {
  conservative: [
    { asset_class: 'domestic_equity', target_ratio: 30 },
    { asset_class: 'foreign_equity', target_ratio: 20 },
    { asset_class: 'bond', target_ratio: 20 },
    { asset_class: 'commodity', target_ratio: 10 },
    { asset_class: 'crypto', target_ratio: 5 },
    { asset_class: 'cash_equiv', target_ratio: 15 },
  ],
  balanced: [
    { asset_class: 'domestic_equity', target_ratio: 25 },
    { asset_class: 'foreign_equity', target_ratio: 20 },
    { asset_class: 'bond', target_ratio: 15 },
    { asset_class: 'commodity', target_ratio: 10 },
    { asset_class: 'crypto', target_ratio: 10 },
    { asset_class: 'cash_equiv', target_ratio: 20 },
  ],
  aggressive: [
    { asset_class: 'domestic_equity', target_ratio: 30 },
    { asset_class: 'foreign_equity', target_ratio: 25 },
    { asset_class: 'bond', target_ratio: 5 },
    { asset_class: 'commodity', target_ratio: 5 },
    { asset_class: 'crypto', target_ratio: 20 },
    { asset_class: 'cash_equiv', target_ratio: 15 },
  ],
};
