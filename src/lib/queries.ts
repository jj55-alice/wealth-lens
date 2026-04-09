import { SupabaseClient, createClient } from '@supabase/supabase-js';
import type { Liability, AssetWithPrice, Household } from '@/types/database';
import { getSupabaseUrl, getServiceRoleKey } from '@/lib/env';

export async function getUserHousehold(
  supabase: SupabaseClient,
  userId?: string,
) {
  let uid = userId;
  if (!uid) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;
    uid = user.id;
  }

  const { data: membership } = await supabase
    .from('household_members')
    .select('household_id, role, households(id, name, created_at, goal_net_worth, goal_annual_dividend)')
    .eq('user_id', uid)
    .maybeSingle();

  if (!membership) return null;

  return {
    household: membership.households as unknown as Household,
    role: membership.role as string,
    userId: uid,
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

    if (asset.manual_value != null && asset.manual_value !== '') {
      currentValue = Number(asset.manual_value);
    } else if (asset.kb_estimated_value) {
      currentValue = Number(asset.kb_estimated_value);
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

export interface HouseholdMemberInfo {
  user_id: string;
  nickname: string | null;
  email: string;
}

export async function getHouseholdMembers(
  householdId: string,
): Promise<HouseholdMemberInfo[]> {
  const supabaseAdmin = createClient(getSupabaseUrl(), getServiceRoleKey());

  const { data: members } = await supabaseAdmin
    .from('household_members')
    .select('user_id, role')
    .eq('household_id', householdId);

  if (!members || members.length === 0) return [];

  // 멤버의 auth user 정보를 병렬로 조회
  const details = await Promise.all(
    members.map(async (m) => {
      const { data: userData } = await supabaseAdmin.auth.admin.getUserById(
        m.user_id,
      );
      return {
        user_id: m.user_id,
        email: userData?.user?.email ?? '알 수 없음',
        nickname:
          (userData?.user?.user_metadata?.nickname as string | undefined) ?? null,
      };
    }),
  );

  return details;
}

export async function getMonthlyGrowth(
  supabase: SupabaseClient,
  householdId: string,
): Promise<number | null> {
  const threeMonthsAgo = new Date();
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

  const { data: snapshots } = await supabase
    .from('household_snapshots')
    .select('net_worth, snapshot_date')
    .eq('household_id', householdId)
    .gte('snapshot_date', threeMonthsAgo.toISOString().split('T')[0])
    .order('snapshot_date', { ascending: true });

  if (!snapshots || snapshots.length < 2) return null;

  const oldest = snapshots[0];
  const newest = snapshots[snapshots.length - 1];
  const daysDiff =
    (new Date(newest.snapshot_date).getTime() -
      new Date(oldest.snapshot_date).getTime()) /
    (1000 * 60 * 60 * 24);

  if (daysDiff <= 0) return null;
  const monthsDiff = daysDiff / 30;
  return Math.round(
    (Number(newest.net_worth) - Number(oldest.net_worth)) / monthsDiff,
  );
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
