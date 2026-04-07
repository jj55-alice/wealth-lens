import type { NewsItem } from './types';

const USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)';

/**
 * Yahoo Finance RSS로 해외주식 뉴스 fetch.
 * RSS는 보통 안정적이지만, 24시간 필터를 적용해 최근 뉴스만 반환.
 */
export async function fetchYahooNews(ticker: string, limit = 5): Promise<NewsItem[]> {
  try {
    const res = await fetch(
      `https://feeds.finance.yahoo.com/rss/2.0/headline?s=${encodeURIComponent(ticker)}&region=US&lang=en-US`,
      {
        headers: { 'User-Agent': USER_AGENT },
        signal: AbortSignal.timeout(5000),
      },
    );
    if (!res.ok) return [];
    const xml = await res.text();
    return parseYahooRss(xml, ticker, limit);
  } catch {
    return [];
  }
}

/**
 * Yahoo RSS XML 파싱. export되어 테스트에서 직접 호출 가능.
 * 가벼운 정규식 파서 (외부 의존성 없음).
 */
export function parseYahooRss(xml: string, ticker: string, limit = 5): NewsItem[] {
  const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
  const items: NewsItem[] = [];

  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let match;
  while ((match = itemRegex.exec(xml)) !== null) {
    const block = match[1];
    const title = extractTag(block, 'title');
    const link = extractTag(block, 'link');
    const description = extractTag(block, 'description');
    const pubDate = extractTag(block, 'pubDate');

    let publishedAt: string | null = null;
    if (pubDate) {
      const ts = Date.parse(pubDate);
      if (!isNaN(ts)) {
        if (ts < oneDayAgo) continue;
        publishedAt = new Date(ts).toISOString();
      }
    }

    items.push({
      ticker,
      title,
      url: link,
      source: 'Yahoo Finance',
      publishedAt,
      summary: description || null,
    });

    if (items.length >= limit) break;
  }
  return items;
}

function extractTag(block: string, tag: string): string {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`);
  const m = block.match(re);
  if (!m) return '';
  return m[1]
    .replace(/<!\[CDATA\[/g, '')
    .replace(/\]\]>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}
