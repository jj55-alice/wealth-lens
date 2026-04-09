import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { DashboardView } from '@/components/dashboard-view';
import {
  getUserHousehold,
  getHouseholdAssets,
  getHouseholdLiabilities,
  getHouseholdMembers,
  getMonthlyGrowth,
} from '@/lib/queries';
import { getUsdKrwRate } from '@/lib/prices/bok';

// 사용자별 데이터이므로 동적 렌더 (캐싱 X)
export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  // 가구 조회 (없으면 client에서 /api/household POST로 생성하도록 fallback)
  const householdInfo = await getUserHousehold(supabase, user.id);

  if (!householdInfo) {
    // 첫 진입: client-side에서 가구 생성을 트리거하기 위해 빈 상태 렌더
    // (드물게 발생하는 케이스라 별도 client wrapper로 처리)
    const { DashboardBootstrap } = await import(
      '@/components/dashboard-bootstrap'
    );
    return <DashboardBootstrap />;
  }

  const { household } = householdInfo;

  // 모든 데이터를 병렬로 fetch — 서버↔Supabase는 매우 빠름
  const [assets, liabilities, members, monthlyGrowth] = await Promise.all([
    getHouseholdAssets(supabase, household.id),
    getHouseholdLiabilities(supabase, household.id),
    getHouseholdMembers(household.id),
    getMonthlyGrowth(supabase, household.id),
  ]);

  // 해외주식 보유 시에만 환율 조회 (in-memory 캐시 1시간)
  const hasForeign = assets.some((a) => a.price_source === 'yahoo_finance');
  const exchangeRate = hasForeign ? await getUsdKrwRate() : null;

  return (
    <DashboardView
      household={household}
      assets={assets}
      liabilities={liabilities}
      exchangeRate={exchangeRate}
      currentUserId={user.id}
      members={members}
      monthlyGrowth={monthlyGrowth}
    />
  );
}
