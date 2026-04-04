import type { PriceSource } from '@/types/database';

export interface PriceResult {
  price: number;
  currency: 'KRW' | 'USD';
  timestamp: Date;
  source: PriceSource;
  stale: boolean;
}

export interface PriceAdapter {
  fetchPrice(ticker: string): Promise<PriceResult>;
  fetchBatch(tickers: string[]): Promise<Map<string, PriceResult>>;
}
