'use client';

import { useCallback, useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import type { RankingStock, RankingSort, RankingMarket } from '@/lib/market/rankings';

const MARKET_TABS: { key: RankingMarket; label: string }[] = [
  { key: 'domestic', label: '국내' },
  { key: 'foreign', label: '해외' },
];

const SORT_TABS: { key: RankingSort; label: string }[] = [
  { key: 'marketCap', label: '시가총액' },
  { key: 'tradingValue', label: '거래대금' },
  { key: 'gainers', label: '상승률' },
  { key: 'losers', label: '하락률' },
];

export function MarketRankings() {
  const [market, setMarket] = useState<RankingMarket>('domestic');
  const [sort, setSort] = useState<RankingSort>('marketCap');
  const [stocks, setStocks] = useState<RankingStock[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const load = useCallback(async (m: RankingMarket, s: RankingSort, p: number, append: boolean) => {
    if (append) setLoadingMore(true);
    else setLoading(true);

    try {
      const res = await fetch(`/api/market-rankings?market=${m}&sort=${s}&page=${p}`);
      const data = await res.json();
      setStocks((prev) => append ? [...prev, ...data.stocks] : data.stocks);
      setHasMore(data.hasMore);
      setPage(p);
    } catch {
      // ignore
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    load(market, sort, 1, false);
  }, [market, sort, load]);

  function handleMarketChange(m: RankingMarket) {
    setMarket(m);
    setPage(1);
  }

  function handleSortChange(s: RankingSort) {
    setSort(s);
    setPage(1);
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm">시장 순위</CardTitle>
          <div className="flex gap-1">
            {MARKET_TABS.map((tab) => (
              <button
                key={tab.key}
                onClick={() => handleMarketChange(tab.key)}
                className={`px-2.5 py-1 text-xs rounded-full transition-colors ${
                  market === tab.key
                    ? 'bg-primary text-primary-foreground font-medium'
                    : 'bg-muted/50 text-muted-foreground hover:bg-muted'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex gap-1 mt-2">
          {SORT_TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => handleSortChange(tab.key)}
              className={`px-2.5 py-1 text-xs rounded-md transition-colors ${
                sort === tab.key
                  ? 'bg-muted text-foreground font-medium'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-10 rounded bg-muted/50 animate-pulse" />
            ))}
          </div>
        ) : stocks.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">데이터를 불러올 수 없습니다</p>
        ) : (
          <>
            {/* Header */}
            <div className="flex items-center text-xs text-muted-foreground pb-2 border-b border-border/50">
              <span className="w-8 text-center">#</span>
              <span className="flex-1 ml-2">종목</span>
              <span className="w-24 text-right">현재가</span>
              <span className="w-16 text-right">등락률</span>
            </div>

            {/* Rows */}
            <div className="divide-y divide-border/30">
              {stocks.map((stock) => {
                const color = stock.direction === 'RISING'
                  ? 'text-emerald-500'
                  : stock.direction === 'FALLING'
                    ? 'text-red-500'
                    : 'text-muted-foreground';

                return (
                  <div key={`${stock.code}-${stock.rank}`} className="flex items-center py-2">
                    <span className="w-8 text-center text-xs text-muted-foreground tabular-nums">
                      {stock.rank}
                    </span>
                    <div className="flex-1 ml-2 min-w-0">
                      <div className="text-sm truncate">{stock.name}</div>
                      {(sort === 'marketCap' || sort === 'tradingValue') && (
                        <div className="text-xs text-muted-foreground truncate">
                          {sort === 'marketCap' ? stock.marketCap : stock.tradingValue}
                        </div>
                      )}
                    </div>
                    <span className="w-24 text-right text-sm tabular-nums">{stock.price}</span>
                    <span className={`w-16 text-right text-sm tabular-nums ${color}`}>
                      {stock.direction === 'RISING' ? '+' : ''}{stock.changePercent}%
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Load More */}
            {hasMore && (
              <Button
                variant="outline"
                size="sm"
                className="w-full mt-3"
                onClick={() => load(market, sort, page + 1, true)}
                disabled={loadingMore}
              >
                {loadingMore ? '불러오는 중...' : '더보기'}
              </Button>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
