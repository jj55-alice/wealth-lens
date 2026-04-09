'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { formatKRW, formatPercent } from '@/lib/format';
import type { AssetWithPrice } from '@/types/database';

interface ReturnItem {
  id: string;
  name: string;
  ticker: string | null;
  category: string;
  brokerage: string | null;
  quantity: number;
  purchasePrice: number;
  currentPrice: number;
  currentValue: number;
  costBasis: number;
  returnAmount: number;
  returnPercent: number;
}

interface PeriodChange {
  label: string;
  daysAgo: number;
  /** 비교 기준 스냅샷 날짜 (YYYY-MM-DD) */
  snapshotDate: string;
  /** 그 시점의 순자산 (KRW) */
  snapshotNetWorth: number;
  /** 현재 순자산 대비 변동 금액 */
  delta: number;
  /** 변동률 (%) */
  deltaPct: number;
}

/**
 * 해당 period 에 대해 가장 가까운 과거 스냅샷을 찾는다.
 * snapshots 는 snapshot_date DESC 정렬 가정. 조건: snapshot_date ≤ target.
 * 없으면 null.
 */
function findNearestSnapshot(
  snapshots: { net_worth: number; snapshot_date: string }[],
  daysAgo: number,
): { net_worth: number; snapshot_date: string } | null {
  const target = new Date();
  target.setHours(0, 0, 0, 0);
  target.setDate(target.getDate() - daysAgo);
  for (const s of snapshots) {
    if (new Date(s.snapshot_date) <= target) return s;
  }
  return null;
}

