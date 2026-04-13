const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X)';

export interface IndexData {
  code: string;
  name: string;
  price: string;
  change: string;
  changePercent: string;
  direction: 'RISING' | 'FALLING' | 'FLAT';
  marketStatus: string;
}

// 국내 지수: 네이버 모바일 API
async function fetchNaverIndex(code: string): Promise<IndexData | null> {
  try {
    const res = await fetch(
      `https://m.stock.naver.com/api/index/${code}/basic`,
      { headers: { 'User-Agent': UA }, next: { revalidate: 300 } },
    );
    if (!res.ok) return null;
    const d = await res.json();
    return {
      code,
      name: d.stockName,
      price: d.closePrice,
      change: d.compareToPreviousClosePrice,
      changePercent: d.fluctuationsRatio,
      direction: d.compareToPreviousPrice?.name === 'RISING' ? 'RISING'
        : d.compareToPreviousPrice?.name === 'FALLING' ? 'FALLING' : 'FLAT',
      marketStatus: d.marketStatus,
    };
  } catch {
    return null;
  }
}

// 해외 지수: Yahoo Finance
async function fetchYahooIndex(
  symbol: string,
  name: string,
  code: string,
): Promise<IndexData | null> {
  try {
    const res = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=1d`,
      { headers: { 'User-Agent': UA }, next: { revalidate: 300 } },
    );
    if (!res.ok) return null;
    const d = await res.json();
    const meta = d.chart?.result?.[0]?.meta;
    if (!meta) return null;

    const price = meta.regularMarketPrice ?? 0;
    const prev = meta.chartPreviousClose ?? 0;
    const change = price - prev;
    const pct = prev > 0 ? (change / prev) * 100 : 0;

    return {
      code,
      name,
      price: price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
      change: (change >= 0 ? '+' : '') + change.toFixed(2),
      changePercent: pct.toFixed(2),
      direction: change > 0 ? 'RISING' : change < 0 ? 'FALLING' : 'FLAT',
      marketStatus: meta.marketState ?? 'CLOSE',
    };
  } catch {
    return null;
  }
}

export async function fetchAllIndices(): Promise<IndexData[]> {
  const results = await Promise.allSettled([
    fetchNaverIndex('KOSPI'),
    fetchNaverIndex('KOSDAQ'),
    fetchYahooIndex('^IXIC', 'NASDAQ', 'NASDAQ'),
    fetchYahooIndex('^GSPC', 'S&P 500', 'SPX'),
  ]);

  return results
    .map((r) => (r.status === 'fulfilled' ? r.value : null))
    .filter((r): r is IndexData => r !== null);
}
