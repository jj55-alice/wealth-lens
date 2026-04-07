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
 * 국내주식 배당 정보 (네이버 금융 integration endpoint)
 *
 * 네이버는 배당락일/지급일을 노출하는 무료 endpoint가 없어서, 주당 배당금과
 * 배당수익률만 가져옵니다. 정확한 배당락일/지급일이 필요하면 DART API 통합
 * 필요 (별도 작업 — 사용자가 OPEN DART API key 등록 시).
 */
export async function fetchKrxDividend(ticker: string): Promise<DividendInfo | null> {
  try {
    const res = await fetch(
      `https://m.stock.naver.com/api/stock/${ticker}/integration`,
      {
        headers: { 'User-Agent': USER_AGENT },
        signal: AbortSignal.timeout(5000),
      },
    );
    if (!res.ok) return null;

    const data = await res.json();
    const totalInfos: Array<{ code: string; value: string }> = data?.totalInfos ?? [];

    const findValue = (code: string): string | null => {
      const item = totalInfos.find((t) => t.code === code);
      return item?.value ?? null;
    };

    // "1,668원" → 1668
    const parseKrwAmount = (s: string | null): number => {
      if (!s) return 0;
      const cleaned = s.replace(/[^0-9.]/g, '');
      return cleaned ? Number(cleaned) : 0;
    };
    // "0.85%" → 0.85
    const parsePercent = (s: string | null): number => {
      if (!s) return 0;
      const cleaned = s.replace(/[^0-9.]/g, '');
      return cleaned ? Number(cleaned) : 0;
    };

    const dividendPerShare = parseKrwAmount(findValue('dividend'));
    const dividendYield = parsePercent(findValue('dividendYieldRatio'));

    if (dividendPerShare === 0 && dividendYield === 0) {
      return null;
    }

    return {
      ticker,
      dividendPerShare,
      dividendYield,
      exDate: null, // 네이버 무료 endpoint 미제공
      paymentDate: null, // 네이버 무료 endpoint 미제공
      frequency: 'annual', // 한국 주식 대부분 연 1회 결산 배당
    };
  } catch (err) {
    console.warn(`국내주식 배당 조회 실패: ${ticker}`, err);
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
