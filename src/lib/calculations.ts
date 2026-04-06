import type { AssetWithPrice } from '@/types/database';

/**
 * 자산의 수익률을 계산합니다.
 *
 * - 주식/코인/금: (현재가 - 매수가) / 매수가 * 100
 * - 부동산: (현재 시세 - 매수가) / 매수가 * 100 (quantity 무관)
 * - 매수가 없으면 null 반환
 */
export function calculateReturn(asset: AssetWithPrice): {
  returnRate: number | null;
  returnAmount: number | null;
} {
  const pp = asset.purchase_price;
  if (!pp || pp <= 0) return { returnRate: null, returnAmount: null };

  // 부동산은 quantity 없이 manual_value vs purchase_price 비교
  if (asset.category === 'real_estate' && asset.manual_value) {
    const mv = Number(asset.manual_value);
    const returnAmount = mv - pp;
    const returnRate = (returnAmount / pp) * 100;
    return { returnRate, returnAmount };
  }

  // 주식/코인/금 등: 현재가 기반
  const currentPrice = asset.current_price ?? 0;
  if (currentPrice <= 0) return { returnRate: null, returnAmount: null };

  const qty = asset.quantity ?? 1;
  const returnRate = ((currentPrice - pp) / pp) * 100;
  const returnAmount = (currentPrice - pp) * Number(qty);

  return { returnRate, returnAmount };
}

/**
 * 자산 클래스별 배분 비율을 계산합니다.
 */
export function calculateAllocation(
  assets: AssetWithPrice[],
): { className: string; value: number; ratio: number }[] {
  const classTotals = new Map<string, number>();
  let total = 0;

  for (const a of assets) {
    const cls = a.asset_class ?? 'alternative';
    const cur = classTotals.get(cls) ?? 0;
    classTotals.set(cls, cur + a.current_value);
    total += a.current_value;
  }

  return Array.from(classTotals.entries())
    .map(([className, value]) => ({
      className,
      value,
      ratio: total > 0 ? (value / total) * 100 : 0,
    }))
    .sort((a, b) => b.value - a.value);
}
