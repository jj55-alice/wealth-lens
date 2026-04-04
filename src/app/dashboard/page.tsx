'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { formatKRW, formatChange, formatPercent } from '@/lib/format';
import { NetWorthChart } from '@/components/net-worth-chart';
import { AssetPieChart } from '@/components/asset-pie-chart';
import { AllocationPieChart } from '@/components/allocation-pie-chart';
import { AssetList } from '@/components/asset-list';
import { LiabilityList } from '@/components/liability-list';
import { HealthScore } from '@/components/health-score';
import type { AssetWithPrice, Liability } from '@/types/database';

// Demo data for development
const DEMO_ASSETS: AssetWithPrice[] = [
  {
    id: '1', household_id: 'h1', owner_user_id: 'u1',
    category: 'real_estate', subcategory: 'owned', ownership: 'shared',
    name: '구의7단지 현대아파트 703동 2006호', ticker: null,
    quantity: null, manual_value: 850000000, price_source: 'manual',
    asset_class: 'alternative', brokerage: null, address: '서울시 광진구',
    lease_expiry: null, created_at: '', updated_at: '',
    current_price: null, current_value: 850000000,
    price_updated_at: null, is_stale: false,
  },
  {
    id: '2', household_id: 'h1', owner_user_id: 'u1',
    category: 'real_estate', subcategory: 'jeonse', ownership: 'shared',
    name: '파르네빌 703호 전세', ticker: null,
    quantity: null, manual_value: 700000000, price_source: 'manual',
    asset_class: 'alternative', brokerage: null, address: null,
    lease_expiry: '2026-09-15', created_at: '', updated_at: '',
    current_price: null, current_value: 700000000,
    price_updated_at: null, is_stale: false,
  },
  {
    id: '3', household_id: 'h1', owner_user_id: 'u1',
    category: 'stock', subcategory: null, ownership: 'personal',
    name: '현대자동차 (우리사주)', ticker: '005380',
    quantity: 50, manual_value: null, price_source: 'krx',
    asset_class: 'domestic_equity', brokerage: '우리사주', address: null,
    lease_expiry: null, created_at: '', updated_at: '',
    current_price: 250000, current_value: 12500000,
    price_updated_at: '2026-04-04T09:00:00Z', is_stale: false,
  },
  {
    id: '4', household_id: 'h1', owner_user_id: 'u1',
    category: 'crypto', subcategory: null, ownership: 'personal',
    name: '비트코인', ticker: 'BTC',
    quantity: 0.5, manual_value: null, price_source: 'upbit',
    asset_class: 'alternative', brokerage: '업비트', address: null,
    lease_expiry: null, created_at: '', updated_at: '',
    current_price: 130000000, current_value: 65000000,
    price_updated_at: '2026-04-04T13:00:00Z', is_stale: false,
  },
  {
    id: '5', household_id: 'h1', owner_user_id: 'u1',
    category: 'gold', subcategory: null, ownership: 'personal',
    name: '금 현물', ticker: null,
    quantity: 10, manual_value: null, price_source: 'gold_exchange',
    asset_class: 'commodity', brokerage: '한국투자', address: null,
    lease_expiry: null, created_at: '', updated_at: '',
    current_price: 95000, current_value: 950000,
    price_updated_at: '2026-04-04T12:00:00Z', is_stale: false,
  },
  {
    id: '6', household_id: 'h1', owner_user_id: 'u2',
    category: 'pension', subcategory: 'irp', ownership: 'personal',
    name: 'IRP (신한)', ticker: null,
    quantity: null, manual_value: 35000000, price_source: 'manual',
    asset_class: 'domestic_equity', brokerage: '신한은행', address: null,
    lease_expiry: null, created_at: '', updated_at: '',
    current_price: null, current_value: 35000000,
    price_updated_at: null, is_stale: false,
  },
  {
    id: '7', household_id: 'h1', owner_user_id: 'u1',
    category: 'cash', subcategory: 'savings', ownership: 'personal',
    name: '비상금 (CMA)', ticker: null,
    quantity: null, manual_value: 20000000, price_source: 'manual',
    asset_class: 'cash_equiv', brokerage: '키움', address: null,
    lease_expiry: null, created_at: '', updated_at: '',
    current_price: null, current_value: 20000000,
    price_updated_at: null, is_stale: false,
  },
];

const DEMO_LIABILITIES: Liability[] = [
  {
    id: 'l1', household_id: 'h1', owner_user_id: 'u1',
    category: 'mortgage', name: '주택담보대출 (구의7단지)',
    balance: 300000000, interest_rate: 3.5,
    linked_asset_id: '1', ownership: 'shared',
    created_at: '', updated_at: '',
  },
];

export default function DashboardPage() {
  const assets = DEMO_ASSETS;
  const liabilities = DEMO_LIABILITIES;

  const totalAssets = assets.reduce((sum, a) => sum + a.current_value, 0);
  const totalLiabilities = liabilities.reduce((sum, l) => sum + l.balance, 0);
  const netWorth = totalAssets - totalLiabilities;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border px-6 py-4">
        <div className="mx-auto max-w-5xl flex items-center justify-between">
          <h1 className="text-lg font-semibold">Wealth Lens</h1>
          <div className="flex items-center gap-3">
            <Link
              href="/assets/new"
              className="rounded-lg bg-primary px-4 py-2 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              + 자산 등록
            </Link>
            <Badge variant="secondary">데모 모드</Badge>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-8 space-y-6">
        {/* Net Worth Hero */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-muted-foreground">총 순자산</p>
                <p className="text-4xl font-bold tracking-tight mt-1">
                  {formatKRW(netWorth)}
                </p>
                <div className="flex gap-3 mt-2">
                  <span className="text-sm text-emerald-500">
                    이번 주 {formatChange(15200000)}
                    {' '}({formatPercent(1.2)})
                  </span>
                </div>
              </div>
              <HealthScore
                assets={assets}
                liabilities={liabilities}
                totalAssets={totalAssets}
                totalLiabilities={totalLiabilities}
              />
            </div>

            <Separator className="my-4" />

            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-xs text-muted-foreground">총 자산</p>
                <p className="text-lg font-semibold text-emerald-500">
                  {formatKRW(totalAssets)}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">총 부채</p>
                <p className="text-lg font-semibold text-red-500">
                  {formatKRW(totalLiabilities)}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">순자산</p>
                <p className="text-lg font-semibold">{formatKRW(netWorth)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Charts */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">자산 유형별</CardTitle>
            </CardHeader>
            <CardContent>
              <AssetPieChart assets={assets} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">투자 자산 배분</CardTitle>
            </CardHeader>
            <CardContent>
              <AllocationPieChart assets={assets} />
            </CardContent>
          </Card>
        </div>

        {/* Asset List */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">자산 목록</CardTitle>
          </CardHeader>
          <CardContent>
            <AssetList assets={assets} />
          </CardContent>
        </Card>

        {/* Liabilities */}
        {liabilities.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">부채</CardTitle>
            </CardHeader>
            <CardContent>
              <LiabilityList liabilities={liabilities} />
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