export default function ReturnsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<ReturnItem[]>([]);
  const [missingCount, setMissingCount] = useState(0);
  const [missingAssets, setMissingAssets] = useState<{ id: string; name: string }[]>([]);
  const [totalCost, setTotalCost] = useState(0);
  const [totalValue, setTotalValue] = useState(0);
  const [periodChanges, setPeriodChanges] = useState<PeriodChange[]>([]);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/login'); return; }

      const { data: membership } = await supabase
        .from('household_members')
        .select('household_id')
        .eq('user_id', user.id)
        .single();
      if (!membership) { setLoading(false); return; }

      const { data: assets } = await supabase
        .from('assets')
        .select('*')
        .eq('household_id', membership.household_id)
        .not('ticker', 'is', null);

      if (!assets || assets.length === 0) { setLoading(false); return; }

      // Get prices
      const tickers = assets.map(a => a.ticker!);
      const { data: prices } = await supabase
        .from('price_cache')
        .select('ticker, price')
        .in('ticker', tickers);
      const priceMap = new Map((prices ?? []).map(p => [p.ticker, Number(p.price)]));

      const missing: { id: string; name: string }[] = [];
      const returnItems: ReturnItem[] = [];
      let costSum = 0;
      let valueSum = 0;

      for (const a of assets) {
        const currentPrice = priceMap.get(a.ticker!) ?? 0;
        const qty = Number(a.quantity) || 0;
        const pp = Number(a.purchase_price) || 0;

        if (!pp || !qty) {
          missing.push({ id: a.id, name: a.name });
          continue;
        }

        const currentValue = currentPrice * qty;
        const costBasis = pp * qty;
        const returnAmount = currentValue - costBasis;
        const returnPercent = costBasis > 0 ? (returnAmount / costBasis) * 100 : 0;

        costSum += costBasis;
        valueSum += currentValue;

        returnItems.push({
          id: a.id,
          name: a.name,
          ticker: a.ticker,
          category: a.category,
          brokerage: a.brokerage,
          quantity: qty,
          purchasePrice: pp,
          currentPrice,
          currentValue,
          costBasis,
          returnAmount,
          returnPercent,
        });
      }

      // Sort by return percent desc
      returnItems.sort((a, b) => b.returnPercent - a.returnPercent);

      setItems(returnItems);
      setMissingCount(missing.length);
      setMissingAssets(missing.slice(0, 10));
      setTotalCost(costSum);
      setTotalValue(valueSum);

      // 기간별 변동 — household_snapshots 기반 (시세연동 자산만이 아니라
      // 전체 순자산 기준). 가장 최근 snapshot 을 "현재" 기준으로 사용.
      const { data: snapshots } = await supabase
        .from('household_snapshots')
        .select('net_worth, snapshot_date')
        .eq('household_id', membership.household_id)
        .order('snapshot_date', { ascending: false });

      if (snapshots && snapshots.length > 0) {
        const current = Number(snapshots[0].net_worth);
        const normalized = snapshots.map(s => ({
          net_worth: Number(s.net_worth),
          snapshot_date: s.snapshot_date,
        }));
        const PERIODS: { label: string; days: number }[] = [
          { label: '1일 전 대비', days: 1 },
          { label: '1달 전 대비', days: 30 },
          { label: '3달 전 대비', days: 90 },
          { label: '6달 전 대비', days: 180 },
          { label: '1년 전 대비', days: 365 },
        ];
        const changes: PeriodChange[] = [];
        for (const p of PERIODS) {
          const past = findNearestSnapshot(normalized, p.days);
          if (!past || past.net_worth <= 0) continue;
          // 같은 snapshot 을 current 로 쓰는 경우(= 오늘 snapshot 하나뿐) 스킵
          if (past.snapshot_date === snapshots[0].snapshot_date) continue;
          const delta = current - past.net_worth;
          const deltaPct = (delta / past.net_worth) * 100;
          changes.push({
            label: p.label,
            daysAgo: p.days,
            snapshotDate: past.snapshot_date,
            snapshotNetWorth: past.net_worth,
            delta,
            deltaPct,
          });
        }
        setPeriodChanges(changes);
      }

      setLoading(false);
    }
    load();
  }, [router]);

  const totalReturn = totalValue - totalCost;
  const totalReturnPercent = totalCost > 0 ? (totalReturn / totalCost) * 100 : 0;

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <header className="border-b border-border px-6 py-4">
          <div className="mx-auto max-w-5xl"><Skeleton className="h-6 w-32" /></div>
        </header>
        <main className="mx-auto max-w-5xl px-6 py-8 space-y-6">
          <Skeleton className="h-32 w-full rounded-xl" />
          <Skeleton className="h-48 w-full rounded-xl" />
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border px-4 sm:px-6 py-3 sm:py-4">
        <div className="mx-auto max-w-5xl flex items-center gap-4">
          <Link href="/dashboard">
            <Button variant="ghost" size="sm">←</Button>
          </Link>
          <h1 className="text-lg font-semibold">수익률</h1>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-8 space-y-6">
        {/* 매수가 미입력 안내 */}
        {missingCount > 0 && (
          <Card className="border-amber-500/30">
            <CardContent className="py-4">
              <p className="text-sm text-amber-500 font-medium">
                {missingCount}개 자산의 매수가가 미입력 상태입니다
              </p>
              <div className="mt-2 space-y-1">
                {missingAssets.map(a => (
                  <Link
                    key={a.id}
                    href={`/assets/${a.id}/edit`}
                    className="block text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    → {a.name} 매수가 입력하기
                  </Link>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {items.length === 0 && missingCount > 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-3xl mb-3">📊</p>
              <p className="text-sm font-medium">수익률을 계산하려면 매수가를 입력해주세요</p>
              <p className="text-xs text-muted-foreground mt-1">
                위 자산들의 매수가를 입력하면 수익률이 표시됩니다
              </p>
            </CardContent>
          </Card>
        ) : items.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-3xl mb-3">📈</p>
              <p className="text-sm font-medium">시세 연동된 자산이 없습니다</p>
              <p className="text-xs text-muted-foreground mt-1">
                주식이나 코인을 등록하면 수익률이 표시됩니다
              </p>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* 전체 수익률 */}
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground">전체 포트폴리오 수익률</p>
                <p className={`text-3xl font-bold tracking-tight mt-1 ${totalReturn >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                  {totalReturn >= 0 ? '+' : ''}{formatKRW(totalReturn)}
                </p>
                <p className={`text-sm mt-0.5 ${totalReturn >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                  {totalReturn >= 0 ? '+' : ''}{totalReturnPercent.toFixed(2)}%
                </p>
                <div className="grid grid-cols-2 gap-4 mt-4 text-center">
                  <div>
                    <p className="text-xs text-muted-foreground">총 투자금</p>
                    <p className="text-sm font-semibold">{formatKRW(totalCost)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">현재 평가액</p>
                    <p className="text-sm font-semibold">{formatKRW(totalValue)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* 기간별 변동 — household_snapshots 기반. 해당 period 스냅샷이 없으면 행 자체를 skip. */}
            {periodChanges.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">기간별 변동</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {periodChanges.map((p) => (
                      <div key={p.daysAgo} className="flex items-start justify-between">
                        <div>
                          <p className="text-sm font-medium">{p.label}</p>
                          <p className="text-[10px] text-muted-foreground mt-0.5">
                            {p.snapshotDate} · {formatKRW(p.snapshotNetWorth)}
                          </p>
                        </div>
                        <div className="text-right">
                          <p
                            className={`text-sm font-semibold tabular-nums ${
                              p.delta >= 0 ? 'text-emerald-500' : 'text-red-500'
                            }`}
                          >
                            {p.delta >= 0 ? '+' : ''}
                            {formatKRW(p.delta)}
                          </p>
                          <p
                            className={`text-[10px] tabular-nums ${
                              p.delta >= 0 ? 'text-emerald-500' : 'text-red-500'
                            }`}
                          >
                            {p.delta >= 0 ? '+' : ''}
                            {p.deltaPct.toFixed(2)}%
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* 종목별 수익률 */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">종목별 수익률</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {items.map((item, i) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-muted-foreground w-5">{i + 1}</span>
                        <div>
                          <p className="text-sm font-medium">{item.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {item.ticker} · {item.quantity}{item.category === 'crypto' ? '개' : '주'}
                            {item.brokerage ? ` · ${item.brokerage}` : ''}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className={`text-sm font-semibold ${item.returnAmount >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                          {item.returnAmount >= 0 ? '+' : ''}{formatKRW(item.returnAmount)}
                        </p>
                        <p className={`text-xs ${item.returnAmount >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                          {item.returnAmount >= 0 ? '+' : ''}{item.returnPercent.toFixed(2)}%
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </main>
    </div>
  );
}
