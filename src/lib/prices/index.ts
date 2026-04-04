import type { PriceSource } from '@/types/database';
import type { PriceAdapter, PriceResult } from './types';
import { upbitAdapter } from './upbit';
import { goldAdapter } from './gold';
import { naverAdapter } from './naver';
import { yahooAdapter } from './yahoo';
import { getUsdKrwRate, convertUsdToKrw } from './bok';

const adapters: Record<string, PriceAdapter> = {
  upbit: upbitAdapter,
  gold_exchange: goldAdapter,
  krx: naverAdapter,
  yahoo_finance: yahooAdapter,
};

export async function fetchPrice(
  ticker: string,
  source: PriceSource,
): Promise<PriceResult | null> {
  const adapter = adapters[source];
  if (!adapter) return null;

  try {
    const result = await adapter.fetchPrice(ticker);

    // Convert USD to KRW for foreign stocks
    if (result.currency === 'USD') {
      const rate = await getUsdKrwRate();
      return convertUsdToKrw(result, rate);
    }

    return result;
  } catch {
    return null;
  }
}

export async function fetchPricesBatch(
  items: { ticker: string; source: PriceSource }[],
): Promise<Map<string, PriceResult>> {
  const results = new Map<string, PriceResult>();

  // Group by source for batch fetching
  const bySource = new Map<PriceSource, string[]>();
  for (const item of items) {
    const list = bySource.get(item.source) ?? [];
    list.push(item.ticker);
    bySource.set(item.source, list);
  }

  // Fetch all sources in parallel
  const promises = Array.from(bySource.entries()).map(
    async ([source, tickers]) => {
      const adapter = adapters[source];
      if (!adapter) return;

      try {
        const batch = await adapter.fetchBatch(tickers);

        // Convert USD prices for yahoo_finance
        let usdKrwRate: number | null = null;
        for (const [ticker, result] of batch) {
          if (result.currency === 'USD') {
            if (!usdKrwRate) usdKrwRate = await getUsdKrwRate();
            results.set(ticker, convertUsdToKrw(result, usdKrwRate));
          } else {
            results.set(ticker, result);
          }
        }
      } catch {
        // Source failed entirely, skip
      }
    },
  );

  await Promise.allSettled(promises);
  return results;
}

export { getUsdKrwRate } from './bok';
