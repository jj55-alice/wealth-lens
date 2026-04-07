'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { AllocationPieChart } from '@/components/allocation-pie-chart';
import { formatKRW } from '@/lib/format';
import { computeRebalancing, filterLiquidAssets, CLASS_LABELS, PRESETS } from '@/lib/rebalancing';
import type { RebalancingTarget, RebalancingSuggestion, RebalancingStatus } from '@/lib/rebalancing';
import type { AssetWithPrice } from '@/types/database';
import { getHouseholdAssets } from '@/lib/queries';

export default function RebalancingPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [assets, setAssets] = useState<AssetWithPrice[]>([]);
  const [targets, setTargets] = useState<RebalancingTarget[]>([]);
  const [suggestions, setSuggestions] = useState<RebalancingSuggestion[]>([]);
  const [status, setStatus] = useState<RebalancingStatus>('balanced');
  const [totalLiquid, setTotalLiquid] = useState(0);
  const [hasStaleWarning, setHasStaleWarning] = useState(false);
  const [exchangeRate, setExchangeRate] = useState<number | null>(null);

  const load = useCallback(async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push('/login'); return; }

    const { data: membership } = await supabase
      .from('household_members')
      .select('household_id')
      .eq('user_id', user.id)
      .maybeSingle();
    if (!membership) { setLoading(false); return; }

    // 자산 + 목표 + 환율 병렬 조회
    const [fetchedAssets, targetsRes, rateRes] = await Promise.all([
      getHouseholdAssets(supabase, membership.household_id),
      fetch('/api/rebalancing').then(r => r.json()),
      fetch('/api/exchange-rate').then(r => r.json()).catch(() => ({ rate: null })),
    ]);

    setAssets(fetchedAssets);
    setTargets(targetsRes.targets ?? []);
    setExchangeRate(rateRes.rate ?? null);

    // 리밸런싱 계산
    if (targetsRes.targets?.length > 0) {
      const result = computeRebalancing(fetchedAssets, targetsRes.targets, rateRes.rate);
      setSuggestions(result.suggestions);
      setStatus(result.status);
      setTotalLiquid(result.totalLiquid);
      setHasStaleWarning(result.hasStaleWarning);
    }

    setLoading(false);
  }, [router]);

  useEffect(() => { load(); }, [load]);

  // 마지막 확인 날짜 (localStorage)
  const lastChecked = typeof window !== 'undefined'
    ? localStorage.getItem('rebalancing_last_checked')
    : null;
  const daysSinceCheck = lastChecked
    ? Math.floor((Date.now() - new Date(lastChecked).getTime()) / (1000 * 60 * 60 * 24))
    : null;

  function handleRefresh() {
    if (typeof window !== 'undefined') {
      localStorage.setItem('rebalancing_last_checked', new Date().toISOString());
    }
    load();
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <header className="border-b border-border px-6 py-4">
          <div className="mx-auto max-w-5xl flex items-center gap-3">
            <Link href="/dashboard" className="text-sm text-muted-foreground">&larr; 대시보드</Link>
            <span className="text-lg font-semibold">리밸런싱</span>
          </div>
        </header>
        <main className="mx-auto max-w-5xl px-6 py-8 space-y-6">
          <Skeleton className="h-32 w-full rounded-xl" />
          <div className="grid grid-cols-2 gap-4">
            <Skeleton className="h-48 rounded-xl" />
            <Skeleton className="h-48 rounded-xl" />
          </div>
          <Skeleton className="h-64 w-full rounded-xl" />
        </main>
      </div>
    );
  }

  // 목표 미설정
  if (targets.length === 0) {
    return (
      <div className="min-h-screen bg-background">
        <header className="border-b border-border px-6 py-4">
          <div className="mx-auto max-w-5xl flex items-center gap-3">
            <Link href="/dashboard" className="text-sm text-muted-foreground">&larr; 대시보드</Link>
            <span className="text-lg font-semibold">리밸런싱</span>
          </div>
        </header>
        <main className="mx-auto max-w-5xl px-6 py-8">
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-3xl mb-3 opacity-50">&#9878;</p>
              <p className="text-base font-medium mb-2">리밸런싱 목표를 설정해보세요</p>
              <p className="text-sm text-muted-foreground mb-6 leading-relaxed">
                목표 자산 배분을 설정하면,<br />
                현재 포트폴리오와 비교해서<br />
                어떤 자산을 조정해야 하는지 알려드려요.
              </p>
              <Link href="/settings#rebalancing">
                <Button>목표 설정하기</Button>
              </Link>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  // 자산 없음
  if (assets.length === 0) {
    return (
      <div className="min-h-screen bg-background">
        <header className="border-b border-border px-6 py-4">
          <div className="mx-auto max-w-5xl flex items-center gap-3">
            <Link href="/dashboard" className="text-sm text-muted-foreground">&larr; 대시보드</Link>
            <span className="text-lg font-semibold">리밸런싱</span>
          </div>
        </header>
        <main className="mx-auto max-w-5xl px-6 py-8">
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-3xl mb-3 opacity-50">&#128176;</p>
              <p className="text-base font-medium mb-2">등록된 자산이 없어요</p>
              <p className="text-sm text-muted-foreground mb-6">
                자산을 먼저 등록해야 리밸런싱을 시작할 수 있어요.
              </p>
              <Link href="/assets/new">
                <Button>자산 등록하기</Button>
              </Link>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  const statusConfig = {
    balanced: { label: '균형', color: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' },
    needs_adjustment: { label: '조정 필요', color: 'bg-amber-500/10 text-amber-500 border-amber-500/20' },
    urgent: { label: '긴급 조정', color: 'bg-red-500/10 text-red-500 border-red-500/20' },
  };

  const activeSuggestions = suggestions.filter(s => s.action !== 'hold');
  const liquidAssets = filterLiquidAssets(assets);

  // 목표 기반 가상 자산 (도넛 차트용)
  const targetAssets = targets.map(t => ({
    asset_class: t.asset_class,
    current_value: (t.target_ratio / 100) * totalLiquid,
  })) as AssetWithPrice[];

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border px-6 py-4">
        <div className="mx-auto max-w-5xl flex items-center gap-3">
          <Link href="/dashboard" className="text-sm text-muted-foreground">&larr; 대시보드</Link>
          <span className="text-lg font-semibold">리밸런싱</span>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-8 space-y-6">
        {/* 히어로 */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-muted-foreground mb-1">유동 자산 총액</p>
                <p className="text-3xl font-bold tabular-nums">
                  {formatKRW(totalLiquid)}
                  {hasStaleWarning && (
                    <span className="text-xs text-amber-500 ml-2 font-normal">&#9888; 추정</span>
                  )}
                </p>
                <p className="text-xs text-muted-foreground mt-1">부동산 제외 기준</p>
              </div>
              <Badge variant="outline" className={statusConfig[status].color}>
                {statusConfig[status].label}
              </Badge>
            </div>
            {daysSinceCheck !== null && (
              <p className="text-xs text-muted-foreground mt-3 pt-3 border-t border-border">
                마지막 확인: {daysSinceCheck === 0 ? '오늘' : `${daysSinceCheck}일 전`}
              </p>
            )}
          </CardContent>
        </Card>

        {/* 도넛 차트 비교 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Card>
            <CardHeader><CardTitle className="text-sm">현재 배분</CardTitle></CardHeader>
            <CardContent>
              <AllocationPieChart assets={liquidAssets} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-sm">목표 배분</CardTitle></CardHeader>
            <CardContent>
              <AllocationPieChart assets={targetAssets} />
            </CardContent>
          </Card>
        </div>

        {/* Stale 경고 */}
        {hasStaleWarning && (
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 text-amber-500 text-xs">
            &#9888; 자산의 일부가 7일 이상 지난 시세입니다. 제안은 참고용이며, 시세를 갱신한 후 다시 확인하세요.
          </div>
        )}

        {/* 제안 카드 */}
        {status === 'balanced' && activeSuggestions.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center">
              <p className="text-2xl mb-2 text-emerald-500">&#10003;</p>
              <p className="text-sm font-medium text-emerald-500">포트폴리오가 균형 잡혀 있어요!</p>
              <p className="text-xs text-muted-foreground mt-1">목표 배분에 가깝습니다.</p>
            </CardContent>
          </Card>
        ) : (
          <div>
            <h2 className="text-sm font-semibold mb-3">리밸런싱 제안</h2>
            <div className="space-y-2">
              {suggestions
                .filter(s => s.action !== 'hold')
                .map((s) => (
                  <div
                    key={s.assetClass}
                    className="flex items-center justify-between rounded-lg border border-border px-4 py-3"
                  >
                    <div>
                      <p className="text-sm font-medium">{CLASS_LABELS[s.assetClass] ?? s.assetClass}</p>
                      <p className="text-xs text-muted-foreground">
                        {s.currentRatio.toFixed(1)}% → {s.targetRatio.toFixed(1)}% 목표
                      </p>
                    </div>
                    <div className="text-right">
                      <p className={`text-sm font-semibold tabular-nums ${
                        s.action === 'sell' ? 'text-red-500' : 'text-emerald-500'
                      }`}>
                        {s.action === 'sell' ? '−' : '+'}{formatKRW(s.amount)} {s.action === 'sell' ? '매도' : '추가'}
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        {Math.abs(s.diffPercent).toFixed(1)}%p {s.action === 'sell' ? '초과' : '부족'}
                      </p>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* 액션 버튼 */}
        <div className="flex gap-3">
          <Link href="/settings#rebalancing" className="flex-1">
            <Button variant="outline" className="w-full">목표 수정</Button>
          </Link>
          <Button onClick={handleRefresh} className="flex-1">다시 계산</Button>
        </div>
      </main>
    </div>
  );
}
