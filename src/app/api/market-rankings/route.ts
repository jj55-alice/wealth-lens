import { NextResponse } from 'next/server';
import { fetchRankings, type RankingMarket, type RankingSort } from '@/lib/market/rankings';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const market = (searchParams.get('market') ?? 'domestic') as RankingMarket;
  const sort = (searchParams.get('sort') ?? 'marketCap') as RankingSort;
  const page = Math.max(1, Number(searchParams.get('page') ?? '1'));

  const data = await fetchRankings(market, sort, page, 20);
  return NextResponse.json(data);
}
