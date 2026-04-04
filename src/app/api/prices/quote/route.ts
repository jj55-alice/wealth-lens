import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import type { PriceSource } from '@/types/database';

// yahoo_finance 어댑터에서 USD 가격을 직접 가져오기 위해 개별 import
import { yahooAdapter } from '@/lib/prices/yahoo';
import { naverAdapter } from '@/lib/prices/naver';
import { upbitAdapter } from '@/lib/prices/upbit';
import { getUsdKrwRate } from '@/lib/prices/bok';

const adapters: Record<string, { fetchPrice: (ticker: string) => Promise<{ price: number; currency: string }> }> = {
  krx: naverAdapter,
  yahoo_finance: yahooAdapter,
  upbit: upbitAdapter,
};

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: '인증 필요' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const ticker = searchParams.get('ticker');
  const source = searchParams.get('source') as PriceSource | null;

  if (!ticker || !source) {
    return NextResponse.json({ error: 'ticker, source 필요' }, { status: 400 });
  }

  const adapter = adapters[source];
  if (!adapter) {
    return NextResponse.json({ price: null });
  }

  try {
    const result = await adapter.fetchPrice(ticker);

    // 해외주식 (USD): 달러 원가 + 환율 + 원화 변환가 모두 반환
    if (result.currency === 'USD') {
      const rate = await getUsdKrwRate();
      const krwPrice = Math.round(result.price * rate);
      return NextResponse.json({
        price: krwPrice,
        priceUsd: result.price,
        exchangeRate: rate,
        currency: 'KRW',
        originalCurrency: 'USD',
      });
    }

    return NextResponse.json({
      price: result.price,
      priceUsd: null,
      exchangeRate: null,
      currency: result.currency,
      originalCurrency: result.currency,
    });
  } catch {
    return NextResponse.json({ price: null });
  }
}
