'use client';

import { useState, useEffect, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import type { StockSearchResult } from '@/app/api/search/route';

interface Props {
  onSelect: (result: StockSearchResult) => void;
  placeholder?: string;
}

const MARKET_COLORS: Record<string, string> = {
  KOSPI: 'bg-blue-500/20 text-blue-400',
  KOSDAQ: 'bg-purple-500/20 text-purple-400',
  NASDAQ: 'bg-emerald-500/20 text-emerald-400',
  NYSE: 'bg-amber-500/20 text-amber-400',
  AMEX: 'bg-red-500/20 text-red-400',
};

export function StockSearch({ onSelect, placeholder = '종목명 검색 (예: 삼성전자, AAPL)' }: Props) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<StockSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<StockSearchResult | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!query || query.length < 1 || selected) {
      setResults([]);
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
    <div ref={containerRef} className="relative">
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

      {open && results.length > 0 && (
        <div className="absolute z-50 mt-1 w-full rounded-lg border border-border bg-card shadow-lg max-h-60 overflow-y-auto">
          {results.map((result, i) => (
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
              <Badge
                variant="secondary"
                className={`text-[10px] ${MARKET_COLORS[result.market] ?? ''}`}
              >
                {result.market}
              </Badge>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
