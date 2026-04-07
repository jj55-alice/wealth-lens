import type { NewsItem } from './types';
import { fetchKrxNews } from './naver';
import { fetchYahooNews } from './yahoo';

export type { NewsItem };

export interface HoldingForNews {
  ticker: string;
  price_source: string; // 'krx' | 'yahoo_finance' | ...
}

/**
 * 보유 종목 목록을 받아서 source에 맞는 뉴스를 가져온다.
 * 어떤 종목의 fetch가 실패해도 전체는 계속 진행 (Promise.allSettled).
 * 결과는 ticker별로 그룹핑.
 */
export async function fetchNewsForHoldings(
  holdings: HoldingForNews[],
  limitPerTicker = 5,
): Promise<Map<string, NewsItem[]>> {
  const tasks: Promise<{ ticker: string; items: NewsItem[] }>[] = holdings.map(async (h) => {
    if (!h.ticker) return { ticker: h.ticker, items: [] };
    let items: NewsItem[] = [];
    if (h.price_source === 'krx') {
      items = await fetchKrxNews(h.ticker, limitPerTicker);
    } else if (h.price_source === 'yahoo_finance') {
      items = await fetchYahooNews(h.ticker, limitPerTicker);
    }
    return { ticker: h.ticker, items };
  });

  const results = await Promise.allSettled(tasks);
  const map = new Map<string, NewsItem[]>();
  for (const r of results) {
    if (r.status === 'fulfilled') {
      map.set(r.value.ticker, r.value.items);
    }
  }
  return map;
}
