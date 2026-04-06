'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { createClient } from '@/lib/supabase/client';
import { formatKRW } from '@/lib/format';
import type { AssetWithPrice } from '@/types/database';

interface Props {
  householdId: string;
  currentNetWorth: number;
  assets: AssetWithPrice[];
}

interface TopMover {
  name: string;
  change: number;
}

export function MonthlyChange({ householdId, currentNetWorth, assets }: Props) {
  const [lastMonthNetWorth, setLastMonthNetWorth] = useState<number | null>(null);
  const [topGainers, setTopGainers] = useState<TopMover[]>([]);
  const [topLosers, setTopLosers] = useState<TopMover[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const supabase = createClient();

      // 1달 전 스냅샷
      const oneMonthAgo = new Date();
      oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
      const targetDate = oneMonthAgo.toISOString().split('T')[0];

      const { data: snapshot } = await supabase
        .from('household_snapshots')
        .select('net_worth')
        .eq('household_id', householdId)
        .lte('snapshot_date', targetDate)
        .order('snapshot_date', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (snapshot) {
        setLastMonthNetWorth(Number(snapshot.net_worth));
      }

      // 자산별 1달 전 스냅샷으로 변동 계산
      const assetIds = assets.map(a => a.id);
      if (assetIds.length > 0) {
        const { data: assetSnapshots } = await supabase
          .from('asset_snapshots')
          .select('asset_id, value')
          .in('asset_id', assetIds)
          .lte('snapshot_date', targetDate)
          .order('snapshot_date', { ascending: false });

        if (assetSnapshots) {
          // 각 자산의 가장 최근(1달전) 스냅샷
          const lastValueMap = new Map<string, number>();
          for (const s of assetSnapshots) {
            if (!lastValueMap.has(s.asset_id)) {
              lastValueMap.set(s.asset_id, Number(s.value));
            }
          }

          const movers: TopMover[] = [];
          for (const a of assets) {
            const lastValue = lastValueMap.get(a.id);
            if (lastValue != null) {
              movers.push({
                name: a.name,
                change: a.current_value - lastValue,
              });
            }
          }

          movers.sort((a, b) => b.change - a.change);
          setTopGainers(movers.filter(m => m.change > 0).slice(0, 3));
          setTopLosers(movers.filter(m => m.change < 0).sort((a, b) => a.change - b.change).slice(0, 3));
        }
      }

      setLoading(false);
    }
    load();
  }, [householdId, assets, currentNetWorth]);

  if (loading || lastMonthNetWorth === null) return null;

  const change = currentNetWorth - lastMonthNetWorth;
  const changePercent = lastMonthNetWorth > 0 ? (change / lastMonthNetWorth) * 100 : 0;
  const isPositive = change >= 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">이번 달 순자산 변화</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-baseline gap-2">
          <span className={`text-2xl font-bold ${isPositive ? 'text-emerald-500' : 'text-red-500'}`}>
            {isPositive ? '+' : ''}{formatKRW(change)}
          </span>
          <span className={`text-sm ${isPositive ? 'text-emerald-500' : 'text-red-500'}`}>
            ({isPositive ? '+' : ''}{changePercent.toFixed(1)}%)
          </span>
        </div>

        {(topGainers.length > 0 || topLosers.length > 0) && (
          <div className="grid grid-cols-2 gap-4 text-xs">
            {topGainers.length > 0 && (
              <div>
                <p className="text-muted-foreground mb-1">가장 많이 오른</p>
                {topGainers.map((m, i) => (
                  <p key={i} className="text-emerald-500">
                    {m.name} +{formatKRW(m.change)}
                  </p>
                ))}
              </div>
            )}
            {topLosers.length > 0 && (
              <div>
                <p className="text-muted-foreground mb-1">가장 많이 내린</p>
                {topLosers.map((m, i) => (
                  <p key={i} className="text-red-500">
                    {m.name} {formatKRW(m.change)}
                  </p>
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
