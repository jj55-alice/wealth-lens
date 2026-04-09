import OpenAI from 'openai';
import { SYSTEM_PROMPT, buildUserPrompt } from '../prompts';
import { parseCards } from '../parser';
import type { BriefingResult, HoldingContext } from '../types';
import type { NewsItem } from '../../news/types';

// OpenAI 가격 (1M tokens 기준, 2026-04 시점):
//   gpt-4o-mini: input .15, output .60  (기본값 — Claude Sonnet 대비 20배 저렴)
//   gpt-4o:      input .50, output .00  (고품질)
const MODEL_PRICES: Record<string, { in: number; out: number }> = {
  'gpt-4o-mini': { in: 0.15, out: 0.6 },
  'gpt-4o': { in: 2.5, out: 10.0 },
};

const DEFAULT_MODEL = 'gpt-4o-mini';

export async function generateWithOpenAI(
  holdings: HoldingContext[],
  newsByTicker: Map<string, NewsItem[]>,
  modelOverride?: string,
): Promise<BriefingResult> {
  const model = modelOverride ?? DEFAULT_MODEL;

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return {
      cards: [],
      status: 'failed',
      model,
      inputTokens: 0,
      outputTokens: 0,
      costUsd: 0,
      errorMessage: 'OPENAI_API_KEY 환경변수가 설정되지 않았습니다',
    };
  }

  const client = new OpenAI({ apiKey });
  const userPrompt = buildUserPrompt(holdings, newsByTicker);

  try {
    const response = await client.chat.completions.create({
      model,
      // json_object mode: messages 중에 "JSON"이라는 단어가 반드시 있어야 함.
      // SYSTEM_PROMPT 에 이미 "JSON 형식으로 응답" 지시가 포함돼 있어 충족.
      response_format: { type: 'json_object' },
      max_tokens: 2000,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
    });

    const inputTokens = response.usage?.prompt_tokens ?? 0;
    const outputTokens = response.usage?.completion_tokens ?? 0;
    const price = MODEL_PRICES[model] ?? MODEL_PRICES[DEFAULT_MODEL];
    const costUsd = (inputTokens * price.in + outputTokens * price.out) / 1_000_000;

    const text = response.choices[0]?.message?.content;
    if (!text) {
      return {
        cards: [],
        status: 'failed',
        model,
        inputTokens,
        outputTokens,
        costUsd,
        errorMessage: 'OpenAI 응답이 비어있습니다',
      };
    }

    const cards = parseCards(text);
    return {
      cards,
      status: cards.length === 0 ? 'empty' : 'success',
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
