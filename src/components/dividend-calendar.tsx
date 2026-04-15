'use client';

import { useMemo } from 'react';
import { formatKRW } from '@/lib/format';
import type { DividendInfo } from '@/lib/dividends';
import type { MonthlyDividend, ProjectedEvent } from '@/lib/dividends/projection';
import type { AssetWithPrice } from '@/types/database';

interface Props {
  stocks: AssetWithPrice[];
  dividends: DividendInfo[];
  projection: MonthlyDividend[];
  annualKrw: number;
  monthlyAvgKrw: number;
}

const MONTH_LABELS = ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'];

function daysUntil(dateStr: string): number {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const [y, m, d] = dateStr.split('-').map((n) => parseInt(n, 10));
  const target = new Date(y, m - 1, d);
  return Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

export function DividendCalendar({
  stocks,
  dividends,
  projection,
  annualKrw,
  monthlyAvgKrw,
}: Props) {
  const stockNameMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const s of stocks) {
      if (s.ticker) m.set(s.ticker, s.name);
    }
    return m;
  }, [stocks]);

  const maxMonthKrw = useMemo(
    () => projection.reduce((max, m) => Math.max(max, m.totalKrw), 0),
    [projection],
  );

  // 현재 월 기준 "이번 달 예상 배당"
  const currentMonth = useMemo(() => {
    if (projection.length === 0) return null;
    return projection[0];
  }, [projection]);

  // 다가오는 배당락일 (D-7 이내 하이라이트 대상)
  const upcomingEvents = useMemo(() => {
    const all: Array<ProjectedEvent & { dday: number }> = [];
    for (const month of projection) {
      for (const ev of month.events) {
        const dday = daysUntil(ev.exDate);
        if (dday >= 0 && dday <= 60) {
          all.push({ ...ev, dday });
        }
      }
    }
    return all.sort((a, b) => a.dday - b.dday).slice(0, 5);
  }, [projection]);

  if (projection.length === 0 && dividends.length === 0) {
    return (
      <div className="text-center py-8 text-sm text-muted-foreground">
        배당 정보가 없습니다
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* 상단 요약 */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-lg bg-muted/30 border border-border px-4 py-3">
          <p className="text-xs text-muted-foreground">향후 12개월 예상 배당</p>
          <p className="text-2xl font-bold tabular-nums mt-1">{formatKRW(annualKrw)}</p>
          <p className="text-xs text-muted-foreground mt-1 tabular-nums">
            월 평균 {formatKRW(Math.round(monthlyAvgKrw))}
          </p>
        </div>
        <div className="rounded-lg bg-muted/30 border border-border px-4 py-3">
          <p className="text-xs text-muted-foreground">이번 달 예상 배당</p>
          <p className="text-2xl font-bold tabular-nums mt-1">
            {formatKRW(Math.round(currentMonth?.totalKrw ?? 0))}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {currentMonth
              ? `${currentMonth.year}년 ${currentMonth.month}월 · ${currentMonth.events.length}건`
              : '—'}
          </p>
        </div>
      </div>

      {/* 월별 배당 달력 */}
      {projection.length > 0 && (
        <div>
          <h3 className="text-xs font-medium text-muted-foreground mb-2">월별 예상 배당</h3>
          <div className="grid grid-cols-6 gap-1.5 sm:grid-cols-12">
            {projection.map((month) => {
              const ratio = maxMonthKrw > 0 ? month.totalKrw / maxMonthKrw : 0;
              const hasEvents = month.events.length > 0;
              return (
                <div
                  key={`${month.year}-${month.month}`}
                  className={`rounded-md border px-2 py-2 ${
                    hasEvents ? 'border-border bg-muted/20' : 'border-border/40'
                  }`}
                  title={month.events
                    .map(
                      (e) =>
                        `${stockNameMap.get(e.ticker) ?? e.ticker} · ${e.exDate} · ${formatKRW(Math.round(e.amountKrw))}`,
                    )
                    .join('\n')}
                >
                  <p className="text-[10px] text-muted-foreground">
                    {MONTH_LABELS[month.month - 1]}
                  </p>
                  <p
                    className={`text-xs tabular-nums font-medium mt-0.5 ${
                      hasEvents ? 'text-foreground' : 'text-muted-foreground/60'
                    }`}
                  >
                    {hasEvents ? formatKRW(Math.round(month.totalKrw)) : '—'}
                  </p>
                  {hasEvents && (
                    <div className="mt-1.5 h-1 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full bg-emerald-500"
                        style={{ width: `${Math.max(8, ratio * 100)}%` }}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 다가오는 배당락일 */}
      {upcomingEvents.length > 0 && (
        <div>
          <h3 className="text-xs font-medium text-muted-foreground mb-2">다가오는 배당락일</h3>
          <div className="space-y-1.5">
            {upcomingEvents.map((ev) => {
              const name = stockNameMap.get(ev.ticker) ?? ev.ticker;
              const urgent = ev.dday <= 7;
              return (
                <div
                  key={`${ev.ticker}-${ev.exDate}`}
                  className={`flex items-center justify-between rounded-lg border px-3 py-2 ${
                    urgent
                      ? 'border-amber-500/40 bg-amber-500/5'
                      : 'border-border'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-xs font-semibold tabular-nums w-10 text-center rounded ${
                        urgent
                          ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400'
                          : 'bg-muted text-muted-foreground'
                      } px-1.5 py-0.5`}
                    >
                      D{ev.dday === 0 ? '-day' : `-${ev.dday}`}
                    </span>
                    <div>
                      <p className="text-sm font-medium">{name}</p>
                      <p className="text-xs text-muted-foreground tabular-nums">
                        {ev.exDate}
                        {ev.projected && <span className="ml-1 opacity-60">(추정)</span>}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold tabular-nums">
                      {formatKRW(Math.round(ev.amountKrw))}
                    </p>
                    <p className="text-[10px] text-muted-foreground tabular-nums">
                      {ev.currency === 'USD'
                        ? `$${ev.amountPerShare.toFixed(2)}`
                        : `${ev.amountPerShare.toLocaleString()}원`}{' '}
                      × {ev.quantity}주
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 종목별 연간 합계 */}
      {projection.length > 0 && (
        <PerTickerSummary projection={projection} stockNameMap={stockNameMap} />
      )}
    </div>
  );
}

function PerTickerSummary({
  projection,
  stockNameMap,
}: {
  projection: MonthlyDividend[];
  stockNameMap: Map<string, string>;
}) {
  const rows = useMemo(() => {
    const map = new Map<
      string,
      { ticker: string; totalKrw: number; count: number; currency: 'KRW' | 'USD' }
    >();
    for (const month of projection) {
      for (const ev of month.events) {
        const r = map.get(ev.ticker) ?? {
          ticker: ev.ticker,
          totalKrw: 0,
          count: 0,
          currency: ev.currency,
        };
        r.totalKrw += ev.amountKrw;
        r.count += 1;
        map.set(ev.ticker, r);
      }
    }
    return Array.from(map.values()).sort((a, b) => b.totalKrw - a.totalKrw);
  }, [projection]);

  if (rows.length === 0) return null;

  return (
    <div>
      <h3 className="text-xs font-medium text-muted-foreground mb-2">종목별 연간 배당 합계</h3>
      <div className="space-y-1.5">
        {rows.map((r) => (
          <div
            key={r.ticker}
            className="flex items-center justify-between rounded-lg border border-border px-3 py-2"
          >
            <div>
              <p className="text-sm font-medium">{stockNameMap.get(r.ticker) ?? r.ticker}</p>
              <p className="text-xs text-muted-foreground">
                {r.ticker} · 연 {r.count}회 지급
              </p>
            </div>
            <p className="text-sm font-semibold tabular-nums">
              {formatKRW(Math.round(r.totalKrw))}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
