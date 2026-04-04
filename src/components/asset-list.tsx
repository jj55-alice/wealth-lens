'use client';

import { Badge } from '@/components/ui/badge';
import { formatKRW } from '@/lib/format';
import type { AssetWithPrice, AssetCategory } from '@/types/database';

const CATEGORY_LABELS: Record<AssetCategory, string> = {
  real_estate: '부동산',
  stock: '주식',
  pension: '연금',
  gold: '금',
  crypto: '코인',
  cash: '현금',
  other: '기타',
};

const CATEGORY_ORDER: AssetCategory[] = [
  'real_estate',
  'stock',
  'pension',
  'gold',
  'crypto',
  'cash',
  'other',
];

interface Props {
  assets: AssetWithPrice[];
}

export function AssetList({ assets }: Props) {
  const grouped = new Map<AssetCategory, AssetWithPrice[]>();
  for (const a of assets) {
    const list = grouped.get(a.category) ?? [];
    list.push(a);
    grouped.set(a.category, list);
  }

  return (
    <div className="space-y-4">
      {CATEGORY_ORDER.filter((cat) => grouped.has(cat)).map((cat) => {
        const items = grouped.get(cat)!;
        const categoryTotal = items.reduce((s, a) => s + a.current_value, 0);

        return (
          <div key={cat}>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                {CATEGORY_LABELS[cat]}
              </h3>
              <span className="text-xs text-muted-foreground">
                {formatKRW(categoryTotal)}
              </span>
            </div>
            <div className="space-y-1">
              {items.map((asset) => (
                <div
                  key={asset.id}
                  className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div>
                      <p className="text-sm font-medium">{asset.name}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        {asset.brokerage && (
                          <span className="text-xs text-muted-foreground">
                            {asset.brokerage}
                          </span>
                        )}
                        {asset.quantity && asset.current_price && (
                          <span className="text-xs text-muted-foreground">
                            {asset.quantity}주 x{' '}
                            {asset.current_price.toLocaleString()}
                          </span>
                        )}
                        {asset.is_stale && (
                          <Badge variant="outline" className="text-[10px] px-1">
                            지연
                          </Badge>
                        )}
                        {asset.lease_expiry && (
                          <Badge variant="outline" className="text-[10px] px-1">
                            만기 {asset.lease_expiry}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                  <p className="text-sm font-medium tabular-nums">
                    {formatKRW(asset.current_value)}
                  </p>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
