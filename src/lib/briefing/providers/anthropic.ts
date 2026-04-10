import Anthropic from '@anthropic-ai/sdk';
import { SYSTEM_PROMPT, buildUserPrompt } from '../prompts';
import { parseCards } from '../parser';
import type { BriefingResult, HoldingContext } from '../types';
import type { PaceSummary } from '../pace';
import type { NewsItem } from '../../news/types';

// Claude 가격 (1M tokens 기준, 2026-04 시점):
//   Sonnet 4.6: input .00, output .00
//   Haiku 4.5:  input .80, output .00
const MODEL_PRICES: Record<string, { in: number; out: number }> = {
  'claude-sonnet-4-6': { in: 3.0, out: 15.0 },
  'claude-haiku-4-5-20251001': { in: 0.8, out: 4.0 },
};

const DEFAULT_MODEL = 'claude-sonnet-4-6';

export async function generateWithAnthropic(
  holdings: HoldingContext[],
  newsByTicker: Map<string, NewsItem[]>,
  pace: PaceSummary | null = null,
  modelOverride?: string,
): Promise<BriefingResult> {
  const model = modelOverride ?? DEFAULT_MODEL;

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
  const userPrompt = buildUserPrompt(holdings, newsByTicker, pace);

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

    const textContent = response.content.find((c) => c.type === 'text');
    if (!textContent || textContent.type !== 'text') {
      return {
        cards: [],
        status: 'failed',
        model,
        inputTokens,
        outputTokens,
        costUsd,
        errorMessage: 'Anthropic 응답에서 텍스트를 찾을 수 없습니다',
      };
    }

    const cards = parseCards(textContent.text);
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
