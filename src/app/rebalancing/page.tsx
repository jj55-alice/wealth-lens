'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { formatKRW } from '@/lib/format';
import {
  computeRebalancing,
  computeTradeGuides,
  filterLiquidAssets,
  CLASS_LABELS,
  PRESETS,
} from '@/lib/rebalancing';
import type { RebalancingTarget, RebalancingStatus, TradeGuide } from '@/lib/rebalancing';
import type { AssetWithPrice } from '@/types/database';
import { getHouseholdAssets } from '@/lib/queries';

interface HistoryEntry {
  id: string;
  status: string;
  max_drift: number;
  suggestions: unknown;
  total_liquid: number;
  checked_at: string;
}

const CLASS_COLORS: Record<string, string> = {
  domestic_equity: 'bg-blue-500',
  foreign_equity: 'bg-violet-500',
  bond: 'bg-cyan-500',
  commodity: 'bg-amber-500',
  crypto: 'bg-emerald-500',
  cash_equiv: 'bg-gray-500',
};

const ASSET_CLASSES = [
  'domestic_equity', 'foreign_equity', 'bond', 'commodity', 'crypto', 'cash_equiv',
] as const;

export default function RebalancingPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [assets, setAssets] = useState<AssetWithPrice[]>([]);
  const [savedTargets, setSavedTargets] = useState<RebalancingTarget[]>([]);
  const [simTargets, setSimTargets] = useState<RebalancingTarget[]>([]);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [expandedClass, setExpandedClass] = useState<string | null>(null);
  const [activePreset, setActivePreset] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [checkSaving, setCheckSaving] = useState(false);

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

    const [fetchedAssets, targetsRes, historyRes] = await Promise.all([
      getHouseholdAssets(supabase, membership.household_id),
      fetch('/api/rebalancing').then(r => r.json()),
      fetch('/api/rebalancing/history').then(r => r.json()).catch(() => ({ history: [] })),
    ]);

    setAssets(fetchedAssets);
    setHistory(historyRes.history ?? []);
    const targets = targetsRes.targets ?? [];
    setSavedTargets(targets);
    setSimTargets(targets.length > 0 ? targets : PRESETS.balanced);
    setLoading(false);
  }, [router]);

  useEffect(() => { load(); }, [load]);

  // 실시간 리밸런싱 계산
  const result = useMemo(() => {
    if (simTargets.length === 0) return null;
    return computeRebalancing(assets, simTargets);
  }, [assets, simTargets]);

  const tradeGuides = useMemo(() => {
    if (!result) return [];
    return computeTradeGuides(assets, result.suggestions);
  }, [assets, result]);

  // 종목별 가이드를 자산군별로 그룹핑
  const guidesByClass = useMemo(() => {
    const map = new Map<string, TradeGuide[]>();
    for (const g of tradeGuides) {
      const list = map.get(g.assetClass) ?? [];
      list.push(g);
      map.set(g.assetClass, list);
    }
    return map;
  }, [tradeGuides]);

  function handleSliderChange(assetClass: string, value: number) {
    setSimTargets(prev => {
      const others = prev.filter(t => t.asset_class !== assetClass);
      const otherSum = others.reduce((s, t) => s + t.target_ratio, 0);
      const clamped = Math.min(value, 100 - otherSum);
      return [...others, { asset_class: assetClass, target_ratio: Math.max(0, clamped) }];
    });
    setDirty(true);
    setActivePreset(null);
  }

  function applyPreset(name: string) {
    setSimTargets(PRESETS[name]);
    setDirty(true);
    setActivePreset(name);
  }

  function resetToSaved() {
    setSimTargets(savedTargets.length > 0 ? savedTargets : PRESETS.balanced);
    setDirty(false);
    setActivePreset(null);
  }

  async function saveTargets() {
    setSaving(true);
    try {
      const res = await fetch('/api/rebalancing', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targets: simTargets.filter(t => t.target_ratio > 0) }),
      });
      if (res.ok) {
        setSavedTargets(simTargets);
        setDirty(false);
      }
    } finally {
      setSaving(false);
    }
  }

  const totalRatio = simTargets.reduce((s, t) => s + t.target_ratio, 0);
  const ratioMap = new Map(simTargets.map(t => [t.asset_class, t.target_ratio]));

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="mx-auto max-w-5xl px-6 py-8 space-y-6">
          <Skeleton className="h-24 w-full rounded-xl" />
          <Skeleton className="h-64 w-full rounded-xl" />
          <Skeleton className="h-48 w-full rounded-xl" />
        </main>
      </div>
    );
  }

  // 자산 없음
  if (assets.length === 0) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
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
    urgent: { label: '긴급', color: 'bg-red-500/10 text-red-500 border-red-500/20' },
  };

  const status: RebalancingStatus = result?.status ?? 'balanced';
  const totalLiquid = result?.totalLiquid ?? 0;
  const activeSuggestions = result?.suggestions.filter(s => s.action !== 'hold') ?? [];

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="mx-auto max-w-5xl px-6 py-8 space-y-6">
        {/* 히어로 */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-muted-foreground mb-1">유동 자산 총액</p>
                <p className="text-3xl font-bold tabular-nums">{formatKRW(totalLiquid)}</p>
                <p className="text-xs text-muted-foreground mt-1">부동산 제외</p>
              </div>
              <Badge variant="outline" className={statusConfig[status].color}>
                {statusConfig[status].label}
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* 시뮬레이터 */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">목표 배분 {dirty && <span className="text-amber-500 font-normal">(수정 중)</span>}</CardTitle>
              <div className="flex gap-1">
                {(['conservative', 'balanced', 'aggressive'] as const).map(name => (
                  <button
                    key={name}
                    onClick={() => applyPreset(name)}
                    className={`px-2 py-1 text-xs rounded-full transition-colors ${
                      activePreset === name
                        ? 'bg-primary text-primary-foreground font-medium'
                        : 'bg-muted/50 text-muted-foreground hover:bg-muted'
                    }`}
                  >
                    {name === 'conservative' ? '안정' : name === 'balanced' ? '균형' : '공격'}
                  </button>
                ))}
              </div>
            </div>
            {Math.abs(totalRatio - 100) > 0.1 && (
              <p className="text-xs text-red-500 mt-1">합계 {totalRatio.toFixed(1)}% (100%가 되어야 합니다)</p>
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            {ASSET_CLASSES.map(cls => {
              const target = ratioMap.get(cls) ?? 0;
              const current = result?.allocations.find(a => a.assetClass === cls);
              const currentRatio = current?.currentRatio ?? 0;
              const diff = currentRatio - target;

              return (
                <div key={cls} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <div className={`w-2.5 h-2.5 rounded-full ${CLASS_COLORS[cls]}`} />
                      <span className="font-medium">{CLASS_LABELS[cls]}</span>
                    </div>
                    <div className="flex items-center gap-3 tabular-nums">
                      <span className="text-muted-foreground">{currentRatio.toFixed(1)}%</span>
                      <span className="text-muted-foreground">→</span>
                      <span className="font-medium w-12 text-right">{target.toFixed(1)}%</span>
                      {Math.abs(diff) >= 1 && (
                        <span className={`text-xs w-14 text-right ${diff > 0 ? 'text-red-500' : 'text-emerald-500'}`}>
                          {diff > 0 ? '+' : ''}{diff.toFixed(1)}%p
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <input
                      type="range"
                      min={0}
                      max={100}
                      step={1}
                      value={target}
                      onChange={e => handleSliderChange(cls, Number(e.target.value))}
                      className="flex-1 h-1.5 accent-current"
                    />
                  </div>
                </div>
              );
            })}

            {/* 저장/리셋 버튼 */}
            {dirty && (
              <div className="flex gap-2 pt-2">
                <Button variant="outline" size="sm" onClick={resetToSaved} className="flex-1">
                  되돌리기
                </Button>
                <Button
                  size="sm"
                  onClick={saveTargets}
                  disabled={saving || Math.abs(totalRatio - 100) > 0.1}
                  className="flex-1"
                >
                  {saving ? '저장 중...' : '목표 저장'}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 리밸런싱 제안 + 종목별 가이드 */}
        {status === 'balanced' && activeSuggestions.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center">
              <p className="text-2xl mb-2 text-emerald-500">&#10003;</p>
              <p className="text-sm font-medium text-emerald-500">포트폴리오가 균형 잡혀 있어요!</p>
              <p className="text-xs text-muted-foreground mt-1">목표 배분에 가깝습니다.</p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">리밸런싱 가이드</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              {activeSuggestions.map(s => {
                const guides = guidesByClass.get(s.assetClass) ?? [];
                const isExpanded = expandedClass === s.assetClass;
                const isSell = s.action === 'sell';

                return (
                  <div key={s.assetClass} className="border border-border rounded-lg overflow-hidden">
                    {/* 자산군 요약 (클릭하면 종목 펼침) */}
                    <button
                      onClick={() => setExpandedClass(isExpanded ? null : s.assetClass)}
                      className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition-colors text-left"
                    >
                      <div className="flex items-center gap-2">
                        <div className={`w-2.5 h-2.5 rounded-full ${CLASS_COLORS[s.assetClass]}`} />
                        <div>
                          <p className="text-sm font-medium">{CLASS_LABELS[s.assetClass]}</p>
                          <p className="text-xs text-muted-foreground">
                            {s.currentRatio.toFixed(1)}% → {s.targetRatio.toFixed(1)}%
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="text-right">
                          <p className={`text-sm font-semibold tabular-nums ${isSell ? 'text-red-500' : 'text-emerald-500'}`}>
                            {isSell ? '−' : '+'}{formatKRW(s.amount)}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {isSell ? '매도' : '매수'} · {Math.abs(s.diffPercent).toFixed(1)}%p
                          </p>
                        </div>
                        <span className="text-muted-foreground text-xs">{isExpanded ? '▲' : '▼'}</span>
                      </div>
                    </button>

                    {/* 종목별 가이드 (펼침) */}
                    {isExpanded && (
                      <div className="border-t border-border bg-muted/10 px-4 py-2 space-y-2">
                        {guides.length > 0 ? (
                          guides.map(g => (
                            <div key={g.ticker} className="flex items-center justify-between py-1.5">
                              <div>
                                <p className="text-sm">{g.name}</p>
                                <p className="text-xs text-muted-foreground tabular-nums">
                                  {g.ticker} · 현재가 {formatKRW(g.currentPrice)}
                                </p>
                              </div>
                              <div className="text-right">
                                <p className={`text-sm font-semibold tabular-nums ${g.action === 'sell' ? 'text-red-500' : 'text-emerald-500'}`}>
                                  {g.shares}주 {g.action === 'sell' ? '매도' : '매수'}
                                </p>
                                <p className="text-xs text-muted-foreground tabular-nums">
                                  약 {formatKRW(g.amount)}
                                </p>
                              </div>
                            </div>
                          ))
                        ) : (
                          <p className="text-xs text-muted-foreground py-2">
                            {s.action === 'buy'
                              ? '이 자산군에 종목이 없습니다. 새 종목을 매수하세요.'
                              : '현금성 자산이라 종목 단위 제안이 불가합니다.'}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </CardContent>
          </Card>
        )}

        {/* Stale 경고 */}
        {result?.hasStaleWarning && (
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 text-amber-500 text-xs">
            &#9888; 일부 자산의 시세가 7일 이상 지났습니다. 시세를 갱신한 후 다시 확인하세요.
          </div>
        )}

        {/* 확인 완료 + 이력 */}
        <div className="flex gap-3">
          <Button
            variant="outline"
            className="flex-1"
            onClick={() => setShowHistory(!showHistory)}
          >
            이력 {showHistory ? '닫기' : '보기'} {history.length > 0 && `(${history.length})`}
          </Button>
          <Button
            className="flex-1"
            disabled={checkSaving}
            onClick={async () => {
              setCheckSaving(true);
              try {
                const drifts = result?.suggestions.map(s => Math.abs(s.diffPercent)) ?? [];
                const maxDrift = drifts.length > 0 ? Math.max(...drifts) : 0;
                await fetch('/api/rebalancing/history', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    status,
                    maxDrift: maxDrift.toFixed(2),
                    suggestions: activeSuggestions,
                    totalLiquid,
                  }),
                });
                const res = await fetch('/api/rebalancing/history').then(r => r.json());
                setHistory(res.history ?? []);
              } catch {
                // silent fail
              } finally {
                setCheckSaving(false);
              }
            }}
          >
            {checkSaving ? '저장 중...' : '확인 완료'}
          </Button>
        </div>

        {/* 이력 목록 */}
        {showHistory && history.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">리밸런싱 이력</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {history.map(h => {
                const date = new Date(h.checked_at);
                const statusLabel = h.status === 'balanced' ? '균형' : h.status === 'urgent' ? '긴급' : '조정 필요';
                const statusColor = h.status === 'balanced' ? 'text-emerald-500' : h.status === 'urgent' ? 'text-red-500' : 'text-amber-500';
                return (
                  <div key={h.id} className="flex items-center justify-between py-2 border-b border-border/30 last:border-0">
                    <div>
                      <p className="text-sm tabular-nums">
                        {date.toLocaleDateString('ko-KR')} {date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        유동자산 {formatKRW(h.total_liquid)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className={`text-sm font-medium ${statusColor}`}>{statusLabel}</p>
                      <p className="text-xs text-muted-foreground tabular-nums">최대 편차 {Number(h.max_drift).toFixed(1)}%p</p>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}

function Header() {
  return (
    <header className="border-b border-border px-6 py-4">
      <div className="mx-auto max-w-5xl flex items-center gap-3">
        <Link href="/dashboard" className="text-sm text-muted-foreground">&larr; 대시보드</Link>
        <span className="text-lg font-semibold">리밸런싱</span>
      </div>
    </header>
  );
}
