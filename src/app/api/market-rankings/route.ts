import { NextResponse } from 'next/server';
import { fetchRankings, type RankingMarket, type RankingSort } from '@/lib/market/rankings';

export const dynamic = 'force-dynamic';

const VALID_MARKETS: RankingMarket[] = ['domestic', 'foreign'];
const VALID_SORTS: RankingSort[] = ['marketCap', 'tradingValue', 'gainers', 'losers'];

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const rawMarket = searchParams.get('market') ?? 'domestic';
  const rawSort = searchParams.get('sort') ?? 'marketCap';
  const market: RankingMarket = VALID_MARKETS.includes(rawMarket as RankingMarket)
    ? (rawMarket as RankingMarket) : 'domestic';
  const sort: RankingSort = VALID_SORTS.includes(rawSort as RankingSort)
    ? (rawSort as RankingSort) : 'marketCap';
  const page = Math.max(1, Number(searchParams.get('page') ?? '1'));

  const data = await fetchRankings(market, sort, page, 20);
  return NextResponse.json(data);
}
