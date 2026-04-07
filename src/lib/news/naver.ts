import type { NewsItem } from './types';

const USER_AGENT = 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X)';

/**
 * 네이버 금융 종목 뉴스 fetch (국내주식 종목코드 6자리).
 * 응답은 24시간 이내 뉴스만 반환. 실패하면 빈 배열 (전체 시스템은 멈추지 않음).
 */
export async function fetchKrxNews(ticker: string, limit = 5): Promise<NewsItem[]> {
  try {
    const res = await fetch(
      `https://m.stock.naver.com/api/news/stock/${ticker}?pageSize=${limit}&page=1`,
      {
        headers: { 'User-Agent': USER_AGENT },
        signal: AbortSignal.timeout(5000),
      },
    );
    if (!res.ok) return [];

    const data = await res.json();
    // 응답 구조: [{ items: [{title, body, datetime, mobileNewsUrl, officeName, ...}] }]
    const items = data?.[0]?.items ?? [];
    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;

    const result: NewsItem[] = [];
    for (const item of items) {
      // datetime: "202604072141" → ISO
      const dt = item.datetime;
      let publishedAt: string | null = null;
      if (dt && dt.length === 12) {
        const iso = `${dt.slice(0, 4)}-${dt.slice(4, 6)}-${dt.slice(6, 8)}T${dt.slice(8, 10)}:${dt.slice(10, 12)}:00+09:00`;
        publishedAt = iso;
        if (new Date(iso).getTime() < oneDayAgo) continue;
      }
      result.push({
        ticker,
        title: (item.titleFull ?? item.title ?? '').toString().trim(),
        url: item.mobileNewsUrl ?? '',
        source: item.officeName ?? '네이버',
        publishedAt,
        summary: item.body ? item.body.toString().slice(0, 200) : null,
      });
      if (result.length >= limit) break;
    }
    return result;
  } catch {
    return [];
  }
}
