'use client';

import { useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { useToast } from '@/components/ui/toast';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { formatKRW } from '@/lib/format';
import { AssetList } from '@/components/asset-list';
import { LiabilityList } from '@/components/liability-list';
import { HealthScore } from '@/components/health-score';
import { LeaseAlerts } from '@/components/lease-alerts';
import { HouseholdMembers } from '@/components/household-members';

// recharts 등 무거운 클라이언트 차트는 lazy load → 초기 JS 번들 축소
const ChartFallback = () => <Skeleton className="h-64 w-full rounded-xl" />;
const AssetPieChart = dynamic(
  () => import('@/components/asset-pie-chart').then((m) => m.AssetPieChart),
  { ssr: false, loading: ChartFallback },
);
const AllocationPieChart = dynamic(
  () =>
    import('@/components/allocation-pie-chart').then(
      (m) => m.AllocationPieChart,
    ),
  { ssr: false, loading: ChartFallback },
);
const ChangeAttribution = dynamic(
  () =>
    import('@/components/change-attribution').then((m) => m.ChangeAttribution),
  { ssr: false, loading: ChartFallback },
);
const GoalProjection = dynamic(
  () => import('@/components/goal-projection').then((m) => m.GoalProjection),
  { ssr: false, loading: ChartFallback },
);
const BriefingCards = dynamic(
  () => import('@/components/briefing-cards').then((m) => m.BriefingCards),
  { ssr: false, loading: ChartFallback },
);
const MonthlyChange = dynamic(
  () => import('@/components/monthly-change').then((m) => m.MonthlyChange),
  { ssr: false, loading: ChartFallback },
);
const MarketIndices = dynamic(
  () => import('@/components/market-indices').then((m) => m.MarketIndices),
  { ssr: false },
);
const MarketRankings = dynamic(
  () => import('@/components/market-rankings').then((m) => m.MarketRankings),
  { ssr: false, loading: ChartFallback },
);
const RebalancingPreview = dynamic(
  () => import('@/components/rebalancing-preview').then((m) => m.RebalancingPreview),
  { ssr: false },
);
import type { AssetWithPrice, Liability, Household } from '@/types/database';

type OwnerFilter = 'all' | 'mine' | 'spouse' | 'shared';

interface MemberInfo {
  user_id: string;
  nickname: string | null;
  email: string;
}

interface Props {
  household: Household;
  assets: AssetWithPrice[];
  liabilities: Liability[];
  exchangeRate?: number | null;
  currentUserId?: string;
  members?: MemberInfo[];
  monthlyGrowth?: number | null;
  onMutate?: () => Promise<void>;
}

export function DashboardView({ household, assets, liabilities, exchangeRate, currentUserId, members = [], monthlyGrowth, onMutate }: Props) {
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  const [ownerFilter, setOwnerFilter] = useState<OwnerFilter>('all');
  const [showAmounts, setShowAmounts] = useState(false);
  const { toast } = useToast();
  const mask = '••••••';
  const display = (v: number) => (showAmounts ? formatKRW(v) : mask);

  // 서버 컴포넌트에서 호출된 경우 onMutate가 없을 수 있으므로
  // router.refresh()로 폴백해서 서버 데이터를 다시 불러옴
  const refreshData = useCallback(async () => {
    if (onMutate) {
      await onMutate();
    } else {
      router.refresh();
    }
  }, [onMutate, router]);

  const spouse = members.find(m => m.user_id !== currentUserId);
  const myName = members.find(m => m.user_id === currentUserId)?.nickname || '본인';
  const spouseName = spouse?.nickname || '배우자';

  const filteredAssets = useMemo(() => {
    if (ownerFilter === 'all') return assets;
    if (ownerFilter === 'mine') return assets.filter(a => a.owner_user_id === currentUserId && a.ownership === 'personal');
    if (ownerFilter === 'spouse') return assets.filter(a => a.owner_user_id !== currentUserId && a.ownership === 'personal');
    if (ownerFilter === 'shared') return assets.filter(a => a.ownership === 'shared');
    return assets;
  }, [assets, ownerFilter, currentUserId]);

  const filteredLiabilities = useMemo(() => {
    if (ownerFilter === 'all') return liabilities;
    if (ownerFilter === 'mine') return liabilities.filter(l => l.owner_user_id === currentUserId && l.ownership === 'personal');
    if (ownerFilter === 'spouse') return liabilities.filter(l => l.owner_user_id !== currentUserId && l.ownership === 'personal');
    if (ownerFilter === 'shared') return liabilities.filter(l => l.ownership === 'shared');
    return liabilities;
  }, [liabilities, ownerFilter, currentUserId]);

  const netWorthLabel = ownerFilter === 'all' ? '총 순자산'
    : ownerFilter === 'mine' ? `${myName}님 순자산`
    : ownerFilter === 'spouse' ? `${spouseName}님 순자산`
    : '공동 순자산';

  const handleRefreshPrices = useCallback(async () => {
    setRefreshing(true);
    try {
      // 1. 업비트 보유 잔고 동기화 (키 미설정/실패해도 시세는 계속)
      const syncRes = await fetch('/api/upbit-sync', { method: 'POST' });
      const syncOk = syncRes.ok;
      // 2. 시세 갱신
      const res = await fetch('/api/prices', { method: 'POST' });
      if (!res.ok) throw new Error();
      await refreshData();
      toast(syncOk ? '업비트 잔고와 시세가 갱신되었습니다' : '시세가 갱신되었습니다', 'success');
    } catch {
      toast('시세 갱신에 실패했습니다', 'error');
    } finally {
      setRefreshing(false);
    }
  }, [refreshData, toast]);

  const hasRealEstate = assets.some(a => a.category === 'real_estate' && a.kb_complex_id);
  const [refreshingKb, setRefreshingKb] = useState(false);

  const handleRefreshKb = useCallback(async () => {
    setRefreshingKb(true);
    try {
      const res = await fetch('/api/kb-refresh', { method: 'POST' });
      if (!res.ok) throw new Error();
      const data = await res.json();
      await refreshData();
      toast(`부동산 시세 ${data.updated}건 갱신됨`, 'success');
    } catch {
      toast('부동산 시세 갱신 실패', 'error');
    } finally {
      setRefreshingKb(false);
    }
  }, [refreshData, toast]);

  const totalAssets = filteredAssets.reduce((sum, a) => sum + a.current_value, 0);
  const totalLiabilities = filteredLiabilities.reduce((sum, l) => sum + l.balance, 0);
  const netWorth = totalAssets - totalLiabilities;

  const isEmpty = assets.length === 0 && liabilities.length === 0;
  const isFilteredEmpty = ownerFilter !== 'all' && filteredAssets.length === 0 && filteredLiabilities.length === 0;

  const filterTabs: { key: OwnerFilter; label: string; shortLabel: string }[] = [
    { key: 'all', label: '전체', shortLabel: '전체' },
    { key: 'mine', label: myName, shortLabel: '나' },
    { key: 'spouse', label: spouseName, shortLabel: spouseName.slice(0, 3) },
    { key: 'shared', label: '공동', shortLabel: '공동' },
  ];

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border px-4 sm:px-6 py-3 sm:py-4">
        <div className="mx-auto max-w-5xl flex items-center justify-between">
          <h1 className="text-lg font-semibold">Wealth Lens</h1>
          <div className="flex items-center gap-1.5 sm:gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRefreshPrices}
              disabled={refreshing}
              className="text-xs px-2 sm:px-3"
            >
              {refreshing ? '갱신 중...' : '↻ 시세'}
            </Button>
            {hasRealEstate && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleRefreshKb}
                disabled={refreshingKb}
                className="text-xs px-2 sm:px-3 hidden sm:inline-flex"
              >
                {refreshingKb ? '갱신 중...' : '🏠 KB시세'}
              </Button>
            )}
            <Link
              href="/history"
              className="rounded-lg border border-border px-2 sm:px-3 py-2 text-xs hover:bg-muted/50 transition-colors hidden sm:inline-flex"
            >
              📊 히스토리
            </Link>
            <Link
              href="/stocks"
              className="rounded-lg border border-border px-2 sm:px-3 py-2 text-xs hover:bg-muted/50 transition-colors hidden sm:inline-flex"
            >
              📈 주식
            </Link>
            <Link
              href="/returns"
              className="rounded-lg border border-border px-2 sm:px-3 py-2 text-xs hover:bg-muted/50 transition-colors hidden sm:inline-flex"
            >
              💰 수익률
            </Link>
            <Link
              href="/assets/new"
              className="rounded-lg bg-primary px-3 sm:px-4 py-2 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              + 등록
            </Link>
            <Link
              href="/rebalancing"
              className="hidden sm:inline-flex rounded-lg border border-border px-3 py-2 text-xs hover:bg-muted/50 transition-colors"
            >
              리밸런싱
            </Link>
            <Link
              href="/settings"
              className="rounded-lg border border-border px-2 sm:px-3 py-2 text-xs hover:bg-muted/50 transition-colors"
            >
              설정
            </Link>
          </div>
        </div>
        {/* 모바일 하단 네비게이션 */}
        <div className="flex sm:hidden items-center gap-2 mt-2 pt-2 border-t border-border/50">
          <Link
            href="/history"
            className="flex-1 text-center rounded-lg border border-border px-2 py-1.5 text-xs hover:bg-muted/50 transition-colors"
          >
            히스토리
          </Link>
          <Link
            href="/stocks"
            className="flex-1 text-center rounded-lg border border-border px-2 py-1.5 text-xs hover:bg-muted/50 transition-colors"
          >
            주식
          </Link>
          <Link
            href="/returns"
            className="flex-1 text-center rounded-lg border border-border px-2 py-1.5 text-xs hover:bg-muted/50 transition-colors"
          >
            수익률
          </Link>
          <Link
            href="/rebalancing"
            className="flex-1 text-center rounded-lg border border-border px-2 py-1.5 text-xs hover:bg-muted/50 transition-colors"
          >
            리밸런싱
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-8 space-y-6">
        {isEmpty ? (
          <Card>
            <CardContent className="py-16 text-center">
              <p className="text-4xl mb-4">🏠</p>
              <h2 className="text-lg font-semibold">
                {household.name}에 오신 것을 환영합니다
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                첫 번째 자산을 등록해서 시작하세요
              </p>
              <Link
                href="/assets/new"
                className="mt-4 inline-block rounded-lg bg-primary px-6 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                자산 등록하기
              </Link>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Net Worth Hero */}
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm text-muted-foreground">{netWorthLabel}</p>
                      <button
                        type="button"
                        onClick={() => setShowAmounts((v) => !v)}
                        className="text-xs rounded-md border border-border px-2 py-0.5 text-muted-foreground hover:bg-muted/50 transition-colors"
                        aria-label={showAmounts ? '금액 숨기기' : '금액 보기'}
                      >
                        {showAmounts ? '🙈 숨기기' : '👁 보기'}
                      </button>
                    </div>
                    <p className="text-4xl font-bold tracking-tight mt-1 transition-all duration-200">
                      {display(netWorth)}
                    </p>
                  </div>
                  <HealthScore
                    assets={assets}
                    liabilities={liabilities}
                    totalAssets={assets.reduce((s, a) => s + a.current_value, 0)}
                    totalLiabilities={liabilities.reduce((s, l) => s + l.balance, 0)}
                  />
                </div>

                {/* Owner Filter */}
                {members.length >= 2 && (
                  <div className="flex gap-1 mt-3">
                    {filterTabs.map(tab => (
                      <button
                        key={tab.key}
                        onClick={() => setOwnerFilter(tab.key)}
                        className={`px-3 py-1.5 text-xs rounded-full transition-all duration-200 min-h-[36px] sm:min-h-0 ${
                          ownerFilter === tab.key
                            ? 'bg-primary text-primary-foreground font-medium'
                            : 'bg-muted/50 text-muted-foreground hover:bg-muted'
                        }`}
                      >
                        <span className="hidden sm:inline">{tab.label}</span>
                        <span className="sm:hidden">{tab.shortLabel}</span>
                      </button>
                    ))}
                  </div>
                )}

                {/* 목표 달성률 */}
                {showAmounts && household.goal_net_worth && household.goal_net_worth > 0 && (
                  <div className="mt-3">
                    <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                      <span>목표 {formatKRW(household.goal_net_worth)}</span>
                      <span>{Math.min(100, Math.round((netWorth / household.goal_net_worth) * 100))}%</span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full transition-all"
                        style={{ width: `${Math.min(100, (netWorth / household.goal_net_worth) * 100)}%` }}
                      />
                    </div>
                  </div>
                )}

                <Separator className="my-4" />

                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <p className="text-xs text-muted-foreground">총 자산</p>
                    <p className="text-lg font-semibold text-emerald-500">
                      {display(totalAssets)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">총 부채</p>
                    <p className="text-lg font-semibold text-red-500">
                      {display(totalLiabilities)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">순자산</p>
                    <p className="text-lg font-semibold">{display(netWorth)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* 시장 지수 현황 */}
            {ownerFilter === 'all' && <MarketIndices />}

            {/* AI 브리핑 (Phase 4) */}
            {ownerFilter === 'all' && <BriefingCards />}

            {/* 시장 순위 */}
            {ownerFilter === 'all' && <MarketRankings />}

            {/* Monthly Change */}
            {ownerFilter === 'all' && (
              <MonthlyChange
                householdId={household.id}
                currentNetWorth={netWorth}
                assets={assets}
              />
            )}

            {/* Lease Alerts */}
            <LeaseAlerts assets={filteredAssets} />

            {/* 목표 프로젝션 */}
            {household.goal_net_worth && household.goal_net_worth > 0 && ownerFilter === 'all' && (
              <GoalProjection
                netWorth={netWorth}
                goalNetWorth={household.goal_net_worth}
                recentMonthlyGrowth={monthlyGrowth ?? null}
              />
            )}

            {isFilteredEmpty ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <p className="text-3xl mb-3">👤</p>
                  <p className="text-sm font-medium">
                    {ownerFilter === 'mine' ? `${myName}님` : ownerFilter === 'spouse' ? `${spouseName}님` : '공동'} 명의 자산이 없어요
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    자산 등록 시 소유자를 선택할 수 있습니다
                  </p>
                  <Link
                    href="/assets/new"
                    className="mt-4 inline-block rounded-lg bg-primary px-5 py-2.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
                  >
                    자산 등록하기
                  </Link>
                </CardContent>
              </Card>
            ) : (
              <>
                {/* Charts */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm">자산 유형별</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <AssetPieChart assets={filteredAssets} />
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm">투자 자산 배분</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <AllocationPieChart assets={filteredAssets} />
                    </CardContent>
                  </Card>
                </div>

                {/* 리밸런싱 미리보기 */}
                <RebalancingPreview assets={assets} />

                {/* Top Assets */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">자산 비중 TOP 5</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ChangeAttribution assets={filteredAssets} />
                  </CardContent>
                </Card>

                {/* Asset List */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">자산 목록</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <AssetList assets={filteredAssets} exchangeRate={exchangeRate} onMutate={refreshData} />
                  </CardContent>
                </Card>
              </>
            )}

            {/* Household Members */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">가구 구성원</CardTitle>
              </CardHeader>
              <CardContent>
                <HouseholdMembers />
              </CardContent>
            </Card>

            {/* Liabilities */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">부채</CardTitle>
              </CardHeader>
              <CardContent>
                {filteredLiabilities.length > 0 ? (
                  <LiabilityList liabilities={filteredLiabilities} onMutate={refreshData} />
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    {ownerFilter === 'all' ? '등록된 부채가 없습니다' : '해당 소유자의 부채가 없습니다'}
                  </p>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </main>
    </div>
  );
}
