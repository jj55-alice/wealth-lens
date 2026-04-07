import { describe, it, expect } from 'vitest';
import { parseCards } from '@/lib/briefing/generate';
import { parseYahooRss } from '@/lib/news/yahoo';

describe('parseCards (LLM output 형식 검증)', () => {
  it('정상 JSON에서 카드를 파싱한다', () => {
    const text = JSON.stringify({
      cards: [
        {
          ticker: 'NVDA',
          name: '엔비디아',
          signal: 'risk',
          headline: 'AI 칩 수출 규제 우려 보도',
          context: '매수가 -15%, 비중 12% — 관망 권장',
          news_urls: ['https://example.com/news/1'],
        },
      ],
    });
    const cards = parseCards(text);
    expect(cards).toHaveLength(1);
    expect(cards[0].ticker).toBe('NVDA');
    expect(cards[0].signal).toBe('risk');
    expect(cards[0].feedback).toBeNull();
  });

  it('마크다운 코드 펜스(```json) 안 JSON도 파싱한다', () => {
    const text = '여기 결과입니다:\n```json\n{"cards":[{"ticker":"AAPL","name":"애플","signal":"opportunity","headline":"신제품 출시","context":"비중 8%","news_urls":[]}]}\n```\n끝.';
    const cards = parseCards(text);
    expect(cards).toHaveLength(1);
    expect(cards[0].ticker).toBe('AAPL');
  });

  it('액션 phrase 포함 카드를 자동 필터링한다', () => {
    const text = JSON.stringify({
      cards: [
        { ticker: 'NVDA', name: '엔비디아', signal: 'opportunity', headline: '추가 매수 권장', context: '', news_urls: [] },
        { ticker: 'TSLA', name: '테슬라', signal: 'opportunity', headline: '신제품 발표', context: '비중 5% — 주목', news_urls: [] },
        { ticker: 'AAPL', name: '애플', signal: 'risk', headline: '실적 부진', context: '매도 권장', news_urls: [] },
      ],
    });
    const cards = parseCards(text);
    // NVDA(추가 매수), AAPL(매도 권장) 필터링되고 TSLA만 남음
    expect(cards).toHaveLength(1);
    expect(cards[0].ticker).toBe('TSLA');
  });

  it('정상 단어("매수가","매도세") 포함 카드는 통과한다', () => {
    const text = JSON.stringify({
      cards: [
        {
          ticker: 'NVDA', name: '엔비디아', signal: 'risk',
          headline: 'AI 칩 규제 우려',
          context: '매수가 -15%, 매도세 강화 — 관망 권장',
          news_urls: [],
        },
      ],
    });
    const cards = parseCards(text);
    // "매수가", "매도세"는 정상 단어, "관망 권장"도 정보 단어 → 통과
    expect(cards).toHaveLength(1);
  });

  it('잘못된 signal 값 카드는 제외한다', () => {
    const text = JSON.stringify({
      cards: [
        { ticker: 'NVDA', name: 'X', signal: 'unknown', headline: 'h', context: 'c', news_urls: [] },
        { ticker: 'AAPL', name: 'Y', signal: 'neutral', headline: 'h', context: 'c', news_urls: [] },
      ],
    });
    const cards = parseCards(text);
    expect(cards).toHaveLength(1);
    expect(cards[0].ticker).toBe('AAPL');
  });

  it('카드 5장 초과 시 5장으로 잘린다', () => {
    const text = JSON.stringify({
      cards: Array.from({ length: 8 }, (_, i) => ({
        ticker: `T${i}`,
        name: `name${i}`,
        signal: 'neutral',
        headline: `headline${i}`,
        context: `context${i}`,
        news_urls: [],
      })),
    });
    const cards = parseCards(text);
    expect(cards).toHaveLength(5);
  });

  it('파싱 실패 시 빈 배열 반환', () => {
    expect(parseCards('not a json at all')).toEqual([]);
    expect(parseCards('{"cards": "not an array"}')).toEqual([]);
    expect(parseCards('')).toEqual([]);
  });
});

describe('parseYahooRss', () => {
  it('정상 RSS에서 item을 추출한다', () => {
    const xml = `<?xml version="1.0"?>
      <rss>
        <channel>
          <item>
            <title>Apple stock surges on new product</title>
            <link>https://example.com/apple-news</link>
            <description>Apple announced...</description>
            <pubDate>${new Date().toUTCString()}</pubDate>
          </item>
        </channel>
      </rss>`;
    const items = parseYahooRss(xml, 'AAPL', 5);
    expect(items.length).toBeGreaterThanOrEqual(1);
    expect(items[0].title).toContain('Apple');
    expect(items[0].url).toBe('https://example.com/apple-news');
    expect(items[0].source).toBe('Yahoo Finance');
  });

  it('24시간보다 오래된 뉴스는 필터링', () => {
    const oldDate = new Date(Date.now() - 48 * 60 * 60 * 1000).toUTCString();
    const xml = `<rss><channel>
      <item><title>Old news</title><link>x</link><description>d</description><pubDate>${oldDate}</pubDate></item>
    </channel></rss>`;
    const items = parseYahooRss(xml, 'AAPL', 5);
    expect(items).toHaveLength(0);
  });

  it('CDATA 블록을 정리한다', () => {
    const xml = `<rss><channel>
      <item><title><![CDATA[Apple & news]]></title><link>x</link><description>d</description><pubDate>${new Date().toUTCString()}</pubDate></item>
    </channel></rss>`;
    const items = parseYahooRss(xml, 'AAPL', 5);
    expect(items[0].title).toBe('Apple & news');
  });
});
