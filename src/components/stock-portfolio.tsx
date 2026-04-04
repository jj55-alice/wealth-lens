'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { formatKRW, formatPercent } from '@/lib/format';
import { StockTreemap } from '@/components/stock-treemap';
import { DividendCalendar } from '@/components/dividend-calendar';
import type { AssetWithPrice } from '@/types/database';
import type { DividendInfo } from '@/lib/dividends';

interface Props {
  stocks: AssetWithPrice[];
  dividends: DividendInfo[];
}

export function StockPortfolio({ stocks, dividends }: Props) {
  // 총 투자금 계산
  const totalInvested = stocks.reduce((sum, s) => {
    const pp = (s as unknown as { purchase_price: number | null }).purchase_price;
    if (pp && s.quantity) return sum + pp * s.quantity;
    return sum;
  }, 0);

  // 총 평가액
  const totalCurrentValue = stocks.reduce((sum, s) => sum + s.current_value, 0);

  // 총 수익
  const totalProfit = totalInvested > 0 ? totalCurrentValue - totalInvested : 0;
  const totalReturnRate = totalInvested > 0 ? (totalProfit / totalInvested) * 100 : 0;

  // 종목별 수익률
  const stockReturns = stocks.map((s) => {
    const pp = (s as unknown as { purchase_price: number | null }).purchase_price;
    const currentPrice = s.current_price ?? 0;
    const returnRate = pp && pp > 0 ? ((currentPrice - pp) / pp) * 100 : null;
    const profit = pp && s.quantity ? (currentPrice - pp) * s.quantity : null;

    return {
      ...s,
      purchasePrice: pp,
      returnRate,
      profit,
    };
  });

  return (
    <div className="space-y-6">
      {/* 수익률 요약 */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-xs text-muted-foreground">총 투자금</p>
              <p className="text-lg font-semibold">{formatKRW(totalInvested)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">총 평가액</p>
              <p className="text-lg font-semibold">{formatKRW(totalCurrentValue)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">총 수익</p>
              <p className={`text-lg font-semibold ${totalProfit >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                {totalProfit >= 0 ? '+' : ''}{formatKRW(totalProfit)}
              </p>
              {totalInvested > 0 && (
                <p className={`text-xs ${totalReturnRate >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                  {formatPercent(totalReturnRate)}
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Treemap */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">포트폴리오 구성</CardTitle>
        </CardHeader>
        <CardContent>
          <StockTreemap stocks={stocks} />
        </CardContent>
      </Card>

      {/* 종목별 수익률 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">종목별 수익률</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {stockReturns
              .sort((a, b) => b.current_value - a.current_value)
              .map((s) => (
                <div
                  key={s.id}
                  className="flex items-center justify-between rounded-lg border border-border px-4 py-3"
                >
                  <div>
                    <p className="text-sm font-medium">{s.name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-muted-foreground">{s.ticker}</span>
                      {s.quantity && (
                        <span className="text-xs text-muted-foreground">{s.quantity}주</span>
                      )}
                      {s.brokerage && (
                        <span className="text-xs text-muted-foreground">{s.brokerage}</span>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold">{formatKRW(s.current_value)}</p>
                    {s.returnRate !== null ? (
                      <p className={`text-xs ${s.returnRate >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                        {s.returnRate >= 0 ? '+' : ''}{s.returnRate.toFixed(1)}%
                        {s.profit !== null && (
                          <span className="ml-1">
                            ({s.profit >= 0 ? '+' : ''}{formatKRW(s.profit)})
                          </span>
                        )}
                      </p>
                    ) : (
                      <p className="text-xs text-muted-foreground">매수가 미입력</p>
                    )}
                  </div>
                </div>
              ))}
          </div>
        </CardContent>
      </Card>

      {/* 배당금 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">배당금 정보</CardTitle>
        </CardHeader>
        <CardContent>
          <DividendCalendar stocks={stocks} dividends={dividends} />
        </CardContent>
      </Card>
    </div>
  );
}
