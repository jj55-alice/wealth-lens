import { SupabaseClient } from '@supabase/supabase-js';
import type { Asset, Liability, AssetWithPrice, Household } from '@/types/database';

export async function getUserHousehold(supabase: SupabaseClient) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: membership } = await supabase
    .from('household_members')
    .select('household_id, role, households(id, name, created_at, goal_net_worth, goal_annual_dividend)')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!membership) return null;

  return {
    household: membership.households as unknown as Household,
    role: membership.role as string,
    userId: user.id,
  };
}

export async function getHouseholdAssets(
  supabase: SupabaseClient,
  householdId: string,
): Promise<AssetWithPrice[]> {
  const { data: assets } = await supabase
    .from('assets')
    .select('*')
    .eq('household_id', householdId)
    .order('category')
    .order('created_at');

  if (!assets) return [];

  // Get cached prices
  const tickers = assets
    .filter((a) => a.ticker)
    .map((a) => a.ticker as string);

  const priceMap = new Map<string, { price: number; fetched_at: string }>();
  if (tickers.length > 0) {
    const { data: prices } = await supabase
      .from('price_cache')
      .select('ticker, price, fetched_at')
      .in('ticker', tickers);

    if (prices) {
      for (const p of prices) {
        priceMap.set(p.ticker, { price: p.price, fetched_at: p.fetched_at });
      }
    }
  }

  return assets.map((asset) => {
    const cached = asset.ticker ? priceMap.get(asset.ticker) : null;
    const currentPrice = cached?.price ?? null;
    let currentValue = 0;

    if (asset.manual_value) {
      currentValue = Number(asset.manual_value);
    } else if (currentPrice && asset.quantity) {
      currentValue = currentPrice * Number(asset.quantity);
    }

    const isStale = cached
      ? Date.now() - new Date(cached.fetched_at).getTime() > 24 * 60 * 60 * 1000
      : false;

    return {
      ...asset,
      quantity: asset.quantity ? Number(asset.quantity) : null,
      manual_value: asset.manual_value ? Number(asset.manual_value) : null,
      current_price: currentPrice,
      current_value: currentValue,
      price_updated_at: cached?.fetched_at ?? null,
      is_stale: isStale,
    } as AssetWithPrice;
  });
}

export async function getHouseholdLiabilities(
  supabase: SupabaseClient,
  householdId: string,
): Promise<Liability[]> {
  const { data } = await supabase
    .from('liabilities')
    .select('*')
    .eq('household_id', householdId)
    .order('created_at');

  return (data ?? []).map((l) => ({
    ...l,
    balance: Number(l.balance),
    interest_rate: l.interest_rate ? Number(l.interest_rate) : null,
  })) as Liability[];
}
