'use client';

import { useState } from 'react';
import { useToast } from '@/components/ui/toast';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { formatKRW, formatUsdKrw } from '@/lib/format';
import { createClient } from '@/lib/supabase/client';
import type { AssetWithPrice, AssetCategory } from '@/types/database';

const CATEGORY_LABELS: Record<AssetCategory, string> = {
  real_estate: '부동산',
  stock: '주식',
  pension: '연금',
  gold: '금',
  crypto: '코인',
  cash: '현금',
  other: '기타',
};

const CATEGORY_ORDER: AssetCategory[] = [
  'real_estate',
  'stock',
  'pension',
  'gold',
  'crypto',
  'cash',
  'other',
];

interface Props {
  assets: AssetWithPrice[];
  exchangeRate?: number | null;
  onMutate?: () => Promise<void>;
}

export function AssetList({ assets, exchangeRate, onMutate }: Props) {
  const [deleteTarget, setDeleteTarget] = useState<AssetWithPrice | null>(null);
  const [deleting, setDeleting] = useState(false);
  const { toast } = useToast();

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.from('assets').delete().eq('id', deleteTarget.id);
      if (error) throw error;
      setDeleteTarget(null);
      toast('자산이 삭제되었습니다', 'success');
      if (onMutate) await onMutate();
    } catch {
      toast('삭제에 실패했습니다', 'error');
    } finally {
      setDeleting(false);
    }
  }

  const grouped = new Map<AssetCategory, AssetWithPrice[]>();
  for (const a of assets) {
    const list = grouped.get(a.category) ?? [];
    list.push(a);
    grouped.set(a.category, list);
  }

  // 주식 카테고리는 금융사 + 계좌별칭으로 sub-group, 그룹/항목 모두 가나다순 정렬
  function groupStocksByAccount(items: AssetWithPrice[]) {
    const subMap = new Map<string, AssetWithPrice[]>();
    for (const a of items) {
      const broker = a.brokerage ?? '미지정';
      const alias = a.account_alias ?? '';
      const key = alias ? `${broker} · ${alias}` : broker;
      const list = subMap.get(key) ?? [];
      list.push(a);
      subMap.set(key, list);
    }
    return Array.from(subMap.entries())
      .map(([key, items]) => ({
        key,
        items: items.slice().sort((a, b) => a.name.localeCompare(b.name, 'ko')),
        total: items.reduce((s, a) => s + a.current_value, 0),
      }))
      .sort((a, b) => a.key.localeCompare(b.key, 'ko'));
  }

  function renderRow(asset: AssetWithPrice) {
    return (
      <div
        key={asset.id}
        className="group flex items-center justify-between py-2 px-3 rounded-lg hover:bg-muted/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div>
            <p className="text-sm font-medium">{asset.name}</p>
            <div className="flex items-center gap-2 mt-0.5">
              {asset.ownership === 'shared' && (
                <Badge variant="outline" className="text-[10px] px-1">공동</Badge>
              )}
              {asset.brokerage && asset.category !== 'stock' && (
                <span className="text-xs text-muted-foreground">{asset.brokerage}</span>
              )}
              {asset.quantity && asset.current_price && (
                <span className="text-xs text-muted-foreground">
                  {asset.quantity}주 x{' '}
                  {asset.price_source === 'yahoo_finance' && exchangeRate
                    ? `$${(asset.current_price / exchangeRate).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                    : asset.current_price.toLocaleString()}
                </span>
              )}
              {asset.is_stale && (
                <Badge variant="outline" className="text-[10px] px-1">지연</Badge>
              )}
              {asset.kb_estimated_value && !asset.manual_value && (
                <Badge variant="outline" className="text-[10px] px-1 text-blue-500">KB 추정가</Badge>
              )}
              {asset.lease_expiry && (
                <Badge variant="outline" className="text-[10px] px-1">만기 {asset.lease_expiry}</Badge>
              )}
              {asset.category === 'real_estate' && asset.updated_at && (
                <span className="text-[10px] text-muted-foreground">
                  {(() => {
                    const days = Math.floor((Date.now() - new Date(asset.updated_at).getTime()) / (1000 * 60 * 60 * 24));
                    if (days === 0) return '오늘 업데이트';
                    if (days <= 7) return `${days}일 전 업데이트`;
                    if (days <= 30) return `${Math.floor(days / 7)}주 전 업데이트`;
                    return `${Math.floor(days / 30)}개월 전`;
                  })()}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex sm:opacity-0 sm:group-hover:opacity-100 transition-opacity items-center gap-1">
            <Link href={`/assets/${asset.id}/edit`}>
              <Button variant="ghost" size="sm" className="h-7 text-xs px-2">수정</Button>
            </Link>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs px-2 text-red-500 hover:text-red-600"
              onClick={() => setDeleteTarget(asset)}
            >
              삭제
            </Button>
          </div>
          <div className="text-right">
            <p className="text-sm font-medium tabular-nums">
              {asset.price_source === 'yahoo_finance' && exchangeRate
                ? formatUsdKrw(asset.current_value, exchangeRate)
                : formatKRW(asset.current_value)}
            </p>
            {(() => {
              const pp = asset.purchase_price;
              if (!pp || pp <= 0) return null;
              const currentVal = asset.current_value;
              const returnRate = ((currentVal - pp * (asset.quantity ?? 1)) / (pp * (asset.quantity ?? 1))) * 100;
              const realReturn = asset.category === 'real_estate' && asset.manual_value
                ? ((Number(asset.manual_value) - pp) / pp) * 100
                : returnRate;
              return (
                <p className={`text-[10px] ${realReturn >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                  {realReturn >= 0 ? '+' : ''}{realReturn.toFixed(1)}%
                </p>
              );
            })()}
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-4">
        {CATEGORY_ORDER.filter((cat) => grouped.has(cat)).map((cat) => {
          const items = grouped.get(cat)!;
          const categoryTotal = items.reduce((s, a) => s + a.current_value, 0);
          const stockGroups = cat === 'stock' ? groupStocksByAccount(items) : null;

          return (
            <div key={cat}>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  {CATEGORY_LABELS[cat]}
                </h3>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {formatKRW(categoryTotal)}
                </span>
              </div>
              {stockGroups ? (
                <div className="space-y-3">
                  {stockGroups.map((group) => (
                    <div key={group.key}>
                      <div className="flex items-center justify-between mb-1 px-3">
                        <span className="text-xs font-medium text-muted-foreground">
                          {group.key}
                        </span>
                        <span className="text-xs text-muted-foreground tabular-nums">
                          {formatKRW(group.total)}
                        </span>
                      </div>
                      <div className="space-y-1">
                        {group.items.map(renderRow)}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-1">
                  {items.map(renderRow)}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* 삭제 확인 다이얼로그 */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>자산 삭제</DialogTitle>
            <DialogDescription>
              &quot;{deleteTarget?.name}&quot;을(를) 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={deleting}>
              취소
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? '삭제 중...' : '삭제'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
