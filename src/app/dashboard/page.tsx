'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { DashboardView } from '@/components/dashboard-view';
import { Skeleton } from '@/components/ui/skeleton';
import type { AssetWithPrice, Liability, Household } from '@/types/database';

export default function DashboardPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [household, setHousehold] = useState<Household | null>(null);
  const [assets, setAssets] = useState<AssetWithPrice[]>([]);
  const [liabilities, setLiabilities] = useState<Liability[]>([]);

  useEffect(() => {
    async function load() {
      const supabase = createClient();

      const { data: { user }, error: authError } = await supabase.auth.getUser();
      console.log('Auth user:', user?.id, 'error:', authError?.message);

      if (!user) {
        router.push('/login');
        return;
      }

      // Get household
      const { data: membership, error: memberError } = await supabase
        .from('household_members')
        .select('household_id, role, households(id, name, created_at)')
        .eq('user_id', user.id)
        .maybeSingle();

      console.log('Membership:', membership, 'error:', memberError?.message);

      if (!membership?.households) {
        // Create household via API (uses service_role to bypass RLS)
        const res = await fetch('/api/household', { method: 'POST' });
        const body = await res.json();

        if (body.household_id) {
          // Re-fetch membership after creation
          const { data: newMembership } = await supabase
            .from('household_members')
            .select('household_id, role, households(id, name, created_at)')
            .eq('user_id', user.id)
            .single();

          if (newMembership?.households) {
            setHousehold(newMembership.households as unknown as Household);
          }
        }
        setLoading(false);
        return;
      }

      const hh = membership.households as unknown as Household;
      setHousehold(hh);

      // Fetch assets and liabilities
      const [assetsRes, liabilitiesRes] = await Promise.all([
        supabase
          .from('assets')
          .select('*')
          .eq('household_id', hh.id)
          .order('category')
          .order('created_at'),
        supabase
          .from('liabilities')
          .select('*')
          .eq('household_id', hh.id)
          .order('created_at'),
      ]);

      // Get cached prices
      const rawAssets = assetsRes.data ?? [];
      const tickers = rawAssets.filter((a) => a.ticker).map((a) => a.ticker as string);
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

      setAssets(
        rawAssets.map((asset) => {
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
        }),
      );

      setLiabilities(
        (liabilitiesRes.data ?? []).map((l) => ({
          ...l,
          balance: Number(l.balance),
          interest_rate: l.interest_rate ? Number(l.interest_rate) : null,
        })) as Liability[],
      );

      setLoading(false);
    }

    load();
  }, [router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <header className="border-b border-border px-6 py-4">
          <div className="mx-auto max-w-5xl">
            <Skeleton className="h-6 w-32" />
          </div>
        </header>
        <main className="mx-auto max-w-5xl px-6 py-8 space-y-6">
          <Skeleton className="h-40 w-full rounded-xl" />
          <div className="grid grid-cols-2 gap-6">
            <Skeleton className="h-64 rounded-xl" />
            <Skeleton className="h-64 rounded-xl" />
          </div>
          <Skeleton className="h-48 rounded-xl" />
        </main>
      </div>
    );
  }

  if (!household) return null;

  return (
    <DashboardView
      household={household}
      assets={assets}
      liabilities={liabilities}
    />
  );
}
