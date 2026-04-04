'use client';

import { useState, useEffect, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import type { StockSearchResult } from '@/app/api/search/route';

interface Props {
  onSelect: (result: StockSearchResult) => void;
  placeholder?: string;
  showMarketFilter?: boolean;
}

const MARKET_COLORS: Record<string, string> = {
  KOSPI: 'bg-blue-500/20 text-blue-400',
  KOSDAQ: 'bg-purple-500/20 text-purple-400',
  NASDAQ: 'bg-emerald-500/20 text-emerald-400',
  NYSE: 'bg-amber-500/20 text-amber-400',
  AMEX: 'bg-red-500/20 text-red-400',
};

const MARKET_FILTERS = [
  { value: 'all', label: '전체' },
  { value: 'domestic', label: '국내', markets: ['KOSPI', 'KOSDAQ'] },
  { value: 'foreign', label: '해외', markets: ['NASDAQ', 'NYSE', 'AMEX'] },
];

// 자주 거래되는 주요 종목 (포커스 시 기본 표시)
const POPULAR_STOCKS: StockSearchResult[] = [
  { name: '삼성전자', ticker: '005930', market: 'KOSPI', priceSource: 'krx', currentPrice: null },
  { name: 'SK하이닉스', ticker: '000660', market: 'KOSPI', priceSource: 'krx', currentPrice: null },
  { name: 'NAVER', ticker: '035420', market: 'KOSPI', priceSource: 'krx', currentPrice: null },
  { name: '카카오', ticker: '035720', market: 'KOSPI', priceSource: 'krx', currentPrice: null },
  { name: '현대자동차', ticker: '005380', market: 'KOSPI', priceSource: 'krx', currentPrice: null },
  { name: 'LG에너지솔루션', ticker: '373220', market: 'KOSPI', priceSource: 'krx', currentPrice: null },
  { name: '삼성바이오로직스', ticker: '207940', market: 'KOSPI', priceSource: 'krx', currentPrice: null },
  { name: 'Apple', ticker: 'AAPL', market: 'NASDAQ', priceSource: 'yahoo_finance', currentPrice: null },
  { name: 'Microsoft', ticker: 'MSFT', market: 'NASDAQ', priceSource: 'yahoo_finance', currentPrice: null },
  { name: 'NVIDIA', ticker: 'NVDA', market: 'NASDAQ', priceSource: 'yahoo_finance', currentPrice: null },
  { name: 'Tesla', ticker: 'TSLA', market: 'NASDAQ', priceSource: 'yahoo_finance', currentPrice: null },
  { name: 'Amazon', ticker: 'AMZN', market: 'NASDAQ', priceSource: 'yahoo_finance', currentPrice: null },
  { name: 'Alphabet (Google)', ticker: 'GOOGL', market: 'NASDAQ', priceSource: 'yahoo_finance', currentPrice: null },
  { name: 'Meta', ticker: 'META', market: 'NASDAQ', priceSource: 'yahoo_finance', currentPrice: null },
];

function formatPrice(price: number | null): string {
  if (price === null) return '';
  return price.toLocaleString('ko-KR') + '원';
}

export function StockSearch({ onSelect, placeholder = '종목명 검색 (예: 삼성전자, AAPL)', showMarketFilter = true }: Props) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<StockSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<StockSearchResult | null>(null);
  const [marketFilter, setMarketFilter] = useState('all');
  const [priceUsd, setPriceUsd] = useState<number | null>(null);
  const [exchangeRate, setExchangeRate] = useState<number | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const containerRef = useRef<HTMLDivElement>(null);

  // 검색 결과 가져오기
  useEffect(() => {
    if (selected) {
      setResults([]);
      setOpen(false);
      return;
    }

    // 검색어가 없으면 인기 종목 표시
    if (!query) {
      setResults(POPULAR_STOCKS);
      // open 상태는 유지 (포커스로 제어)
      return;
    }

    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
        const data = await res.json();
        setResults(data);
        setOpen(data.length > 0);
      } catch {
        setResults([]);
        setOpen(false);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(debounceRef.current);
  }, [query, selected]);

  // 마켓 필터 적용
  const displayResults = (() => {
    if (marketFilter === 'all') return results;
    const filter = MARKET_FILTERS.find((f) => f.value === marketFilter);
    const allowedMarkets = filter?.markets ?? [];
    return results.filter((r) => allowedMarkets.includes(r.market));
  })();

  // 클릭 외부 닫기
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  async function handleSelect(result: StockSearchResult) {
    setSelected(result);
    setQuery(`${result.name} (${result.ticker})`);
    setOpen(false);
    setPriceUsd(null);
    setExchangeRate(null);

    // 실시간 시세 조회 (달러/원화 정보 포함)
    try {
      const res = await fetch(
        `/api/prices/quote?ticker=${encodeURIComponent(result.ticker)}&source=${result.priceSource}`
      );
      const data = await res.json();
      if (data.price) {
        const updated = { ...result, currentPrice: data.price };
        setSelected(updated);
        if (data.priceUsd) setPriceUsd(data.priceUsd);
        if (data.exchangeRate) setExchangeRate(data.exchangeRate);
        onSelect(updated);
        return;
      }
    } catch {
      // 조회 실패해도 선택은 유지
    }

    onSelect(result);
  }

  function handleClear() {
    setSelected(null);
    setQuery('');
    setResults(POPULAR_STOCKS);
    setPriceUsd(null);
    setExchangeRate(null);
  }

  function handleFocus() {
    if (!selected) {
      setOpen(true);
    }
  }

  return (
    <div ref={containerRef} className="relative space-y-2">
      {showMarketFilter && (
        <div className="flex gap-1">
          {MARKET_FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => setMarketFilter(f.value)}
              className={`px-3 py-1 text-xs rounded-full border transition-colors ${
                marketFilter === f.value
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'border-border text-muted-foreground hover:bg-muted/50'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      )}

      <div className="relative">
        <Input
          aria-label="종목 검색"
          placeholder={placeholder}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            if (selected) setSelected(null);
            setOpen(true);
          }}
          onFocus={handleFocus}
          maxLength={100}
        />
        {selected && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground text-sm"
          >
            ✕
          </button>
        )}
        {loading && (
          <div className="absolute right-2 top-1/2 -translate-y-1/2">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
          </div>
        )}
      </div>

      {/* 선택된 종목 현재가 표시 */}
      {selected?.currentPrice && (
        <div className="rounded-lg bg-muted/50 px-3 py-2 text-sm">
          {priceUsd ? (
            <div className="space-y-0.5">
              <div>
                <span className="text-muted-foreground">현재가: </span>
                <span className="font-semibold">${priceUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                <span className="text-muted-foreground ml-1">({formatPrice(selected.currentPrice)})</span>
              </div>
              {exchangeRate && (
                <div className="text-xs text-muted-foreground">
                  환율: ${1} = {exchangeRate.toLocaleString('ko-KR')}원
                </div>
              )}
            </div>
          ) : (
            <div>
              <span className="text-muted-foreground">현재가: </span>
              <span className="font-semibold">{formatPrice(selected.currentPrice)}</span>
            </div>
          )}
        </div>
      )}

      {open && displayResults.length > 0 && (
        <div className="absolute z-50 mt-1 w-full rounded-lg border border-border bg-card shadow-lg max-h-60 overflow-y-auto">
          {!query && (
            <div className="px-3 py-1.5 text-[10px] text-muted-foreground uppercase tracking-wider border-b border-border">
              주요 종목
            </div>
          )}
          {displayResults.map((result, i) => (
            <button
              key={`${result.ticker}-${i}`}
              type="button"
              onClick={() => handleSelect(result)}
              className="w-full px-3 py-2 text-left hover:bg-muted/50 flex items-center justify-between transition-colors"
            >
              <div>
                <p className="text-sm font-medium">{result.name}</p>
                <p className="text-xs text-muted-foreground">{result.ticker}</p>
              </div>
              <div className="flex items-center gap-2">
                {result.currentPrice && (
                  <span className="text-xs text-muted-foreground">
                    {formatPrice(result.currentPrice)}
                  </span>
                )}
                <Badge
                  variant="secondary"
                  className={`text-[10px] ${MARKET_COLORS[result.market] ?? ''}`}
                >
                  {result.market}
                </Badge>
              </div>
            </button>
          ))}
          {!query && (
            <div className="px-3 py-2 text-xs text-muted-foreground border-t border-border">
              검색어를 입력하면 더 많은 종목을 찾을 수 있습니다
            </div>
          )}
        </div>
      )}
    </div>
  );
}
