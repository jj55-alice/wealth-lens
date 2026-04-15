import { describe, it, expect } from 'vitest';
import {
  projectMonthlyDividends,
  summarizeProjection,
  type Holding,
} from '@/lib/dividends/projection';
import type { DividendEvent } from '@/lib/dividends';

// 2026-04-15 기준으로 고정
const FIXED_NOW = new Date('2026-04-15T00:00:00Z');

describe('projectMonthlyDividends', () => {
  it('분기배당 미국 주식 - 과거 4회 이벤트로 향후 12개월 4회 투사', () => {
    const holdings: Holding[] = [
      { ticker: 'MSFT', quantity: 10, currency: 'USD' },
    ];
    // 2025년 3월/6월/9월/12월에 각 $0.75
    const events: DividendEvent[] = [
      mkEvent('MSFT', '2025-03-12', 0.75, 'USD'),
      mkEvent('MSFT', '2025-06-12', 0.75, 'USD'),
      mkEvent('MSFT', '2025-09-12', 0.75, 'USD'),
      mkEvent('MSFT', '2025-12-12', 0.75, 'USD'),
    ];

    const projection = projectMonthlyDividends(holdings, events, {
      now: FIXED_NOW,
      months: 12,
      fxToKrw: { USD: 1400 },
    });

    // 12개월 버킷 모두 존재
    expect(projection).toHaveLength(12);
    // 4회 지급(2026-06, 09, 12, 2027-03) 예상, 각 $7.5 = 10,500원
    const totalEvents = projection.flatMap((m) => m.events);
    expect(totalEvents).toHaveLength(4);
    expect(totalEvents.every((e) => e.projected)).toBe(true);

    const { annualKrw } = summarizeProjection(projection);
    expect(annualKrw).toBeCloseTo(4 * 0.75 * 10 * 1400, 0); // 42,000원
  });

  it('한국 결산배당 - 12월 이벤트 1회만 투사', () => {
    const holdings: Holding[] = [
      { ticker: '005930', quantity: 100, currency: 'KRW' },
    ];
    const events: DividendEvent[] = [
      mkEvent('005930', '2025-12-28', 1500, 'KRW'),
    ];

    const projection = projectMonthlyDividends(holdings, events, {
      now: FIXED_NOW,
      months: 12,
    });

    const december = projection.find((m) => m.year === 2026 && m.month === 12);
    expect(december).toBeDefined();
    expect(december!.events).toHaveLength(1);
    expect(december!.totalKrw).toBe(1500 * 100); // 150,000원
    expect(december!.events[0].projected).toBe(true);

    const { annualKrw } = summarizeProjection(projection);
    expect(annualKrw).toBe(150_000);
  });

  it('미래 이벤트(이미 공시된)는 +1년 투사하지 않고 그대로 사용', () => {
    const holdings: Holding[] = [
      { ticker: 'AAPL', quantity: 5, currency: 'USD' },
    ];
    const events: DividendEvent[] = [
      mkEvent('AAPL', '2026-05-10', 0.25, 'USD'), // 미래 (공시됨)
      mkEvent('AAPL', '2025-05-10', 0.24, 'USD'), // 과거 → +1년 하면 2026-05-10 이지만 중복 제거
    ];

    const projection = projectMonthlyDividends(holdings, events, {
      now: FIXED_NOW,
      months: 12,
      fxToKrw: { USD: 1400 },
    });

    const may = projection.find((m) => m.year === 2026 && m.month === 5);
    expect(may).toBeDefined();
    expect(may!.events).toHaveLength(1);
    // 미래 이벤트가 우선 → projected=false, amount=0.25
    expect(may!.events[0].projected).toBe(false);
    expect(may!.events[0].amountPerShare).toBe(0.25);
  });

  it('월배당(예: O, REALTY INCOME) - 12개월 모두 이벤트', () => {
    const holdings: Holding[] = [{ ticker: 'O', quantity: 10, currency: 'USD' }];
    const events: DividendEvent[] = Array.from({ length: 12 }, (_, i) =>
      mkEvent('O', `2025-${String(i + 1).padStart(2, '0')}-15`, 0.26, 'USD'),
    );

    const projection = projectMonthlyDividends(holdings, events, {
      now: FIXED_NOW,
      months: 12,
      fxToKrw: { USD: 1400 },
    });

    const totalEvents = projection.flatMap((m) => m.events);
    expect(totalEvents).toHaveLength(12);
    const { annualKrw } = summarizeProjection(projection);
    expect(annualKrw).toBeCloseTo(12 * 0.26 * 10 * 1400, 0);
  });

  it('보유 수량 0이면 projection 제외', () => {
    const holdings: Holding[] = [{ ticker: 'MSFT', quantity: 0, currency: 'USD' }];
    const events: DividendEvent[] = [mkEvent('MSFT', '2025-12-12', 0.75, 'USD')];

    const projection = projectMonthlyDividends(holdings, events, {
      now: FIXED_NOW,
    });
    const totalEvents = projection.flatMap((m) => m.events);
    expect(totalEvents).toHaveLength(0);
  });

  it('환율 미지정이면 USD=1 로 원화 환산 (로직 확인용)', () => {
    const holdings: Holding[] = [{ ticker: 'MSFT', quantity: 10, currency: 'USD' }];
    const events: DividendEvent[] = [mkEvent('MSFT', '2025-06-12', 0.75, 'USD')];
    const projection = projectMonthlyDividends(holdings, events, {
      now: FIXED_NOW,
    });
    const { annualKrw } = summarizeProjection(projection);
    expect(annualKrw).toBe(0.75 * 10 * 1);
  });
});

function mkEvent(
  ticker: string,
  exDate: string,
  amt: number,
  currency: 'KRW' | 'USD',
): DividendEvent {
  return {
    ticker,
    exDate,
    paymentDate: null,
    recordDate: null,
    amountPerShare: amt,
    currency,
    source: 'fmp',
  };
}
