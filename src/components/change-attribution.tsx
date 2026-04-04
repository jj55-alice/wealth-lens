'use client';

import { formatKRW } from '@/lib/format';
import type { AssetWithPrice } from '@/types/database';

interface Props {
  assets: AssetWithPrice[];
  // previousValues would come from snapshots in production
  // For MVP, we show current allocation breakdown instead
}

export function ChangeAttribution({ assets }: Props) {
  if (assets.length === 0) return null;

  // Sort assets by current value, show top contributors
  const sorted = [...assets]
    .filter((a) => a.current_value > 0)
    .sort((a, b) => b.current_value - a.current_value)
    .slice(0, 5);

  const total = assets.reduce((s, a) => s + a.current_value, 0);

  return (
    <div className="space-y-2">
      {sorted.map((asset) => {
        const pct = total > 0 ? ((asset.current_value / total) * 100).toFixed(1) : '0';
        return (
          <div key={asset.id} className="flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs font-medium truncate">{asset.name}</p>
                <p className="text-xs text-muted-foreground ml-2">{pct}%</p>
              </div>
              <div className="w-full h-1 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-500 rounded-full"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
            <p className="text-xs font-medium tabular-nums w-20 text-right">
              {formatKRW(asset.current_value)}
            </p>
          </div>
        );
      })}
    </div>
  );
}
