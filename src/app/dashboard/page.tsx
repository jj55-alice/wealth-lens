import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getUserHousehold, getHouseholdAssets, getHouseholdLiabilities } from '@/lib/queries';
import { DashboardView } from '@/components/dashboard-view';

export default async function DashboardPage() {
  const supabase = await createClient();
  const household = await getUserHousehold(supabase);

  if (!household) {
    redirect('/login');
  }

  const [assets, liabilities] = await Promise.all([
    getHouseholdAssets(supabase, household.household.id),
    getHouseholdLiabilities(supabase, household.household.id),
  ]);

  return (
    <DashboardView
      household={household.household}
      assets={assets}
      liabilities={liabilities}
    />
  );
}
