'use client';

import { Badge } from '@/components/ui/badge';
import type { AssetWithPrice } from '@/types/database';

interface Props {
  assets: AssetWithPrice[];
}

function getDaysUntil(dateStr: string): number {
  const target = new Date(dateStr);
  const now = new Date();
  return Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

function getAlertLevel(days: number): { color: string; label: string } {
  if (days <= 30) return { color: 'bg-red-500/20 text-red-400', label: '긴급' };
  if (days <= 90) return { color: 'bg-amber-500/20 text-amber-400', label: '주의' };
  if (days <= 180) return { color: 'bg-blue-500/20 text-blue-400', label: '알림' };
  return { color: 'bg-muted text-muted-foreground', label: '' };
}

export function LeaseAlerts({ assets }: Props) {
  const leaseAssets = assets
    .filter((a) => a.lease_expiry && a.subcategory === 'jeonse')
    .map((a) => ({
      ...a,
      daysUntil: getDaysUntil(a.lease_expiry!),
    }))
    .filter((a) => a.daysUntil > 0 && a.daysUntil <= 365)
    .sort((a, b) => a.daysUntil - b.daysUntil);

  if (leaseAssets.length === 0) return null;

  return (
    <div className="space-y-2">
      {leaseAssets.map((asset) => {
        const alert = getAlertLevel(asset.daysUntil);
        return (
          <div
            key={asset.id}
            className="flex items-center justify-between py-2 px-3 rounded-lg border border-border"
          >
            <div>
              <p className="text-sm font-medium">{asset.name}</p>
              <p className="text-xs text-muted-foreground">
                만기 {asset.lease_expiry} (D-{asset.daysUntil})
              </p>
            </div>
            {alert.label && (
              <Badge variant="secondary" className={`text-xs ${alert.color}`}>
                {alert.label}
              </Badge>
            )}
          </div>
        );
      })}
    </div>
  );
}
