'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/ui/toast';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { AssetList, type AccountEntry } from '@/components/asset-list';
import { formatKRW } from '@/lib/format';
import type { AssetWithPrice } from '@/types/database';

type OwnerFilter = 'all' | 'mine' | 'spouse' | 'shared';

interface MemberInfo {
  user_id: string;
  nickname: string | null;
  email: string;
}

interface Props {
  assets: AssetWithPrice[];
  exchangeRate?: number | null;
  currentUserId?: string;
  members?: MemberInfo[];
  accounts: AccountEntry[];
}

export function AssetsView({
  assets,
  exchangeRate,
  currentUserId,
  members = [],
  accounts,
}: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const [ownerFilter, setOwnerFilter] = useState<OwnerFilter>('all');

  const spouse = members.find((m) => m.user_id !== currentUserId);
  const myName = members.find((m) => m.user_id === currentUserId)?.nickname || '본인';
  const spouseName = spouse?.nickname || '배우자';

  const filteredAssets = useMemo(() => {
    if (ownerFilter === 'all') return assets;
    if (ownerFilter === 'mine')
      return assets.filter(
        (a) => a.owner_user_id === currentUserId && a.ownership === 'personal',
      );
    if (ownerFilter === 'spouse')
      return assets.filter(
        (a) => a.owner_user_id !== currentUserId && a.ownership === 'personal',
      );
    if (ownerFilter === 'shared') return assets.filter((a) => a.ownership === 'shared');
    return assets;
  }, [assets, ownerFilter, currentUserId]);

  const totalAssets = filteredAssets.reduce((s, a) => s + a.current_value, 0);
  const missingPurchasePriceStocks = assets.filter(
    (a) => a.category === 'stock' && (!a.purchase_price || a.purchase_price <= 0),
  );

  const refreshData = async () => {
    router.refresh();
    toast('자산 목록이 갱신되었습니다', 'success');
  };

  const filterTabs: { key: OwnerFilter; label: string; shortLabel: string }[] = [
    { key: 'all', label: '전체', shortLabel: '전체' },
    { key: 'mine', label: myName, shortLabel: '나' },
    { key: 'spouse', label: spouseName, shortLabel: spouseName.slice(0, 3) },
    { key: 'shared', label: '공동', shortLabel: '공동' },
  ];

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border px-4 sm:px-6 py-3 sm:py-4">
        <div className="mx-auto max-w-5xl flex items-center gap-4">
          <Link href="/dashboard">
            <Button variant="ghost" size="sm">
              ←
            </Button>
          </Link>
          <h1 className="text-lg font-semibold">자산 목록</h1>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-8 space-y-6">
        {assets.length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center">
              <p className="text-4xl mb-4">📋</p>
              <h2 className="text-lg font-semibold">등록된 자산이 없어요</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                첫 번째 자산을 등록해서 시작하세요
              </p>
              <Link
                href="/assets/new"
                className="mt-4 inline-block rounded-lg bg-primary px-6 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                자산 등록하기
              </Link>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* 요약 헤더 */}
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-muted-foreground">
                      {ownerFilter === 'all'
                        ? '총 자산'
                        : ownerFilter === 'mine'
                          ? `${myName}님 자산`
                          : ownerFilter === 'spouse'
                            ? `${spouseName}님 자산`
                            : '공동 자산'}
                    </p>
                    <p className="text-3xl font-bold tracking-tight mt-1 tabular-nums">
                      {formatKRW(totalAssets)}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {filteredAssets.length}개 항목
                    </p>
                  </div>
                  <Link
                    href="/assets/new"
                    className="rounded-lg bg-primary px-3 sm:px-4 py-2 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors self-start"
                  >
                    + 등록
                  </Link>
                </div>

                {members.length >= 2 && (
                  <div className="flex gap-1 mt-3">
                    {filterTabs.map((tab) => (
                      <button
                        key={tab.key}
                        onClick={() => setOwnerFilter(tab.key)}
                        className={`px-3 py-1.5 text-xs rounded-full transition-all duration-200 min-h-[36px] sm:min-h-0 ${
                          ownerFilter === tab.key
                            ? 'bg-primary text-primary-foreground font-medium'
                            : 'bg-muted/50 text-muted-foreground hover:bg-muted'
                        }`}
                      >
                        <span className="hidden sm:inline">{tab.label}</span>
                        <span className="sm:hidden">{tab.shortLabel}</span>
                      </button>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* 매수가 미입력 배너 */}
            {missingPurchasePriceStocks.length > 0 && (
              <Card className="border-amber-500/30">
                <CardContent className="py-3">
                  <p className="text-xs text-amber-500 font-medium">
                    매수가 미입력 주식 {missingPurchasePriceStocks.length}개 —
                    수익률 계산을 위해 매수가를 입력해주세요
                  </p>
                  <div className="mt-1 space-y-0.5">
                    {missingPurchasePriceStocks.slice(0, 5).map((a) => (
                      <Link
                        key={a.id}
                        href={`/assets/${a.id}/edit`}
                        className="block text-xs text-muted-foreground hover:text-foreground"
                      >
                        → {a.name}
                      </Link>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* 자산 목록 — 계좌유형별 그룹화 */}
            <Card>
              <CardContent className="pt-6">
                <AssetList
                  assets={filteredAssets}
                  exchangeRate={exchangeRate}
                  onMutate={refreshData}
                  groupBy="accountType"
                  accounts={accounts}
                />
              </CardContent>
            </Card>
          </>
        )}
      </main>
    </div>
  );
}
