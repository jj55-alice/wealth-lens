'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { formatKRW, formatChange, formatPercent } from '@/lib/format';
import { AssetPieChart } from '@/components/asset-pie-chart';
import { AllocationPieChart } from '@/components/allocation-pie-chart';
import { AssetList } from '@/components/asset-list';
import { LiabilityList } from '@/components/liability-list';
import { HealthScore } from '@/components/health-score';
import { LeaseAlerts } from '@/components/lease-alerts';
import { MilestoneCheck } from '@/components/milestone-check';
import { ChangeAttribution } from '@/components/change-attribution';
import { createClient } from '@/lib/supabase/client';
import type { AssetWithPrice, Liability, Household } from '@/types/database';

interface Props {
  household: Household;
  assets: AssetWithPrice[];
  liabilities: Liability[];
}

export function DashboardView({ household, assets, liabilities }: Props) {
  const [refreshing, setRefreshing] = useState(false);

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = '/login';
  }

  async function handleRefreshPrices() {
    setRefreshing(true);
    try {
      await fetch('/api/prices', { method: 'POST' });
      window.location.reload();
    } finally {
      setRefreshing(false);
    }
  }
  const totalAssets = assets.reduce((sum, a) => sum + a.current_value, 0);
  const totalLiabilities = liabilities.reduce((sum, l) => sum + l.balance, 0);
  const netWorth = totalAssets - totalLiabilities;

  const isEmpty = assets.length === 0 && liabilities.length === 0;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border px-6 py-4">
        <div className="mx-auto max-w-5xl flex items-center justify-between">
          <h1 className="text-lg font-semibold">Wealth Lens</h1>
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRefreshPrices}
              disabled={refreshing}
              className="text-xs"
            >
              {refreshing ? '갱신 중...' : '↻ 시세 갱신'}
            </Button>
            <Link
              href="/stocks"
              className="rounded-lg border border-border px-4 py-2 text-xs font-medium hover:bg-muted/50 transition-colors"
            >
              📈 주식
            </Link>
            <Link
              href="/assets/new"
              className="rounded-lg bg-primary px-4 py-2 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              + 자산 등록
            </Link>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              className="text-xs text-muted-foreground"
            >
              로그아웃
            </Button>
          </div>
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
                  <div>
                    <p className="text-sm text-muted-foreground">총 순자산</p>
                    <p className="text-4xl font-bold tracking-tight mt-1">
                      {formatKRW(netWorth)}
                    </p>
                  </div>
                  <HealthScore
                    assets={assets}
                    liabilities={liabilities}
                    totalAssets={totalAssets}
                    totalLiabilities={totalLiabilities}
                  />
                </div>

                <Separator className="my-4" />

                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <p className="text-xs text-muted-foreground">총 자산</p>
                    <p className="text-lg font-semibold text-emerald-500">
                      {formatKRW(totalAssets)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">총 부채</p>
                    <p className="text-lg font-semibold text-red-500">
                      {formatKRW(totalLiabilities)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">순자산</p>
                    <p className="text-lg font-semibold">{formatKRW(netWorth)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Lease Alerts */}
            <LeaseAlerts assets={assets} />

            {/* Milestone Progress */}
            <MilestoneCheck netWorth={netWorth} />

            {/* Charts */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">자산 유형별</CardTitle>
                </CardHeader>
                <CardContent>
                  <AssetPieChart assets={assets} />
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">투자 자산 배분</CardTitle>
                </CardHeader>
                <CardContent>
                  <AllocationPieChart assets={assets} />
                </CardContent>
              </Card>
            </div>

            {/* Top Assets */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">자산 비중 TOP 5</CardTitle>
              </CardHeader>
              <CardContent>
                <ChangeAttribution assets={assets} />
              </CardContent>
            </Card>

            {/* Asset List */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">자산 목록</CardTitle>
              </CardHeader>
              <CardContent>
                <AssetList assets={assets} />
              </CardContent>
            </Card>

            {/* Liabilities */}
            {liabilities.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">부채</CardTitle>
                </CardHeader>
                <CardContent>
                  <LiabilityList liabilities={liabilities} />
                </CardContent>
              </Card>
            )}
          </>
        )}
      </main>
    </div>
  );
}
