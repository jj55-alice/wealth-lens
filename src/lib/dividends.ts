// 배당금 정보 조회
// 국내: 네이버 금융, 해외: Yahoo Finance

export interface DividendInfo {
  ticker: string;
  dividendPerShare: number; // 1주당 배당금
  dividendYield: number; // 배당수익률 (%)
  exDate: string | null; // 배당락일
  paymentDate: string | null; // 지급일
  frequency: 'quarterly' | 'semi_annual' | 'annual' | null;
}

const USER_AGENT = 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X)';

/**
 * 국내주식 배당 정보 (네이버 금융)
 */
export async function fetchKrxDividend(ticker: string): Promise<DividendInfo | null> {
  try {
    const res = await fetch(
      `https://m.stock.naver.com/api/stock/${ticker}/dividend`,
      { headers: { 'User-Agent': USER_AGENT } }
    );

    if (!res.ok) return null;

    const data = await res.json();
    const recent = data?.dividendInfos?.[0] ?? data?.[0];
    if (!recent) return null;

    return {
      ticker,
      dividendPerShare: Number(recent.dividend ?? recent.dividendPerShare ?? 0),
      dividendYield: Number(recent.dividendRate ?? recent.dividendYield ?? 0),
      exDate: recent.exDividendDate ?? recent.exDate ?? null,
      paymentDate: recent.paymentDate ?? null,
      frequency: 'annual', // 한국 주식은 대부분 연 1회
    };
  } catch {
    return null;
  }
}

/**
 * 해외주식 배당 정보 (Yahoo Finance)
 */
export async function fetchYahooDividend(ticker: string): Promise<DividendInfo | null> {
  try {
    const res = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=3mo&range=1y&events=div`,
      { headers: { 'User-Agent': USER_AGENT } }
    );

    if (!res.ok) return null;

    const data = await res.json();
    const result = data?.chart?.result?.[0];
    if (!result) return null;

    const meta = result.meta;
    const events = result.events?.dividends;

    // 배당 이벤트에서 가장 최근 것
    let latestDiv: { amount: number; date: number } | null = null;
    let totalDivInYear = 0;
    let divCount = 0;

    if (events) {
      const entries = Object.values(events) as Array<{ amount: number; date: number }>;
      for (const entry of entries) {
        totalDivInYear += entry.amount;
        divCount++;
        if (!latestDiv || entry.date > latestDiv.date) {
          latestDiv = entry;
        }
      }
    }

    if (!latestDiv) return null;

    const currentPrice = meta?.regularMarketPrice ?? 0;
    const annualDividend = totalDivInYear;
    const dividendYield = currentPrice > 0 ? (annualDividend / currentPrice) * 100 : 0;

    let frequency: DividendInfo['frequency'] = null;
    if (divCount >= 4) frequency = 'quarterly';
    else if (divCount >= 2) frequency = 'semi_annual';
    else frequency = 'annual';

    return {
      ticker,
      dividendPerShare: latestDiv.amount,
      dividendYield,
      exDate: new Date(latestDiv.date * 1000).toISOString().slice(0, 10),
      paymentDate: null,
      frequency,
    };
  } catch {
    return null;
  }
}

/**
 * 배당 정보를 소스에 따라 가져옵니다.
 */
export async function fetchDividendInfo(
  ticker: string,
  priceSource: string
): Promise<DividendInfo | null> {
  if (priceSource === 'krx') {
    return fetchKrxDividend(ticker);
  }
  if (priceSource === 'yahoo_finance') {
    return fetchYahooDividend(ticker);
  }
  return null;
}
