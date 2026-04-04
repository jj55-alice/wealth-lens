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

function formatPrice(price: number | null): string {
  if (price === null) return '';
  return price.toLocaleString('ko-KR') + '원';
}

export function StockSearch({ onSelect, placeholder = '종목명 검색 (예: 삼성전자, AAPL)', showMarketFilter = true }: Props) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<StockSearchResult[]>([]);
  const [filteredResults, setFilteredResults] = useState<StockSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<StockSearchResult | null>(null);
  const [marketFilter, setMarketFilter] = useState('all');
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!query || query.length < 1 || selected) {
      setResults([]);
      setFilteredResults([]);
      setOpen(false);
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
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(debounceRef.current);
  }, [query, selected]);

  // Apply market filter
  useEffect(() => {
    if (marketFilter === 'all') {
      setFilteredResults(results);
    } else {
      const filter = MARKET_FILTERS.find((f) => f.value === marketFilter);
      const allowedMarkets = filter?.markets ?? [];
      setFilteredResults(results.filter((r) => allowedMarkets.includes(r.market)));
    }
  }, [results, marketFilter]);

  // Close on click outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  function handleSelect(result: StockSearchResult) {
    setSelected(result);
    setQuery(`${result.name} (${result.ticker})`);
    setOpen(false);
    onSelect(result);
  }

  function handleClear() {
    setSelected(null);
    setQuery('');
    setResults([]);
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
          }}
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
          <span className="text-muted-foreground">현재가: </span>
          <span className="font-semibold">{formatPrice(selected.currentPrice)}</span>
        </div>
      )}

      {open && filteredResults.length > 0 && (
        <div className="absolute z-50 mt-1 w-full rounded-lg border border-border bg-card shadow-lg max-h-60 overflow-y-auto">
          {filteredResults.map((result, i) => (
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
        </div>
      )}
    </div>
  );
}
