export type Signal = 'risk' | 'opportunity' | 'neutral';

export type BriefingProvider = 'anthropic' | 'openai';

export interface BriefingCard {
  ticker: string;
  name: string;
  signal: Signal;
  headline: string; // 한 줄 요약 (액션 단어 금지)
  context: string; // 매수가 / 비중 / 수익률 컨텍스트
  news_urls: string[];
  feedback?: 1 | -1 | null; // 사용자 피드백 (👍/👎)
}

export interface BriefingResult {
  cards: BriefingCard[];
  status: 'success' | 'partial' | 'failed' | 'empty';
  model: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  errorMessage?: string;
}

export interface HoldingContext {
  ticker: string;
  name: string;
  asset_class: string | null;
  quantity: number | null;
  purchase_price: number | null;
  current_value: number;
  weight_pct: number; // 포트폴리오 내 비중 (0~100)
  return_pct: number | null; // 매수가 대비 수익률
  price_source: string;
}
