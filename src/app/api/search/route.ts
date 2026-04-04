import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export interface StockSearchResult {
  name: string;
  ticker: string;
  market: string; // KOSPI, KOSDAQ, NASDAQ, NYSE
  priceSource: 'krx' | 'yahoo_finance';
  currentPrice: number | null;
}

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: '인증 필요' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q')?.trim();

  if (!query || query.length < 1) {
    return NextResponse.json([]);
  }

  const results: StockSearchResult[] = [];

  try {
    // 네이버 증권 자동완성 API (ac.stock.naver.com)
    const res = await fetch(
      `https://ac.stock.naver.com/ac?q=${encodeURIComponent(query)}&target=stock`,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X)',
        },
      },
    );

    if (res.ok) {
      const data = await res.json();
      const items = data?.items ?? [];

      for (const item of items) {
        const code = item.code ?? '';
        const name = item.name ?? '';
        const typeCode = item.typeCode ?? ''; // KOSPI, KOSDAQ, NASDAQ, NYSE, AMEX
        const nationCode = item.nationCode ?? 'KOR';

        if (!code || !name) continue;

        // 국내주식
        if (nationCode === 'KOR' && (typeCode === 'KOSPI' || typeCode === 'KOSDAQ')) {
          results.push({
            name,
            ticker: code,
            market: typeCode,
            priceSource: 'krx',
            currentPrice: null,
          });
        }
        // 해외주식
        else if (nationCode !== 'KOR') {
          let market = typeCode || 'NYSE';
          if (market === 'NAS') market = 'NASDAQ';
          results.push({
            name,
            ticker: code,
            market,
            priceSource: 'yahoo_finance',
            currentPrice: null,
          });
        }
      }
    }
  } catch {
    // Search failed, return empty
  }

  return NextResponse.json(results.slice(0, 15));
}
