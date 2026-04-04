import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export interface StockSearchResult {
  name: string;
  ticker: string;
  market: string; // KOSPI, KOSDAQ, NASDAQ, NYSE
  priceSource: 'krx' | 'yahoo_finance';
  currentPrice: number | null; // 현재가 (KRW)
}

export async function GET(request: Request) {
  // Auth check: prevent unauthenticated proxy abuse
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
    // 네이버 금융 자동완성 API (국내 + 해외 모두 검색)
    const res = await fetch(
      `https://m.stock.naver.com/front-api/v1/search/autoComplete?query=${encodeURIComponent(query)}&target=stock`,
      {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X)',
        },
      },
    );

    if (res.ok) {
      const data = await res.json();
      const items = data?.result?.items ?? data?.result ?? [];

      for (const item of items) {
        // Parse price from search result if available
        const rawPrice = item.closePrice ?? item.nowVal ?? item.compareToPreviousClosePrice ?? null;
        const currentPrice = rawPrice
          ? Number(String(rawPrice).replace(/,/g, ''))
          : null;

        // 국내주식
        if (item.reutersCode?.endsWith('.KS') || item.reutersCode?.endsWith('.KQ')) {
          const market = item.reutersCode.endsWith('.KS') ? 'KOSPI' : 'KOSDAQ';
          results.push({
            name: item.name ?? item.itemName ?? '',
            ticker: item.code ?? item.itemCode ?? '',
            market,
            priceSource: 'krx',
            currentPrice: !isNaN(currentPrice ?? NaN) ? currentPrice : null,
          });
        }
        // 해외주식
        else if (item.reutersCode || item.code) {
          const ticker = item.code ?? item.reutersCode?.split('.')[0] ?? '';
          const exchange = item.exchangeCode ?? item.stockExchangeName ?? '';
          let market = 'NYSE';
          if (exchange.includes('NASDAQ') || exchange.includes('NAS')) market = 'NASDAQ';
          else if (exchange.includes('AMEX')) market = 'AMEX';

          if (ticker) {
            results.push({
              name: item.name ?? item.itemName ?? '',
              ticker,
              market,
              priceSource: 'yahoo_finance',
              currentPrice: !isNaN(currentPrice ?? NaN) ? currentPrice : null,
            });
          }
        }
      }
    }
  } catch {
    // Naver search failed, return empty
  }

  return NextResponse.json(results.slice(0, 15));
}
