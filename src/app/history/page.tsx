'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { formatKRW, formatChange } from '@/lib/format';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Area,
  AreaChart,
} from 'recharts';

interface Snapshot {
  total_assets: number;
  total_liabilities: number;
  net_worth: number;
  snapshot_date: string;
}

interface PeriodChange {
  label: string;
  daysAgo: number;
  /** 비교 기준 스냅샷 날짜 */
  snapshotDate: string;
  /** 그 시점의 순자산 */
  snapshotNetWorth: number;
  /** 현재 - 과거 */
  delta: number;
  /** 변동률 (%) */
  deltaPct: number;
}

/**
 * snapshots 는 ASC 정렬 기준. target 날짜 이하의 가장 최근 스냅샷을 반환.
 * (returns 페이지의 findNearestSnapshot 은 DESC 가정이었음 — 여기서는 ASC 역순회)
 */
function findNearestSnapshotAsc(
  snapshots: Snapshot[],
  daysAgo: number,
): Snapshot | null {
  const target = new Date();
  target.setHours(0, 0, 0, 0);
  target.setDate(target.getDate() - daysAgo);
  for (let i = snapshots.length - 1; i >= 0; i--) {
    if (new Date(snapshots[i].snapshot_date) <= target) return snapshots[i];
  }
  return null;
}

const PERIODS: { label: string; days: number }[] = [
  { label: '1일 전 대비', days: 1 },
  { label: '1달 전 대비', days: 30 },
  { label: '3달 전 대비', days: 90 },
  { label: '6달 전 대비', days: 180 },
  { label: '1년 전 대비', days: 365 },
];

function computePeriodChanges(snapshots: Snapshot[]): PeriodChange[] {
  if (snapshots.length < 2) return [];
  const latest = snapshots[snapshots.length - 1];
  const current = Number(latest.net_worth);
  const changes: PeriodChange[] = [];
  for (const p of PERIODS) {
    const past = findNearestSnapshotAsc(snapshots, p.days);
    if (!past) continue;
    if (past.snapshot_date === latest.snapshot_date) continue;
    const pastNw = Number(past.net_worth);
    if (pastNw <= 0) continue;
    const delta = current - pastNw;
    const deltaPct = (delta / pastNw) * 100;
    changes.push({
      label: p.label,
      daysAgo: p.days,
      snapshotDate: past.snapshot_date,
      snapshotNetWorth: pastNw,
      delta,
      deltaPct,
    });
  }
  return changes;
}

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number; name: string }>; label?: string }) {
  if (!active || !payload) return null;
  return (
    <div className="rounded-lg bg-card border border-border px-3 py-2 shadow-lg text-xs">
      <p className="font-medium mb-1">{label}</p>
      {payload.map((p, i) => (
        <p key={i} className={p.name === 'net_worth' ? 'font-semibold' : 'text-muted-foreground'}>
          {p.name === 'net_worth' ? '순자산' : p.name === 'total_assets' ? '총 자산' : '총 부채'}: {formatKRW(p.value)}
        </p>
      ))}
    </div>
  );
}

