'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { formatKRW, formatPercent, formatUsdKrw, formatUsd } from '@/lib/format';
import { StockTreemap } from '@/components/stock-treemap';
import { DividendCalendar } from '@/components/dividend-calendar';
import type { AssetWithPrice } from '@/types/database';
import type { DividendInfo } from '@/lib/dividends';

interface Props {
  stocks: AssetWithPrice[];
  dividends: DividendInfo[];
  exchangeRate?: number | null;
}

export function StockPortfolio({ stocks, dividends, exchangeRate }: Props) {
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
      <StockList stockReturns={stockReturns} exchangeRate={exchangeRate} />

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

type SortKey = 'name' | 'value' | 'return';

interface StockReturn extends AssetWithPrice {
  purchasePrice: number | null;
  returnRate: number | null;
  profit: number | null;
}

function StockList({ stockReturns, exchangeRate }: { stockReturns: StockReturn[]; exchangeRate?: number | null }) {
  const [sortKey, setSortKey] = useState<SortKey>('value');

  const sorted = useMemo(() => {
    const items = [...stockReturns];
    switch (sortKey) {
      case 'name':
        return items.sort((a, b) => a.name.localeCompare(b.name, 'ko'));
      case 'value':
        return items.sort((a, b) => b.current_value - a.current_value);
      case 'return':
        return items.sort((a, b) => (b.returnRate ?? -Infinity) - (a.returnRate ?? -Infinity));
    }
  }, [stockReturns, sortKey]);

  const sortButtons: { key: SortKey; label: string }[] = [
    { key: 'name', label: '가나다순' },
    { key: 'value', label: '금액순' },
    { key: 'return', label: '수익률순' },
  ];

  return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm">종목별 수익률</CardTitle>
            <div className="flex gap-1">
              {sortButtons.map(btn => (
                <button
                  key={btn.key}
                  onClick={() => setSortKey(btn.key)}
                  className={`px-2 py-1 text-[10px] rounded-full transition-colors ${
                    sortKey === btn.key
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted/50 text-muted-foreground hover:bg-muted'
                  }`}
                >
                  {btn.label}
                </button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {sorted.map((s) => (
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
                    <p className="text-sm font-semibold">
                      {s.price_source === 'yahoo_finance' && exchangeRate
                        ? formatUsdKrw(s.current_value, exchangeRate)
                        : formatKRW(s.current_value)
                      }
                    </p>
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

  );
}
