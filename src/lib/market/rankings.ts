import { getFmpApiKey } from '@/lib/env';

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
  bypassCache: boolean,
): Promise<{ stocks: RankingStock[]; totalCount: number }> {
  const endpoint = NAVER_SORT[sort];
  const url = `https://m.stock.naver.com/api/stocks/${endpoint}/KOSPI?page=${page}&pageSize=${pageSize}`;

  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': UA },
      ...(bypassCache ? { cache: 'no-store' as const } : { next: { revalidate: 300 } }),
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

// ─── 해외 (Financial Modeling Prep 우선, Yahoo fallback) ───

const FMP_BASE = 'https://financialmodelingprep.com/stable';

// 시총 Top 랭킹용 메가캡 유니버스 (상위 ~50개 미국 대형주).
// 실제 정렬은 FMP 실시간 marketCap 로 수행 — 순서는 단순 후보군.
const MEGA_CAP_UNIVERSE = [
  'NVDA','MSFT','AAPL','GOOGL','AMZN','META','AVGO','BRK-B','TSLA','LLY',
  'WMT','JPM','V','ORCL','MA','XOM','COST','NFLX','JNJ','HD',
  'PG','BAC','ABBV','SAP','CVX','KO','CRM','TMUS','AMD','CSCO',
  'WFC','ACN','MRK','LIN','PEP','TMO','IBM','MCD','NOW','GE',
  'ADBE','ABT','DIS','PM','QCOM','TXN','AXP','BX','GS','ISRG',
];

interface FmpQuote {
  symbol: string;
  name?: string;
  price?: number;
  changePercentage?: number | string;
  volume?: number;
  marketCap?: number;
}

interface FmpMoverItem {
  symbol: string;
  name?: string;
  price?: number;
  change?: number;
  changesPercentage?: number | string;
}

function parsePct(v: number | string | undefined): number {
  if (v == null) return 0;
  if (typeof v === 'number') return v;
  const n = parseFloat(String(v).replace(/[^\d.\-]/g, ''));
  return Number.isFinite(n) ? n : 0;
}

async function fmpQuote(
  symbol: string,
  apiKey: string,
  bypassCache: boolean,
): Promise<FmpQuote | null> {
  try {
    const res = await fetch(
      `${FMP_BASE}/quote?symbol=${encodeURIComponent(symbol)}&apikey=${apiKey}`,
      bypassCache
        ? { cache: 'no-store' }
        // 5분 캐시 — 국내(Naver)와 동일. 1시간은 장중/overnight 변동을 놓침.
        : { next: { revalidate: 300 } },
    );
    if (!res.ok) return null;
    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) return null;
    return data[0] as FmpQuote;
  } catch {
    return null;
  }
}

async function fetchForeignFmpMarketCap(
  page: number,
  pageSize: number,
  apiKey: string,
  bypassCache: boolean,
): Promise<{ stocks: RankingStock[]; totalCount: number } | null> {
  const quotes = await Promise.all(
    MEGA_CAP_UNIVERSE.map((s) => fmpQuote(s, apiKey, bypassCache)),
  );
  const valid = quotes.filter((q): q is FmpQuote => q != null && (q.marketCap ?? 0) > 0);
  if (valid.length === 0) return null;
  valid.sort((a, b) => (b.marketCap ?? 0) - (a.marketCap ?? 0));

  const totalCount = valid.length;
  const offset = (page - 1) * pageSize;
  const sliced = valid.slice(offset, offset + pageSize);

  const stocks: RankingStock[] = sliced.map((q, i) => {
    const pct = parsePct(q.changePercentage);
    const price = Number(q.price ?? 0);
    const volume = Number(q.volume ?? 0);
    const marketCap = Number(q.marketCap ?? 0);
    return {
      rank: offset + i + 1,
      code: q.symbol,
      name: q.name ?? q.symbol,
      price: price.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }),
      changePercent: pct.toFixed(2),
      direction: pct > 0 ? 'RISING' : pct < 0 ? 'FALLING' : 'FLAT',
      marketCap: marketCap > 0 ? formatLargeNumber(marketCap) : '-',
      tradingValue: volume > 0 ? volume.toLocaleString() : '-',
    };
  });
  return { stocks, totalCount };
}

async function fetchForeignFmpMover(
  sort: 'tradingValue' | 'gainers' | 'losers',
  page: number,
  pageSize: number,
  apiKey: string,
  bypassCache: boolean,
): Promise<{ stocks: RankingStock[]; totalCount: number } | null> {
  const endpoint =
    sort === 'tradingValue' ? 'most-actives'
    : sort === 'gainers' ? 'biggest-gainers'
    : 'biggest-losers';
  try {
    const res = await fetch(
      `${FMP_BASE}/${endpoint}?apikey=${apiKey}`,
      bypassCache ? { cache: 'no-store' } : { next: { revalidate: 300 } },
    );
    if (!res.ok) return null;
    const data = await res.json();
    if (!Array.isArray(data)) return null;

    const items = data as FmpMoverItem[];
    const totalCount = items.length;
    const offset = (page - 1) * pageSize;
    const sliced = items.slice(offset, offset + pageSize);

    const stocks: RankingStock[] = sliced.map((q, i) => {
      const pct = parsePct(q.changesPercentage);
      const price = Number(q.price ?? 0);
      return {
        rank: offset + i + 1,
        code: q.symbol,
        name: q.name ?? q.symbol,
        price: price.toLocaleString('en-US', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        }),
        changePercent: pct.toFixed(2),
        direction: pct > 0 ? 'RISING' : pct < 0 ? 'FALLING' : 'FLAT',
        marketCap: '-',
        tradingValue: '-',
      };
    });
    return { stocks, totalCount };
  } catch {
    return null;
  }
}

async function fetchForeignFmp(
  sort: RankingSort,
  page: number,
  pageSize: number,
  apiKey: string,
  bypassCache: boolean,
): Promise<{ stocks: RankingStock[]; totalCount: number } | null> {
  if (sort === 'marketCap') {
    return fetchForeignFmpMarketCap(page, pageSize, apiKey, bypassCache);
  }
  return fetchForeignFmpMover(sort, page, pageSize, apiKey, bypassCache);
}

// ─── 해외 Yahoo fallback ───

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
  bypassCache: boolean = false,
): Promise<{ stocks: RankingStock[]; totalCount: number; hasMore: boolean; fetchedAt: string }> {
  let result: { stocks: RankingStock[]; totalCount: number };
  if (market === 'domestic') {
    result = await fetchDomestic(sort, page, pageSize, bypassCache);
  } else {
    const key = getFmpApiKey();
    const fmp = key ? await fetchForeignFmp(sort, page, pageSize, key, bypassCache) : null;
    result = fmp ?? (await fetchForeign(sort, page, pageSize));
  }

  const endRank = (page - 1) * pageSize + result.stocks.length;
  return {
    ...result,
    hasMore: endRank < result.totalCount,
    fetchedAt: new Date().toISOString(),
  };
}
