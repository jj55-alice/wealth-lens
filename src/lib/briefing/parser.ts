import type { BriefingCard, Signal } from './types';

/**
 * 액션 phrase (CEO 리뷰 결정: 절대 사용 금지).
 * 단순 단어("매수", "매도")는 정상 합성어("매수가", "매도세")가 있어서 phrase로만 매칭.
 * 카드 카피에 이런 phrase가 있으면 카드 자체를 dropping.
 */
const FORBIDDEN_PHRASES = [
  '추가 매수',
  '추가매수',
  '추가 매도',
  '추가매도',
  '매수 추천',
  '매수 권장',
  '매수 권유',
  '매도 추천',
  '매도 권장',
  '매도 권유',
  '매수하세요',
  '매도하세요',
  '팔아라',
  '사라',
  '비중 확대 권장',
  '비중 축소 권장',
  '처분 권장',
];

/**
 * LLM 응답에서 JSON cards 배열 파싱.
 * 마크다운 코드 펜스(```json) 안에 있을 수도 있고, 그냥 JSON일 수도 있음.
 * 액션 단어가 포함된 카드는 자동 필터링.
 *
 * Anthropic/OpenAI 양쪽 provider 에서 공유. provider-agnostic 하도록
 * 입력 텍스트만 받고 동일 포맷의 BriefingCard[] 반환.
 */
export function parseCards(text: string): BriefingCard[] {
  // 마크다운 코드 펜스 제거
  let jsonText = text.trim();
  const fenceMatch = jsonText.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) jsonText = fenceMatch[1].trim();

  // 첫 { 부터 마지막 } 까지만 추출 (LLM이 앞뒤에 텍스트 붙일 수 있음)
  const firstBrace = jsonText.indexOf('{');
  const lastBrace = jsonText.lastIndexOf('}');
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    jsonText = jsonText.slice(firstBrace, lastBrace + 1);
  }

  let parsed: { cards?: unknown };
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    return [];
  }

  if (!parsed.cards || !Array.isArray(parsed.cards)) return [];

  const validSignals: Signal[] = ['risk', 'opportunity', 'neutral'];
  const result: BriefingCard[] = [];

  for (const raw of parsed.cards) {
    if (!raw || typeof raw !== 'object') continue;
    const obj = raw as Record<string, unknown>;
    const ticker = String(obj.ticker ?? '').trim();
    const name = String(obj.name ?? '').trim();
    const signal = String(obj.signal ?? '').trim() as Signal;
    const headline = String(obj.headline ?? '').trim();
    const context = String(obj.context ?? '').trim();
    const news_urls = Array.isArray(obj.news_urls)
      ? obj.news_urls.map((u) => String(u)).filter((u) => u.length > 0)
      : [];

    if (!ticker || !name || !headline) continue;
    if (!validSignals.includes(signal)) continue;

    // 액션 phrase 필터: headline 또는 context에 금지 phrase 포함 시 카드 dropping
    const combined = `${headline} ${context}`;
    if (FORBIDDEN_PHRASES.some((p) => combined.includes(p))) {
      continue;
    }

    result.push({
      ticker,
      name,
      signal,
      headline,
      context,
      news_urls,
      feedback: null,
    });
  }

  // 최대 5장
  return result.slice(0, 5);
}
