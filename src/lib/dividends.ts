// 배당 정보 조회
// - 국내(KRX): FMP `.KS` 심볼 → 폴백으로 Naver (주당/수익률만)
// - 해외: FMP (ex_date + payment_date) → 폴백으로 Yahoo
// dividend_events 테이블에 이벤트별 rows 를 upsert 해, 월별 projection 계산에 사용.

import { getFmpApiKey } from '@/lib/env';

export interface DividendInfo {
  ticker: string;
  dividendPerShare: number;
  dividendYield: number;
  exDate: string | null;
  paymentDate: string | null;
  frequency: 'quarterly' | 'semi_annual' | 'annual' | 'monthly' | null;
  currency: 'KRW' | 'USD';
  source: 'fmp' | 'naver' | 'yahoo';
}

export interface DividendEvent {
  ticker: string;
  exDate: string;           // YYYY-MM-DD
  paymentDate: string | null;
  recordDate: string | null;
  amountPerShare: number;
  currency: 'KRW' | 'USD';
  source: 'fmp' | 'yahoo' | 'naver';
}

const USER_AGENT = 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X)';
const FMP_BASE = 'https://financialmodelingprep.com/stable';

// ─── FMP ───────────────────────────────────────────────────────────────────

interface FmpDividendItem {
  symbol?: string;
  date?: string;             // ex-dividend date
  recordDate?: string | null;
  paymentDate?: string | null;
  declarationDate?: string | null;
  adjDividend?: number | null;
  dividend?: number | null;
  yield?: number | null;
  frequency?: string | null; // "Quarterly" | "Monthly" | "Semi-Annual" | "Annual"
}

function normalizeFreq(
  raw: string | null | undefined,
  count: number,
): DividendInfo['frequency'] {
  if (raw) {
    const k = raw.toLowerCase();
    if (k.includes('month')) return 'monthly';
    if (k.includes('quarter')) return 'quarterly';
    if (k.includes('semi')) return 'semi_annual';
    if (k.includes('ann')) return 'annual';
  }
  if (count >= 10) return 'monthly';
  if (count >= 4) return 'quarterly';
  if (count >= 2) return 'semi_annual';
  return 'annual';
}

function ymd(s: string | null | undefined): string | null {
  if (!s) return null;
  const d = s.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : null;
}

/**
 * FMP 배당 이력 (stable endpoint). Returns up to last ~5y of dividends.
 * KRX 종목은 symbol=`{ticker}.KS` 또는 `{ticker}.KQ` (코스닥) 형태.
 */
