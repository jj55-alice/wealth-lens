import type { PriceSource } from '@/types/database';
import type { PriceAdapter, PriceResult } from './types';
import { upbitAdapter } from './upbit';
import { goldAdapter } from './gold';

const adapters: Record<string, PriceAdapter> = {
  upbit: upbitAdapter,
  gold_exchange: goldAdapter,
  // TODO: yahoo (해외주식), krx/naver (국내주식), bok (환율)
};

export async function fetchPrice(
  ticker: string,
  source: PriceSource,
): Promise<PriceResult | null> {
  const adapter = adapters[source];
  if (!adapter) return null;

  try {
    return await adapter.fetchPrice(ticker);
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
        for (const [ticker, result] of batch) {
          results.set(ticker, result);
        }
      } catch {
        // Source failed entirely, skip
      }
    },
  );

  await Promise.allSettled(promises);
  return results;
}
