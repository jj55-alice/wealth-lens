'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { StockPortfolio } from '@/components/stock-portfolio';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import type { AssetWithPrice } from '@/types/database';
import type { DividendInfo } from '@/lib/dividends';

export default function StocksPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [stocks, setStocks] = useState<AssetWithPrice[]>([]);
  const [dividends, setDividends] = useState<DividendInfo[]>([]);
  const [exchangeRate, setExchangeRate] = useState<number | null>(null);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        router.push('/login');
        return;
      }

      // Get household
      const { data: membership } = await supabase
        .from('household_members')
        .select('household_id')
        .eq('user_id', user.id)
        .single();

      if (!membership) {
        router.push('/dashboard');
        return;
      }

      // Fetch stock assets
      const { data: rawStocks } = await supabase
        .from('assets')
        .select('*')
        .eq('household_id', membership.household_id)
        .eq('category', 'stock')
        .order('created_at');

      const stockAssets = rawStocks ?? [];

      // Get cached prices (+ previous_close for daily change tracking)
      const tickers = stockAssets.filter((a) => a.ticker).map((a) => a.ticker as string);
      const priceMap = new Map<
        string,
        { price: number; previous_close: number | null; fetched_at: string }
      >();

      if (tickers.length > 0) {
        const { data: prices } = await supabase
          .from('price_cache')
          .select('ticker, price, previous_close, fetched_at')
          .in('ticker', tickers);
        if (prices) {
          for (const p of prices) {
            priceMap.set(p.ticker, {
              price: p.price,
              previous_close: p.previous_close ?? null,
              fetched_at: p.fetched_at,
            });
          }
        }
      }

      setStocks(
        stockAssets.map((asset) => {
          const cached = asset.ticker ? priceMap.get(asset.ticker) : null;
          const currentPrice = cached?.price ?? null;
          const previousClose = cached?.previous_close ?? null;
          let currentValue = 0;
          if (currentPrice && asset.quantity) {
            currentValue = currentPrice * Number(asset.quantity);
          }
          const isStale = cached
            ? Date.now() - new Date(cached.fetched_at).getTime() > 24 * 60 * 60 * 1000
            : false;

          const dailyChangeRate =
            currentPrice != null && previousClose != null && previousClose > 0
              ? ((currentPrice - previousClose) / previousClose) * 100
              : null;

          return {
            ...asset,
            quantity: asset.quantity ? Number(asset.quantity) : null,
            manual_value: asset.manual_value ? Number(asset.manual_value) : null,
            current_price: currentPrice,
            current_value: currentValue,
            price_updated_at: cached?.fetched_at ?? null,
            is_stale: isStale,
            previous_close: previousClose,
            daily_change_rate: dailyChangeRate,
          } as AssetWithPrice;
        })
      );

      // Fetch dividends + exchange rate
      try {
        const [divRes, rateRes] = await Promise.all([
          fetch('/api/dividends'),
          fetch('/api/exchange-rate'),
        ]);
        const divData = await divRes.json();
        if (Array.isArray(divData)) setDividends(divData);
        const rateData = await rateRes.json();
        if (rateData.rate) setExchangeRate(rateData.rate);
      } catch {
        // ignore
      }

      setLoading(false);
    }

    load();
  }, [router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <header className="border-b border-border px-6 py-4">
          <div className="mx-auto max-w-5xl">
            <Skeleton className="h-6 w-32" />
          </div>
        </header>
        <main className="mx-auto max-w-5xl px-6 py-8 space-y-6">
          <Skeleton className="h-24 w-full rounded-xl" />
          <Skeleton className="h-96 w-full rounded-xl" />
          <Skeleton className="h-48 w-full rounded-xl" />
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border px-6 py-4">
        <div className="mx-auto max-w-5xl flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/dashboard">
              <Button variant="ghost" size="sm">← 대시보드</Button>
            </Link>
            <h1 className="text-lg font-semibold">주식 포트폴리오</h1>
          </div>
          <Link
            href="/assets/new"
            className="rounded-lg bg-primary px-4 py-2 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            + 주식 추가
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-8">
        {stocks.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-4xl mb-4">📈</p>
            <h2 className="text-lg font-semibold">주식이 없습니다</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              주식을 등록하면 수익률과 배당 정보를 확인할 수 있습니다
            </p>
            <Link
              href="/assets/new"
              className="mt-4 inline-block rounded-lg bg-primary px-6 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              주식 등록하기
            </Link>
          </div>
        ) : (
          <StockPortfolio stocks={stocks} dividends={dividends} exchangeRate={exchangeRate} />
        )}
      </main>
    </div>
  );
}
