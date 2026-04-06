import { describe, it, expect } from 'vitest';
import { computeRebalancing, filterLiquidAssets, PRESETS } from '@/lib/rebalancing';
import type { AssetWithPrice } from '@/types/database';

function mockAsset(overrides: Partial<AssetWithPrice> & { current_value: number }): AssetWithPrice {
  return {
    id: Math.random().toString(),
    household_id: 'h1',
    owner_user_id: 'u1',
    category: 'stock',
    subcategory: null,
    ownership: 'personal',
    name: 'Test',
    ticker: null,
    quantity: null,
    manual_value: null,
    price_source: 'manual',
    asset_class: 'domestic_equity',
    brokerage: null,
    address: null,
    purchase_price: null,
    kb_complex_id: null,
    kb_estimated_value: null,
    kb_estimated_at: null,
    lease_expiry: null,
    created_at: '',
    updated_at: '',
    current_price: null,
    current_value: 0,
    price_updated_at: null,
    is_stale: false,
    ...overrides,
  } as AssetWithPrice;
}

describe('filterLiquidAssets', () => {
  it('부동산과 대안투자를 제외한다', () => {
    const assets = [
      mockAsset({ asset_class: 'domestic_equity', current_value: 100 }),
      mockAsset({ asset_class: 'real_estate', current_value: 500 }),
      mockAsset({ asset_class: 'alternative', current_value: 50 }),
      mockAsset({ asset_class: 'crypto', current_value: 30 }),
    ];
    const liquid = filterLiquidAssets(assets);
    expect(liquid).toHaveLength(2);
    expect(liquid.map(a => a.asset_class)).toEqual(['domestic_equity', 'crypto']);
  });
});

describe('computeRebalancing', () => {
  const targets = [
    { asset_class: 'domestic_equity', target_ratio: 50 },
    { asset_class: 'crypto', target_ratio: 50 },
  ];

  it('균형 상태: 현재 배분이 목표에 가까우면 balanced', () => {
    const assets = [
      mockAsset({ asset_class: 'domestic_equity', current_value: 500 }),
      mockAsset({ asset_class: 'crypto', current_value: 500 }),
    ];
    const result = computeRebalancing(assets, targets);
    expect(result.status).toBe('balanced');
    expect(result.suggestions.every(s => s.action === 'hold')).toBe(true);
  });

  it('조정 필요: 5%p 차이', () => {
    const assets = [
      mockAsset({ asset_class: 'domestic_equity', current_value: 550 }),
      mockAsset({ asset_class: 'crypto', current_value: 450 }),
    ];
    const result = computeRebalancing(assets, targets);
    expect(result.status).toBe('needs_adjustment');
  });

  it('긴급: 10%p 이상 차이', () => {
    const assets = [
      mockAsset({ asset_class: 'domestic_equity', current_value: 800 }),
      mockAsset({ asset_class: 'crypto', current_value: 200 }),
    ];
    const result = computeRebalancing(assets, targets);
    expect(result.status).toBe('urgent');
    const sell = result.suggestions.find(s => s.action === 'sell');
    expect(sell?.assetClass).toBe('domestic_equity');
    const buy = result.suggestions.find(s => s.action === 'buy');
    expect(buy?.assetClass).toBe('crypto');
  });

  it('자산 0개: 빈 결과', () => {
    const result = computeRebalancing([], targets);
    expect(result.status).toBe('balanced');
    expect(result.suggestions).toHaveLength(0);
  });

  it('목표 0개: 빈 결과', () => {
    const assets = [mockAsset({ current_value: 100 })];
    const result = computeRebalancing(assets, []);
    expect(result.suggestions).toHaveLength(0);
  });

  it('stale 30%+이면 경고', () => {
    const assets = [
      mockAsset({ asset_class: 'domestic_equity', current_value: 500, is_stale: true }),
      mockAsset({ asset_class: 'domestic_equity', current_value: 200, is_stale: true }),
      mockAsset({ asset_class: 'domestic_equity', current_value: 100, is_stale: false }),
      mockAsset({ asset_class: 'crypto', current_value: 200 }),
    ];
    const result = computeRebalancing(assets, targets);
    expect(result.hasStaleWarning).toBe(true);
  });

  it('환율 적용: USD 자산은 KRW로 환산', () => {
    const assets = [
      mockAsset({ asset_class: 'domestic_equity', current_value: 500, price_source: 'krx' }),
      mockAsset({ asset_class: 'crypto', current_value: 10, price_source: 'yahoo_finance' }),
    ];
    // 환율 50이면 10 * 50 = 500 → 50:50
    const result = computeRebalancing(assets, targets, 50);
    expect(result.status).toBe('balanced');
    expect(result.totalLiquid).toBe(1000);
  });

  it('매도/매수 금액이 정확하다', () => {
    const assets = [
      mockAsset({ asset_class: 'domestic_equity', current_value: 700 }),
      mockAsset({ asset_class: 'crypto', current_value: 300 }),
    ];
    const result = computeRebalancing(assets, targets);
    const sell = result.suggestions.find(s => s.action === 'sell');
    expect(sell?.amount).toBe(200); // 700-500=200 매도
    const buy = result.suggestions.find(s => s.action === 'buy');
    expect(buy?.amount).toBe(200); // 500-300=200 매수
  });
});

describe('PRESETS', () => {
  it('모든 프리셋 합계 100%', () => {
    for (const [name, targets] of Object.entries(PRESETS)) {
      const sum = targets.reduce((s, t) => s + t.target_ratio, 0);
      expect(sum, `${name} preset should sum to 100`).toBe(100);
    }
  });
});
