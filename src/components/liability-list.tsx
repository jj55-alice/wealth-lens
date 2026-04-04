'use client';

import { formatKRW } from '@/lib/format';
import type { Liability } from '@/types/database';

interface Props {
  liabilities: Liability[];
}

export function LiabilityList({ liabilities }: Props) {
  return (
    <div className="space-y-1">
      {liabilities.map((liability) => (
        <div
          key={liability.id}
          className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-muted/50 transition-colors"
        >
          <div>
            <p className="text-sm font-medium">{liability.name}</p>
            <div className="flex items-center gap-2 mt-0.5">
              {liability.interest_rate && (
                <span className="text-xs text-muted-foreground">
                  금리 {liability.interest_rate}%
                </span>
              )}
            </div>
          </div>
          <p className="text-sm font-medium tabular-nums text-red-500">
            -{formatKRW(liability.balance)}
          </p>
        </div>
      ))}
    </div>
  );
}
