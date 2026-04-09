import type { PriceSource } from '@/types/database';

export interface PriceResult {
  price: number;
  /** 어제 종가 (또는 장 시작 직전 종가). 당일 변동률 계산용. null이면 데이터 없음. */
  previousClose?: number | null;
  currency: 'KRW' | 'USD';
  timestamp: Date;
  source: PriceSource;
  stale: boolean;
}

export interface PriceAdapter {
  fetchPrice(ticker: string): Promise<PriceResult>;
  fetchBatch(tickers: string[]): Promise<Map<string, PriceResult>>;
}
