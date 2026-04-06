'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { formatKRW } from '@/lib/format';

interface Props {
  netWorth: number;
  goalNetWorth: number;
  recentMonthlyGrowth: number | null; // 최근 3개월 월평균 순자산 증가액
}

export function GoalProjection({ netWorth, goalNetWorth, recentMonthlyGrowth }: Props) {
  const [monthlySaving, setMonthlySaving] = useState('');

  const remaining = goalNetWorth - netWorth;
  const progress = Math.min(100, Math.max(0, (netWorth / goalNetWorth) * 100));

  // 현재 추세 기반 예상
  const trendMonths = recentMonthlyGrowth && recentMonthlyGrowth > 0
    ? Math.ceil(remaining / recentMonthlyGrowth)
    : null;

  // 월 저축 시뮬레이션
  const simMonths = useMemo(() => {
    const saving = Number(monthlySaving);
    if (!saving || saving <= 0 || remaining <= 0) return null;
    return Math.ceil(remaining / saving);
  }, [monthlySaving, remaining]);

  function formatDuration(months: number): string {
    if (months <= 0) return '달성!';
    const years = Math.floor(months / 12);
    const rem = months % 12;
    if (years === 0) return `${rem}개월`;
    if (rem === 0) return `${years}년`;
    return `${years}년 ${rem}개월`;
  }

  if (remaining <= 0) {
    return (
      <Card>
        <CardContent className="py-6 text-center">
          <p className="text-2xl mb-2">🎉</p>
          <p className="text-sm font-medium text-emerald-500">
            목표 순자산 {formatKRW(goalNetWorth)} 달성!
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">목표 프로젝션</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* 진행률 바 */}
        <div>
          <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
            <span>현재 {formatKRW(netWorth)}</span>
            <span>목표 {formatKRW(goalNetWorth)}</span>
          </div>
          <div className="h-3 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            남은 금액: {formatKRW(remaining)} ({progress.toFixed(1)}% 달성)
          </p>
        </div>

        {/* 현재 추세 기반 예상 */}
        {trendMonths && (
          <div className="rounded-lg bg-muted/30 px-4 py-3">
            <p className="text-xs text-muted-foreground">최근 추세 기반 예상</p>
            <p className="text-sm font-semibold mt-0.5">
              약 {formatDuration(trendMonths)} 후 달성
            </p>
            <p className="text-xs text-muted-foreground">
              (월평균 {formatKRW(recentMonthlyGrowth!)} 증가 기준)
            </p>
          </div>
        )}

        {/* 시뮬레이터 */}
        <div className="space-y-2">
          <Label className="text-xs">월 저축액 시뮬레이션</Label>
          <Input
            type="number"
            value={monthlySaving}
            onChange={(e) => setMonthlySaving(e.target.value)}
            placeholder="월 저축액 (원)"
            min={0}
          />
          {simMonths && (
            <p className="text-sm">
              월 {formatKRW(Number(monthlySaving))}씩 저축하면{' '}
              <span className="font-semibold text-primary">{formatDuration(simMonths)}</span> 후 달성
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
