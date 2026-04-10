/**
 * Pace decomposition — 하루치 순자산 변동을 "기여(contribution)" 와
 * "시장 변동(marketDrift)" 으로 쪼갠다.
 *
 *   Δvalue = a1*p1 - a0*p0
 *          = a0*(p1 - p0)     // marketDrift  (수량 변동 없다면 이 만큼만 움직임)
 *          + (a1 - a0)*p1     // contribution (오늘 가격으로 평가한 수량 변화)
 *
 * a0/p0 = 이전 스냅샷 수량/가격, a1/p1 = 오늘.
 * 둘 중 하나라도 NULL(레거시 행 또는 manual_value 자산) 이면 그 자산은
 * 분해하지 않고 `unknown` 으로 집계한다 — totalDelta 는 그래도 포함.
 */

export interface SnapshotRow {
  asset_id: string;
  value: number;
  quantity: number | null;
  price: number | null;
}

export interface AssetPace {
  asset_id: string;
  ticker: string | null;
  name: string | null;
  delta: number;
  contribution: number | null; // null → 분해 불가
  marketDrift: number | null;
  reason: 'decomposed' | 'missing_prior' | 'missing_quantity' | 'new_asset' | 'removed_asset';
}

export interface PaceSummary {
  from: string; // prior snapshot date
  to: string;   // today snapshot date
  totalDelta: number;
  contribution: number;     // 분해된 것만 합산
  marketDrift: number;      // 분해된 것만 합산
  unknownDelta: number;     // 분해 불가 자산들의 delta 합
  byAsset: AssetPace[];
}

interface AssetMeta {
  id: string;
  ticker: string | null;
  name: string | null;
}

/**
 * 순수 함수: 두 시점 스냅샷 맵과 자산 메타를 받아 분해 결과를 반환.
 */
export function decomposePace(params: {
  from: string;
  to: string;
  prior: Map<string, SnapshotRow>; // key: asset_id
  today: Map<string, SnapshotRow>;
  assets: AssetMeta[];
}): PaceSummary {
  const { from, to, prior, today, assets } = params;
  const byAsset: AssetPace[] = [];
  let totalDelta = 0;
  let contribution = 0;
  let marketDrift = 0;
  let unknownDelta = 0;

  for (const meta of assets) {
    const t = today.get(meta.id);
    const p = prior.get(meta.id);

    // 오늘 스냅샷이 없으면 건너뜀 (오늘 기준 집계)
    if (!t) continue;

    const delta = t.value - (p?.value ?? 0);
    totalDelta += delta;

    // 분해 가능 조건: prior·today 모두 quantity, price 가 있음
    if (!p) {
      byAsset.push({
        asset_id: meta.id,
        ticker: meta.ticker,
        name: meta.name,
        delta,
        contribution: null,
        marketDrift: null,
        reason: 'new_asset',
      });
      unknownDelta += delta;
      continue;
    }

    if (p.quantity == null || p.price == null || t.quantity == null || t.price == null) {
      byAsset.push({
        asset_id: meta.id,
        ticker: meta.ticker,
        name: meta.name,
        delta,
        contribution: null,
        marketDrift: null,
        reason: p.quantity == null || t.quantity == null ? 'missing_quantity' : 'missing_prior',
      });
      unknownDelta += delta;
      continue;
    }

    const mkt = p.quantity * (t.price - p.price);
    const contrib = (t.quantity - p.quantity) * t.price;

    byAsset.push({
      asset_id: meta.id,
      ticker: meta.ticker,
      name: meta.name,
      delta,
      contribution: contrib,
      marketDrift: mkt,
      reason: 'decomposed',
    });
    contribution += contrib;
    marketDrift += mkt;
  }

  // 오늘 스냅샷에 없지만 이전엔 있었던 자산 → 삭제된 자산, delta = -prior.value
  for (const [assetId, p] of prior) {
    if (today.has(assetId)) continue;
    const meta = assets.find((a) => a.id === assetId);
    const delta = -p.value;
    totalDelta += delta;
    unknownDelta += delta;
    byAsset.push({
      asset_id: assetId,
      ticker: meta?.ticker ?? null,
      name: meta?.name ?? null,
      delta,
      contribution: null,
      marketDrift: null,
      reason: 'removed_asset',
    });
  }

  return { from, to, totalDelta, contribution, marketDrift, unknownDelta, byAsset };
}
