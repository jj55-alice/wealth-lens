'use client';

import { useState, useEffect, useRef } from 'react';
import { Input } from '@/components/ui/input';
import type { CryptoMarket } from '@/app/api/crypto-markets/route';

interface Props {
  onSelect: (result: CryptoMarket) => void;
}

function formatPrice(price: number | null): string {
  if (price === null) return '';
  return price.toLocaleString('ko-KR') + '원';
}

export function CryptoSearch({ onSelect }: Props) {
  const [markets, setMarkets] = useState<CryptoMarket[]>([]);
  const [query, setQuery] = useState('');
  const [filtered, setFiltered] = useState<CryptoMarket[]>([]);
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<CryptoMarket | null>(null);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Load market list once
  useEffect(() => {
    async function loadMarkets() {
      setLoading(true);
      try {
        const res = await fetch('/api/crypto-markets');
        const data = await res.json();
        if (Array.isArray(data)) setMarkets(data);
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    }
    loadMarkets();
  }, []);

  // Filter by query
  useEffect(() => {
    if (!query || selected) {
      setFiltered([]);
      setOpen(false);
      return;
    }
    const q = query.toLowerCase();
    const matches = markets.filter(
      (m) =>
        m.ticker.toLowerCase().includes(q) ||
        m.koreanName.toLowerCase().includes(q) ||
        m.englishName.toLowerCase().includes(q)
    );
    setFiltered(matches.slice(0, 20));
    setOpen(matches.length > 0);
  }, [query, markets, selected]);

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

  function handleSelect(market: CryptoMarket) {
    setSelected(market);
    setQuery(`${market.koreanName} (${market.ticker})`);
    setOpen(false);
    onSelect(market);
  }

  function handleClear() {
    setSelected(null);
    setQuery('');
    setFiltered([]);
  }

  return (
    <div ref={containerRef} className="relative space-y-2">
      <div className="relative">
        <Input
          aria-label="코인 검색"
          placeholder="코인명 검색 (예: 비트코인, ETH)"
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

      {/* 선택된 코인 현재가 */}
      {selected?.currentPrice && (
        <div className="rounded-lg bg-muted/50 px-3 py-2 text-sm">
          <span className="text-muted-foreground">현재가: </span>
          <span className="font-semibold">{formatPrice(selected.currentPrice)}</span>
        </div>
      )}

      {open && filtered.length > 0 && (
        <div className="absolute z-50 mt-1 w-full rounded-lg border border-border bg-card shadow-lg max-h-60 overflow-y-auto">
          {filtered.map((market) => (
            <button
              key={market.ticker}
              type="button"
              onClick={() => handleSelect(market)}
              className="w-full px-3 py-2 text-left hover:bg-muted/50 flex items-center justify-between transition-colors"
            >
              <div>
                <p className="text-sm font-medium">{market.koreanName}</p>
                <p className="text-xs text-muted-foreground">{market.ticker}</p>
              </div>
              {market.currentPrice && (
                <span className="text-xs text-muted-foreground">
                  {formatPrice(market.currentPrice)}
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
