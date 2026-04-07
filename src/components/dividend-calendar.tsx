'use client';

import { formatKRW } from '@/lib/format';
import type { DividendInfo } from '@/lib/dividends';
import type { AssetWithPrice } from '@/types/database';

interface Props {
  stocks: AssetWithPrice[];
  dividends: DividendInfo[];
}

const FREQUENCY_LABEL: Record<string, string> = {
  quarterly: '분기',
  semi_annual: '반기',
  annual: '연간',
};

export function DividendCalendar({ stocks, dividends }: Props) {
  if (dividends.length === 0) {
    return (
      <div className="text-center py-8 text-sm text-muted-foreground">
        배당 정보가 없습니다
      </div>
    );
  }

  // 연간 예상 배당금 계산
  const annualDividends = dividends.map((d) => {
    const stock = stocks.find((s) => s.ticker === d.ticker);
    const quantity = stock?.quantity ?? 0;
    let annualAmount = d.dividendPerShare * quantity;

    // 분기배당은 4배, 반기배당은 2배
    if (d.frequency === 'quarterly') annualAmount *= 4;
    else if (d.frequency === 'semi_annual') annualAmount *= 2;

    return {
      ...d,
      stockName: stock?.name ?? d.ticker,
      quantity,
      annualAmount,
    };
  });

  const totalAnnualDividend = annualDividends.reduce((sum, d) => sum + d.annualAmount, 0);

  return (
    <div className="space-y-4">
      {/* 연간 배당 요약 */}
      <div className="rounded-lg bg-muted/30 border border-border px-4 py-3">
        <p className="text-xs text-muted-foreground">연간 예상 배당금</p>
        <p className="text-2xl font-bold tabular-nums">{formatKRW(totalAnnualDividend)}</p>
        <p className="text-xs text-muted-foreground mt-1 tabular-nums">
          월 평균 {formatKRW(Math.round(totalAnnualDividend / 12))}
        </p>
      </div>

      {/* 종목별 배당 정보 */}
      <div className="space-y-2">
        {annualDividends
          .sort((a, b) => b.annualAmount - a.annualAmount)
          .map((d) => (
            <div
              key={d.ticker}
              className="flex items-center justify-between rounded-lg border border-border px-4 py-3"
            >
              <div>
                <p className="text-sm font-medium">{d.stockName}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-xs text-muted-foreground">
                    {d.ticker}
                  </span>
                  {d.frequency && (
                    <span className="text-xs bg-muted px-1.5 py-0.5 rounded">
                      {FREQUENCY_LABEL[d.frequency] ?? d.frequency}
                    </span>
                  )}
                  {d.dividendYield > 0 && (
                    <span className="text-xs text-emerald-500">
                      수익률 {d.dividendYield.toFixed(1)}%
                    </span>
                  )}
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold tabular-nums">{formatKRW(d.annualAmount)}</p>
                <p className="text-xs text-muted-foreground tabular-nums">
                  {d.dividendPerShare.toLocaleString()}원 × {d.quantity}주
                </p>
                {d.exDate && (
                  <p className="text-xs text-muted-foreground">
                    배당락 {d.exDate}
                  </p>
                )}
                {d.paymentDate && (
                  <p className="text-xs text-muted-foreground">
                    지급일 {d.paymentDate}
                  </p>
                )}
              </div>
            </div>
          ))}
      </div>
    </div>
  );
}
