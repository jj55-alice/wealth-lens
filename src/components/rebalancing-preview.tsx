'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatKRW } from '@/lib/format';
import { computeRebalancing, filterLiquidAssets, CLASS_LABELS } from '@/lib/rebalancing';
import type { RebalancingTarget, RebalancingStatus } from '@/lib/rebalancing';
import type { AssetWithPrice } from '@/types/database';

interface Props {
  assets: AssetWithPrice[];
}

const STATUS_CONFIG: Record<RebalancingStatus, { label: string; color: string }> = {
  balanced: { label: '균형', color: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' },
  needs_adjustment: { label: '조정 필요', color: 'bg-amber-500/10 text-amber-500 border-amber-500/20' },
  urgent: { label: '긴급', color: 'bg-red-500/10 text-red-500 border-red-500/20' },
};

export function RebalancingPreview({ assets }: Props) {
  const [targets, setTargets] = useState<RebalancingTarget[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetch('/api/rebalancing')
      .then(r => r.json())
      .then(d => setTargets(d.targets ?? []))
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  if (!loaded) return null;

  // 목표 미설정
  if (targets.length === 0) {
    return (
      <Link href="/rebalancing">
        <Card className="hover:bg-muted/30 transition-colors cursor-pointer">
          <CardContent className="py-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">리밸런싱</p>
              <p className="text-xs text-muted-foreground">목표 배분을 설정하고 포트폴리오를 최적화하세요</p>
            </div>
            <span className="text-muted-foreground text-sm">&rarr;</span>
          </CardContent>
        </Card>
      </Link>
    );
  }

  const result = computeRebalancing(assets, targets);
  const active = result.suggestions.filter(s => s.action !== 'hold');
  const top2 = active.slice(0, 2);
  const config = STATUS_CONFIG[result.status];

  return (
    <Link href="/rebalancing">
      <Card className="hover:bg-muted/30 transition-colors cursor-pointer">
        <CardContent className="py-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium">리밸런싱</p>
            <Badge variant="outline" className={config.color}>{config.label}</Badge>
          </div>

          {active.length === 0 ? (
            <p className="text-xs text-emerald-500">포트폴리오가 목표에 가깝습니다</p>
          ) : (
            <div className="space-y-1">
              {top2.map(s => (
                <div key={s.assetClass} className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">{CLASS_LABELS[s.assetClass]}</span>
                  <span className={`tabular-nums font-medium ${s.action === 'sell' ? 'text-red-500' : 'text-emerald-500'}`}>
                    {s.action === 'sell' ? '−' : '+'}{formatKRW(s.amount)} {s.action === 'sell' ? '매도' : '매수'}
                  </span>
                </div>
              ))}
              {active.length > 2 && (
                <p className="text-xs text-muted-foreground">외 {active.length - 2}개 자산군</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}
