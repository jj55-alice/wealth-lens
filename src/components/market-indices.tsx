'use client';

import { useEffect, useState, useCallback } from 'react';
import type { IndexData } from '@/lib/market/indices';

interface Props {
  /** 값이 바뀌면 강제 새로고침 (cache: 'no-store'). */
  refreshSignal?: number;
}

export function MarketIndices({ refreshSignal }: Props = {}) {
  const [indices, setIndices] = useState<IndexData[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback((noStore: boolean) => {
    fetch('/api/market-indices', noStore ? { cache: 'no-store' } : undefined)
      .then((r) => r.json())
      .then((data) => setIndices(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load(false);
  }, [load]);

  useEffect(() => {
    if (refreshSignal === undefined || refreshSignal === 0) return;
    load(true);
  }, [refreshSignal, load]);

  if (loading) {
    return (
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="min-w-[140px] h-16 rounded-lg bg-muted/50 animate-pulse" />
        ))}
      </div>
    );
  }

  if (indices.length === 0) return null;

  return (
    <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1" style={{ scrollbarWidth: 'none' }}>
      {indices.map((idx) => {
        const isUp = idx.direction === 'RISING';
        const isDown = idx.direction === 'FALLING';
        const color = isUp
          ? 'text-emerald-500'
          : isDown
            ? 'text-red-500'
            : 'text-muted-foreground';
        const bg = isUp
          ? 'bg-emerald-500/5 border-emerald-500/20'
          : isDown
            ? 'bg-red-500/5 border-red-500/20'
            : 'bg-muted/30 border-border';

        return (
          <div
            key={idx.code}
            className={`min-w-[140px] flex-shrink-0 rounded-lg border px-3 py-2.5 ${bg}`}
          >
            <div className="text-xs text-muted-foreground truncate">{idx.name}</div>
            <div className="text-sm font-semibold tabular-nums mt-0.5">{idx.price}</div>
            <div className={`text-xs tabular-nums ${color}`}>
              {isUp ? '+' : ''}{idx.changePercent}%
              <span className="ml-1 opacity-70">
                {isUp ? '▲' : isDown ? '▼' : '−'} {idx.change.replace(/^[+-]/, '')}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
