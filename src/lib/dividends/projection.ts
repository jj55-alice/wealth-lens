// 월별 배당금 projection.
// 과거 이벤트 패턴으로 향후 12개월 예상 배당을 계산한다.
// - 미래 ex_date 가 이미 있는 이벤트는 그대로 사용
// - 없으면: 각 이벤트를 `+1년` 해 미래로 투사 (한국 결산배당, 해외 분기/월배당 모두 연 단위 반복 가정)

import type { DividendEvent } from '@/lib/dividends';

export interface Holding {
  ticker: string;
  quantity: number;
  currency: 'KRW' | 'USD';
}

export interface ProjectedEvent {
  ticker: string;
  exDate: string;           // YYYY-MM-DD (KST date)
  paymentDate: string | null;
  amountPerShare: number;   // 원 통화
  amountKrw: number;        // 원화 환산 (quantity × amountPerShare × fx)
  quantity: number;
  currency: 'KRW' | 'USD';
  projected: boolean;       // true면 과거 패턴 기반 추정
}

export interface MonthlyDividend {
  year: number;
  month: number;            // 1-12
  /** 원화 환산 합계 */
  totalKrw: number;
  events: ProjectedEvent[];
}

interface ProjectOptions {
  /** 기준일 (기본: 오늘 KST). */
  now?: Date;
  /** 앞으로 몇 개월을 포함할지 (기본 12). */
  months?: number;
  /** 환율 맵. 예: { USD: 1450 }. 미지정 시 1. */
  fxToKrw?: Partial<Record<'KRW' | 'USD', number>>;
}

function addYears(isoDate: string, years: number): string {
  const [y, m, d] = isoDate.split('-').map((n) => parseInt(n, 10));
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCFullYear(dt.getUTCFullYear() + years);
  return dt.toISOString().slice(0, 10);
}

function monthKey(iso: string): { year: number; month: number } {
  const [y, m] = iso.split('-').map((n) => parseInt(n, 10));
  return { year: y, month: m };
}

function kstToday(): Date {
  // KST = UTC+9. 날짜만 필요하므로 ISO 문자열 앞 10자리만 쓰면 됨.
  return new Date(Date.now() + 9 * 3600 * 1000);
}

/**
 * 보유 종목 + 과거 이벤트 배열을 받아 향후 N개월 월별 배당 예상치를 계산.
 */
export function projectMonthlyDividends(
  holdings: Holding[],
  events: DividendEvent[],
  options: ProjectOptions = {},
): MonthlyDividend[] {
  const now = options.now ?? kstToday();
  const months = options.months ?? 12;
  const fx = { KRW: 1, USD: options.fxToKrw?.USD ?? 1 } as Record<
    'KRW' | 'USD',
    number
  >;
  if (options.fxToKrw?.KRW != null) fx.KRW = options.fxToKrw.KRW;

  // ticker → holding
  const holdingMap = new Map<string, Holding>();
  for (const h of holdings) holdingMap.set(h.ticker, h);

  // 기준일(오늘 KST 날짜 문자열) 과 상한
  const todayIso = now.toISOString().slice(0, 10);
  const endDate = new Date(now);
  endDate.setUTCMonth(endDate.getUTCMonth() + months);
  const endIso = endDate.toISOString().slice(0, 10);

  // 월 버킷 초기화
  const buckets = new Map<string, MonthlyDividend>();
  const cursor = new Date(now);
  for (let i = 0; i < months; i++) {
    const y = cursor.getUTCFullYear();
    const m = cursor.getUTCMonth() + 1;
    buckets.set(`${y}-${m}`, { year: y, month: m, totalKrw: 0, events: [] });
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }

  // ticker별 이벤트 그룹
  const byTicker = new Map<string, DividendEvent[]>();
  for (const ev of events) {
    const list = byTicker.get(ev.ticker) ?? [];
    list.push(ev);
    byTicker.set(ev.ticker, list);
  }

  for (const [ticker, holding] of holdingMap) {
    const tickerEvents = byTicker.get(ticker) ?? [];
    if (tickerEvents.length === 0 || holding.quantity <= 0) continue;

    const seenKeys = new Set<string>();

    // 1) 미래(또는 오늘) 이벤트 먼저
    for (const ev of tickerEvents) {
      if (ev.exDate >= todayIso && ev.exDate < endIso) {
        addEvent(buckets, holding, ev, ev.exDate, ev.paymentDate, fx, false);
        seenKeys.add(ev.exDate);
      }
    }

    // 2) 과거 이벤트 → +N년 투사. 한 이벤트당 가장 가까운 미래 1회만 추가.
    for (const ev of tickerEvents) {
      if (ev.exDate >= todayIso) continue;
      let yearsAhead = 1;
      while (yearsAhead <= 10) {
        const projectedEx = addYears(ev.exDate, yearsAhead);
        if (projectedEx >= endIso) break;
        if (projectedEx >= todayIso) {
          if (!seenKeys.has(projectedEx)) {
            const projectedPay = ev.paymentDate
              ? addYears(ev.paymentDate, yearsAhead)
              : null;
            addEvent(buckets, holding, ev, projectedEx, projectedPay, fx, true);
            seenKeys.add(projectedEx);
          }
          break;
        }
        yearsAhead++;
      }
    }
  }

  // 월순 정렬
  return Array.from(buckets.values())
    .sort((a, b) =>
      a.year !== b.year ? a.year - b.year : a.month - b.month,
    )
    .map((m) => ({
      ...m,
      events: m.events.sort((a, b) => a.exDate.localeCompare(b.exDate)),
    }));
}

function addEvent(
  buckets: Map<string, MonthlyDividend>,
  holding: Holding,
  baseEvent: DividendEvent,
  exDate: string,
  paymentDate: string | null,
  fx: Record<'KRW' | 'USD', number>,
  projected: boolean,
): void {
  const rate = fx[baseEvent.currency] ?? 1;
  const amountKrw =
    baseEvent.amountPerShare * holding.quantity * rate;
  const { year, month } = monthKey(exDate);
  const key = `${year}-${month}`;
  const bucket = buckets.get(key);
  if (!bucket) return;
  bucket.totalKrw += amountKrw;
  bucket.events.push({
    ticker: baseEvent.ticker,
    exDate,
    paymentDate,
    amountPerShare: baseEvent.amountPerShare,
    amountKrw,
    quantity: holding.quantity,
    currency: baseEvent.currency,
    projected,
  });
}

/**
 * 향후 12개월 합계 + 월평균.
 */
export function summarizeProjection(
  projection: MonthlyDividend[],
): { annualKrw: number; monthlyAvgKrw: number } {
  const annualKrw = projection.reduce((s, m) => s + m.totalKrw, 0);
  const monthlyAvgKrw =
    projection.length > 0 ? annualKrw / projection.length : 0;
  return { annualKrw, monthlyAvgKrw };
}
