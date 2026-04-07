import Anthropic from '@anthropic-ai/sdk';
import { SYSTEM_PROMPT, buildUserPrompt } from './prompts';
import type { BriefingCard, BriefingResult, HoldingContext, Signal } from './types';
import type { NewsItem } from '../news/types';

// Sonnet 4.6 가격 (1M tokens 기준, 2026-04 시점):
//   input: $3.00, output: $15.00
// Haiku 4.5: input $0.80, output $4.00
const MODEL_PRICES: Record<string, { in: number; out: number }> = {
  'claude-sonnet-4-6': { in: 3.0, out: 15.0 },
  'claude-haiku-4-5-20251001': { in: 0.8, out: 4.0 },
};

const DEFAULT_MODEL = 'claude-sonnet-4-6';

/**
 * 액션 단어 (CEO 리뷰 결정: 절대 사용 금지).
 * 카드 카피에 이런 단어가 있으면 제거하거나 카드 자체를 dropping.
 */
const FORBIDDEN_WORDS = ['매수', '매도', '추가매수', '추가 매수', '추가 매도', '정리', '팔아라', '사라', '매도세', '매수세'];

export async function generateBriefing(
  holdings: HoldingContext[],
  newsByTicker: Map<string, NewsItem[]>,
  modelOverride?: string,
): Promise<BriefingResult> {
  const model = modelOverride ?? DEFAULT_MODEL;

  // 보유 종목이 없으면 빈 결과
  if (holdings.length === 0) {
    return {
      cards: [],
      status: 'empty',
      model,
      inputTokens: 0,
      outputTokens: 0,
      costUsd: 0,
    };
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return {
      cards: [],
      status: 'failed',
      model,
      inputTokens: 0,
      outputTokens: 0,
      costUsd: 0,
      errorMessage: 'ANTHROPIC_API_KEY 환경변수가 설정되지 않았습니다',
    };
  }

  const client = new Anthropic({ apiKey });
  const userPrompt = buildUserPrompt(holdings, newsByTicker);

  try {
    const response = await client.messages.create({
      model,
      max_tokens: 2000,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userPrompt }],
    });

    const inputTokens = response.usage.input_tokens;
    const outputTokens = response.usage.output_tokens;
    const price = MODEL_PRICES[model] ?? MODEL_PRICES[DEFAULT_MODEL];
    const costUsd = (inputTokens * price.in + outputTokens * price.out) / 1_000_000;

    // 응답 텍스트에서 JSON 추출
    const textContent = response.content.find((c) => c.type === 'text');
    if (!textContent || textContent.type !== 'text') {
      return {
        cards: [],
        status: 'failed',
        model,
        inputTokens,
        outputTokens,
        costUsd,
        errorMessage: 'LLM 응답에서 텍스트를 찾을 수 없습니다',
      };
    }

    const cards = parseCards(textContent.text);
    const status = cards.length === 0 ? 'empty' : 'success';

    return {
      cards,
      status,
      model,
      inputTokens,
      outputTokens,
      costUsd,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      cards: [],
      status: 'failed',
      model,
      inputTokens: 0,
      outputTokens: 0,
      costUsd: 0,
      errorMessage: message,
    };
  }
}

/**
 * LLM 응답에서 JSON cards 배열 파싱.
 * 마크다운 코드 펜스(```json) 안에 있을 수도 있고, 그냥 JSON일 수도 있음.
 * 액션 단어가 포함된 카드는 자동 필터링.
 *
 * export하여 테스트에서 직접 호출 가능.
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

    // 액션 단어 필터: headline 또는 context에 금지어 포함 시 카드 dropping
    const combined = `${headline} ${context}`.toLowerCase();
    if (FORBIDDEN_WORDS.some((w) => combined.includes(w.toLowerCase()))) {
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
