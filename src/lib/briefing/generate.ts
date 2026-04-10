import { generateWithAnthropic } from './providers/anthropic';
import { generateWithOpenAI } from './providers/openai';
import type { BriefingProvider, BriefingResult, HoldingContext } from './types';
import type { PaceSummary } from './pace';
import type { NewsItem } from '../news/types';

// parseCards 는 이제 ./parser.ts 에 있고 provider 들이 직접 호출.
// 기존 테스트/외부 사용자를 위해 re-export 유지.
export { parseCards } from './parser';

/**
 * 가구별 provider 설정에 따라 Anthropic 또는 OpenAI 브리핑 생성.
 * 보유 종목 empty / provider 오탈자 등 상위 fast-path 처리 후 provider 디스패치.
 */
export async function generateBriefing(
  holdings: HoldingContext[],
  newsByTicker: Map<string, NewsItem[]>,
  provider: BriefingProvider = 'anthropic',
  pace: PaceSummary | null = null,
): Promise<BriefingResult> {
  // 보유 종목이 없으면 provider 호출 없이 빈 결과
  if (holdings.length === 0) {
    return {
      cards: [],
      status: 'empty',
      model: provider,
      inputTokens: 0,
      outputTokens: 0,
      costUsd: 0,
    };
  }

  switch (provider) {
    case 'openai':
      return generateWithOpenAI(holdings, newsByTicker, pace);
    case 'anthropic':
    default:
      return generateWithAnthropic(holdings, newsByTicker, pace);
  }
}