export default function HistoryPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [snapshotting, setSnapshotting] = useState(false);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/login'); return; }

      try {
        const res = await fetch('/api/snapshot');
        const data = await res.json();
        if (Array.isArray(data)) setSnapshots(data);
      } catch (err) {
        console.error('스냅샷 조회 실패:', err);
      }
      setLoading(false);
    }
    load();
  }, [router]);

  async function handleSnapshot() {
    setSnapshotting(true);
    try {
      await fetch('/api/snapshot', { method: 'POST' });
      // 재조회
      const res = await fetch('/api/snapshot');
      const data = await res.json();
      if (Array.isArray(data)) setSnapshots(data);
    } catch (err) {
      console.error('스냅샷 생성 실패:', err);
    }
    setSnapshotting(false);
  }

  const chartData = snapshots.map(s => ({
    ...s,
    date: s.snapshot_date.slice(5), // MM-DD
    total_assets: Number(s.total_assets),
    total_liabilities: Number(s.total_liabilities),
    net_worth: Number(s.net_worth),
  }));

  const latest = snapshots.length > 0 ? snapshots[snapshots.length - 1] : null;
  const prev = snapshots.length > 1 ? snapshots[snapshots.length - 2] : null;
  const change = latest && prev ? Number(latest.net_worth) - Number(prev.net_worth) : null;
  const periodChanges = computePeriodChanges(snapshots);

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <header className="border-b border-border px-6 py-4">
          <div className="mx-auto max-w-5xl"><Skeleton className="h-6 w-32" /></div>
        </header>
        <main className="mx-auto max-w-5xl px-6 py-8 space-y-6">
          <Skeleton className="h-64 w-full rounded-xl" />
          <Skeleton className="h-48 w-full rounded-xl" />
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border px-6 py-4">
        <div className="mx-auto max-w-5xl flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/dashboard">
              <Button variant="ghost" size="sm">← 대시보드</Button>
            </Link>
            <h1 className="text-lg font-semibold">자산 히스토리</h1>
          </div>
          <Button
            size="sm"
            onClick={handleSnapshot}
            disabled={snapshotting}
            className="text-xs"
          >
            {snapshotting ? '저장 중...' : '📸 스냅샷 찍기'}
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-8 space-y-6">
        {snapshots.length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center">
              <p className="text-4xl mb-4">📊</p>
              <h2 className="text-lg font-semibold">스냅샷이 없습니다</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                "스냅샷 찍기" 버튼으로 현재 자산 상태를 기록하세요.
                <br />
                매일 자동으로도 기록됩니다.
              </p>
              <Button className="mt-4" onClick={handleSnapshot} disabled={snapshotting}>
                {snapshotting ? '저장 중...' : '첫 스냅샷 찍기'}
              </Button>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* 현재 요약 */}
            <Card>
              <CardContent className="pt-6">
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <p className="text-xs text-muted-foreground">현재 순자산</p>
                    <p className="text-lg font-semibold">{formatKRW(Number(latest?.net_worth ?? 0))}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">이전 대비</p>
                    <p className={`text-lg font-semibold ${(change ?? 0) >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                      {change !== null ? formatChange(change) : '-'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">기록 수</p>
                    <p className="text-lg font-semibold">{snapshots.length}일</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* 기간별 변동 — household_snapshots 기반. 해당 기간 스냅샷 없으면 행 생략 */}
            {periodChanges.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">기간별 변동 (순자산 기준)</CardTitle>
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

            {/* 순자산 추이 차트 */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">순자산 추이</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id="netWorthGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                    <YAxis
                      tick={{ fontSize: 11 }}
                      stroke="hsl(var(--muted-foreground))"
                      tickFormatter={(v) => formatKRW(v)}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Area
                      type="monotone"
                      dataKey="net_worth"
                      stroke="hsl(var(--primary))"
                      fill="url(#netWorthGrad)"
                      strokeWidth={2}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* 자산/부채 추이 */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">자산 vs 부채</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                    <YAxis
                      tick={{ fontSize: 11 }}
                      stroke="hsl(var(--muted-foreground))"
                      tickFormatter={(v) => formatKRW(v)}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Line type="monotone" dataKey="total_assets" stroke="#22c55e" strokeWidth={2} dot={false} name="total_assets" />
                    <Line type="monotone" dataKey="total_liabilities" stroke="#ef4444" strokeWidth={2} dot={false} name="total_liabilities" />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* 히스토리 테이블 */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">기록</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-1">
                  {[...snapshots].reverse().map((s, i) => {
                    const prevS = snapshots[snapshots.length - 1 - i - 1];
                    const diff = prevS ? Number(s.net_worth) - Number(prevS.net_worth) : null;
                    return (
                      <div key={s.snapshot_date} className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-muted/50">
                        <div>
                          <p className="text-sm font-medium">{s.snapshot_date}</p>
                          <p className="text-xs text-muted-foreground">
                            자산 {formatKRW(Number(s.total_assets))} / 부채 {formatKRW(Number(s.total_liabilities))}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-semibold">{formatKRW(Number(s.net_worth))}</p>
                          {diff !== null && (
                            <p className={`text-xs ${diff >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                              {formatChange(diff)}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </main>
    </div>
  );
}
