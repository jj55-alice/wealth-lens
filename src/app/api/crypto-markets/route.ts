import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export interface CryptoMarket {
  ticker: string;
  koreanName: string;
  englishName: string;
  currentPrice: number | null;
}

// Cache for 5 minutes
let cachedMarkets: CryptoMarket[] | null = null;
let cachedAt = 0;
const CACHE_TTL = 5 * 60 * 1000;

export async function GET() {
  // Auth check
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: '인증 필요' }, { status: 401 });
  }

  // Return cached if fresh
  if (cachedMarkets && Date.now() - cachedAt < CACHE_TTL) {
    return NextResponse.json(cachedMarkets);
  }

  try {
    // Fetch all KRW markets from Upbit
    const marketRes = await fetch('https://api.upbit.com/v1/market/all?is_details=false');
    if (!marketRes.ok) throw new Error('Upbit market list failed');

    const allMarkets = await marketRes.json();
    const krwMarkets = allMarkets.filter(
      (m: { market: string }) => m.market.startsWith('KRW-')
    );

    // Fetch current prices for top markets
    const marketCodes = krwMarkets.map((m: { market: string }) => m.market).join(',');
    const priceRes = await fetch(`https://api.upbit.com/v1/ticker?markets=${marketCodes}`);
    const priceData = priceRes.ok ? await priceRes.json() : [];
    const priceMap = new Map<string, number>();
    for (const p of priceData) {
      priceMap.set(p.market, p.trade_price);
    }

    const markets: CryptoMarket[] = krwMarkets.map(
      (m: { market: string; korean_name: string; english_name: string }) => ({
        ticker: m.market.replace('KRW-', ''),
        koreanName: m.korean_name,
        englishName: m.english_name,
        currentPrice: priceMap.get(m.market) ?? null,
      })
    );

    cachedMarkets = markets;
    cachedAt = Date.now();

    return NextResponse.json(markets);
  } catch {
    return NextResponse.json([], { status: 500 });
  }
}
