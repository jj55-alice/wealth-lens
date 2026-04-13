const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X)';

export interface RankingStock {
  rank: number;
  code: string;
  name: string;
  price: string;
  changePercent: string;
  direction: 'RISING' | 'FALLING' | 'FLAT';
  marketCap: string;
  tradingValue: string;
}

export type RankingSort = 'marketCap' | 'tradingValue' | 'gainers' | 'losers';
export type RankingMarket = 'domestic' | 'foreign';

// ─── 국내 (네이버) ───

interface NaverStockItem {
  itemCode: string;
  stockName: string;
  closePrice: string;
  fluctuationsRatio: string;
  compareToPreviousPrice?: { name: string };
  marketValueHangeul?: string;
  accumulatedTradingValueKrwHangeul?: string;
}

const NAVER_SORT: Record<RankingSort, string> = {
  marketCap: 'marketValue',
  tradingValue: 'tradingValue',
  gainers: 'up',
  losers: 'down',
};

async function fetchDomestic(
  sort: RankingSort,
  page: number,
  pageSize: number,
): Promise<{ stocks: RankingStock[]; totalCount: number }> {
  const endpoint = NAVER_SORT[sort];
  const url = `https://m.stock.naver.com/api/stocks/${endpoint}/KOSPI?page=${page}&pageSize=${pageSize}`;

  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': UA },
      next: { revalidate: 300 },
    });
    if (!res.ok) return { stocks: [], totalCount: 0 };
    const d = await res.json();
    const items: NaverStockItem[] = d.stocks ?? [];
    const startRank = (page - 1) * pageSize + 1;

    return {
      stocks: items.map((s, i) => {
        const dir = s.compareToPreviousPrice?.name;
        return {
          rank: startRank + i,
          code: s.itemCode,
          name: s.stockName,
          price: s.closePrice,
          changePercent: s.fluctuationsRatio ?? '0',
          direction: dir === 'RISING' ? 'RISING' : dir === 'FALLING' ? 'FALLING' : 'FLAT',
          marketCap: s.marketValueHangeul ?? '-',
          tradingValue: s.accumulatedTradingValueKrwHangeul ?? '-',
        };
      }),
      totalCount: d.totalCount ?? 0,
    };
  } catch {
    return { stocks: [], totalCount: 0 };
  }
}

// ─── 해외 (Yahoo Finance) ───

const YAHOO_SCREENERS: Record<RankingSort, string> = {
  marketCap: 'most_actives',         // 활발한 종목 (시총순 가까운 대형주 위주)
  tradingValue: 'most_actives',
  gainers: 'day_gainers',
  losers: 'day_losers',
};

interface YahooQuote {
  symbol: string;
  shortName?: string;
  longName?: string;
  regularMarketPrice?: number;
  regularMarketChangePercent?: number;
  marketCap?: number;
  regularMarketVolume?: number;
}

function formatLargeNumber(n: number): string {
  if (n >= 1e12) return `$${(n / 1e12).toFixed(1)}T`;
  if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(0)}M`;
  return `$${n.toLocaleString()}`;
}

async function fetchForeign(
  sort: RankingSort,
  page: number,
  pageSize: number,
): Promise<{ stocks: RankingStock[]; totalCount: number }> {
  const scrId = YAHOO_SCREENERS[sort];
  const offset = (page - 1) * pageSize;
  const url = `https://query1.finance.yahoo.com/v1/finance/screener/predefined/saved?formatted=false&lang=en-US&region=US&scrIds=${scrId}&count=${pageSize}&offset=${offset}`;

  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': UA },
      cache: 'no-store',
    });
    if (!res.ok) return { stocks: [], totalCount: 0 };
    const d = await res.json();
    const result = d.finance?.result?.[0];
    const quotes: YahooQuote[] = result?.quotes ?? [];
    const total = result?.total ?? 0;

    return {
      stocks: quotes.map((q, i) => {
        const pct = q.regularMarketChangePercent ?? 0;
        return {
          rank: offset + i + 1,
          code: q.symbol ?? '',
          name: q.shortName ?? q.longName ?? q.symbol ?? '',
          price: (q.regularMarketPrice ?? 0).toLocaleString('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          }),
          changePercent: pct.toFixed(2),
          direction: pct > 0 ? 'RISING' : pct < 0 ? 'FALLING' : 'FLAT',
          marketCap: q.marketCap ? formatLargeNumber(q.marketCap) : '-',
          tradingValue: q.regularMarketVolume
            ? q.regularMarketVolume.toLocaleString()
            : '-',
        };
      }),
      totalCount: total,
    };
  } catch {
    return { stocks: [], totalCount: 0 };
  }
}

// ─── Public API ───

export async function fetchRankings(
  market: RankingMarket,
  sort: RankingSort,
  page: number = 1,
  pageSize: number = 20,
): Promise<{ stocks: RankingStock[]; totalCount: number; hasMore: boolean }> {
  const result = market === 'domestic'
    ? await fetchDomestic(sort, page, pageSize)
    : await fetchForeign(sort, page, pageSize);

  const endRank = (page - 1) * pageSize + result.stocks.length;
  return {
    ...result,
    hasMore: endRank < result.totalCount,
  };
}