async function fetchFmpDividends(
  symbol: string,
  apiKey: string,
): Promise<FmpDividendItem[] | null> {
  try {
    const url = `${FMP_BASE}/dividends?symbol=${encodeURIComponent(symbol)}&apikey=${apiKey}`;
    const res = await fetch(url, {
      next: { revalidate: 6 * 3600 }, // 6h
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (!Array.isArray(data)) return null;
    return data as FmpDividendItem[];
  } catch {
    return null;
  }
}

function fmpToEvents(
  ticker: string,
  items: FmpDividendItem[],
  currency: 'KRW' | 'USD',
): DividendEvent[] {
  const out: DividendEvent[] = [];
  for (const it of items) {
    const ex = ymd(it.date);
    const amt = Number(it.adjDividend ?? it.dividend ?? 0);
    if (!ex || !Number.isFinite(amt) || amt <= 0) continue;
    out.push({
      ticker,
      exDate: ex,
      paymentDate: ymd(it.paymentDate),
      recordDate: ymd(it.recordDate),
      amountPerShare: amt,
      currency,
      source: 'fmp',
    });
  }
  return out;
}

// KRX 심볼 후보 (KOSPI → KOSDAQ). FMP는 숫자 6자리만 들어오면 모두 지원.
function krxSymbolCandidates(ticker: string): string[] {
  const t = ticker.trim();
  return [`${t}.KS`, `${t}.KQ`];
}

// ─── Naver (KRX 폴백: 주당/수익률만) ──────────────────────────────────────

async function fetchNaverSummary(
  ticker: string,
): Promise<{ dividendPerShare: number; dividendYield: number } | null> {
  try {
    const res = await fetch(
      `https://m.stock.naver.com/api/stock/${ticker}/integration`,
      { headers: { 'User-Agent': USER_AGENT }, signal: AbortSignal.timeout(5000) },
    );
    if (!res.ok) return null;
    const data = await res.json();
    const totalInfos: Array<{ code: string; value: string }> = data?.totalInfos ?? [];
    const find = (c: string) =>
      totalInfos.find((t) => t.code === c)?.value ?? null;
    const num = (s: string | null) => {
      if (!s) return 0;
      const n = Number(s.replace(/[^0-9.]/g, ''));
      return Number.isFinite(n) ? n : 0;
    };
    const dps = num(find('dividend'));
    const yld = num(find('dividendYieldRatio'));
    if (dps === 0 && yld === 0) return null;
    return { dividendPerShare: dps, dividendYield: yld };
  } catch {
    return null;
  }
}

// ─── Yahoo (해외 폴백) ────────────────────────────────────────────────────

async function fetchYahooEvents(ticker: string): Promise<DividendEvent[] | null> {
  try {
    const res = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=3mo&range=5y&events=div`,
      { headers: { 'User-Agent': USER_AGENT }, signal: AbortSignal.timeout(5000) },
    );
    if (!res.ok) return null;
    const data = await res.json();
    const events = data?.chart?.result?.[0]?.events?.dividends;
    if (!events) return null;

    const out: DividendEvent[] = [];
    for (const e of Object.values(events) as Array<{ amount: number; date: number }>) {
      const iso = new Date(e.date * 1000).toISOString().slice(0, 10);
      if (!Number.isFinite(e.amount) || e.amount <= 0) continue;
      out.push({
        ticker,
        exDate: iso,
        paymentDate: null,
        recordDate: null,
        amountPerShare: e.amount,
        currency: 'USD',
        source: 'yahoo',
      });
    }
    return out;
  } catch {
    return null;
  }
}

// ─── Public: 이벤트 조회 ─────────────────────────────────────────────────

/**
 * 종목의 배당 이벤트 목록 (과거 + 예정, 최대 ~5년).
 * priceSource = 'krx' → FMP .KS/.KQ → Naver summary 폴백 (이벤트 1건으로 근사)
 * priceSource = 'yahoo_finance' → FMP → Yahoo 폴백
 */
export async function fetchDividendEvents(
  ticker: string,
  priceSource: string,
): Promise<DividendEvent[]> {
  const apiKey = getFmpApiKey();

  if (priceSource === 'krx') {
    if (apiKey) {
      for (const sym of krxSymbolCandidates(ticker)) {
        const items = await fetchFmpDividends(sym, apiKey);
        if (items && items.length > 0) {
          return fmpToEvents(ticker, items, 'KRW');
        }
      }
    }
    // Naver 폴백 — 배당락일/지급일 미제공이므로 올해 말로 fallback
    const summary = await fetchNaverSummary(ticker);
    if (summary && summary.dividendPerShare > 0) {
      const year = new Date().getFullYear();
      return [{
        ticker,
        exDate: `${year}-12-28`, // 한국 결산배당 일반적 기준일 근사
        paymentDate: null,
        recordDate: null,
        amountPerShare: summary.dividendPerShare,
        currency: 'KRW',
        source: 'naver',
      }];
    }
    return [];
  }

  if (priceSource === 'yahoo_finance') {
    if (apiKey) {
      const items = await fetchFmpDividends(ticker, apiKey);
      if (items && items.length > 0) {
        return fmpToEvents(ticker, items, 'USD');
      }
    }
    const yahoo = await fetchYahooEvents(ticker);
    return yahoo ?? [];
  }

  return [];
}

// ─── Public: 요약 정보 (UI 레거시 호환) ───────────────────────────────────

/**
 * 요약(최근 이벤트 + TTM 기반 yield 추정). UI는 이벤트 배열과 이 요약을 함께 쓸 수 있음.
 */
export async function fetchDividendInfo(
  ticker: string,
  priceSource: string,
  currentPrice: number | null = null,
): Promise<DividendInfo | null> {
  const events = await fetchDividendEvents(ticker, priceSource);
  if (events.length === 0) return null;

  // 최신 이벤트
  const sorted = [...events].sort((a, b) => b.exDate.localeCompare(a.exDate));
  const latest = sorted[0];

  // TTM: 오늘 기준 지난 12개월 합계
  const now = new Date();
  const oneYearAgo = new Date(now);
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
  const ttm = events
    .filter((e) => new Date(e.exDate) >= oneYearAgo && new Date(e.exDate) <= now)
    .reduce((sum, e) => sum + e.amountPerShare, 0);

  // TTM 이벤트 수로 주기 추정
  const ttmCount = events.filter(
    (e) => new Date(e.exDate) >= oneYearAgo && new Date(e.exDate) <= now,
  ).length;
  const frequency = normalizeFreq(null, ttmCount || events.length);

  // yield: TTM / currentPrice * 100 (없으면 0)
  const yld =
    currentPrice && currentPrice > 0 && ttm > 0
      ? (ttm / currentPrice) * 100
      : 0;

  return {
    ticker,
    dividendPerShare: latest.amountPerShare,
    dividendYield: yld,
    exDate: latest.exDate,
    paymentDate: latest.paymentDate,
    frequency,
    currency: latest.currency,
    source: latest.source,
  };
}
