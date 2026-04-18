import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { getSupabaseUrl, getServiceRoleKey } from '@/lib/env';
import { AssetsView } from '@/components/assets-view';
import {
  getUserHousehold,
  getHouseholdAssets,
  getHouseholdLiabilities,
  getHouseholdMembers,
} from '@/lib/queries';
import { getUsdKrwRate } from '@/lib/prices/bok';
import type { AccountEntry } from '@/components/asset-list';

// 사용자별 데이터 → 동적 렌더
export const dynamic = 'force-dynamic';

export default async function AssetsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const householdInfo = await getUserHousehold(supabase, user.id);
  if (!householdInfo) redirect('/dashboard');

  const { household } = householdInfo;

  // household_accounts 는 RLS 가 user_id 본인만 허용하므로 admin 으로 household 전체를 가져옴
  // (가구 공동 자산목록에서도 배우자 계좌와 매칭 필요)
  const admin = createAdminClient(getSupabaseUrl(), getServiceRoleKey());

  const [assets, liabilities, members, accountsRes] = await Promise.all([
    getHouseholdAssets(supabase, household.id),
    getHouseholdLiabilities(supabase, household.id),
    getHouseholdMembers(household.id),
    admin
      .from('household_accounts')
      .select('user_id, brokerage, alias, account_type')
      .eq('household_id', household.id),
  ]);

  const accounts: AccountEntry[] = (accountsRes.data ?? []).map((a) => ({
    user_id: a.user_id,
    brokerage: a.brokerage,
    alias: a.alias,
    account_type: a.account_type,
  }));

  const hasForeign = assets.some((a) => a.price_source === 'yahoo_finance');
  const exchangeRate = hasForeign ? await getUsdKrwRate() : null;

  return (
    <AssetsView
      assets={assets}
      liabilities={liabilities}
      exchangeRate={exchangeRate}
      currentUserId={user.id}
      members={members}
      accounts={accounts}
    />
  );
}
