'use client';

import { useState } from 'react';
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
}

export function AssetList({ assets, exchangeRate }: Props) {
  const [deleteTarget, setDeleteTarget] = useState<AssetWithPrice | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const supabase = createClient();
      await supabase.from('assets').delete().eq('id', deleteTarget.id);
      setDeleteTarget(null);
      window.location.reload();
    } catch (err) {
      console.error('Delete error:', err);
      setDeleting(false);
    }
  }

  const grouped = new Map<AssetCategory, AssetWithPrice[]>();
  for (const a of assets) {
    const list = grouped.get(a.category) ?? [];
    list.push(a);
    grouped.set(a.category, list);
  }

  return (
    <>
      <div className="space-y-4">
        {CATEGORY_ORDER.filter((cat) => grouped.has(cat)).map((cat) => {
          const items = grouped.get(cat)!;
          const categoryTotal = items.reduce((s, a) => s + a.current_value, 0);

          return (
            <div key={cat}>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  {CATEGORY_LABELS[cat]}
                </h3>
                <span className="text-xs text-muted-foreground">
                  {formatKRW(categoryTotal)}
                </span>
              </div>
              <div className="space-y-1">
                {items.map((asset) => (
                  <div
                    key={asset.id}
                    className="group flex items-center justify-between py-2 px-3 rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div>
                        <p className="text-sm font-medium">{asset.name}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          {asset.brokerage && (
                            <span className="text-xs text-muted-foreground">
                              {asset.brokerage}
                            </span>
                          )}
                          {asset.quantity && asset.current_price && (
                            <span className="text-xs text-muted-foreground">
                              {asset.quantity}주 x{' '}
                              {asset.price_source === 'yahoo_finance' && exchangeRate
                                ? `$${(asset.current_price / exchangeRate).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                                : asset.current_price.toLocaleString()
                              }
                            </span>
                          )}
                          {asset.is_stale && (
                            <Badge variant="outline" className="text-[10px] px-1">
                              지연
                            </Badge>
                          )}
                          {asset.lease_expiry && (
                            <Badge variant="outline" className="text-[10px] px-1">
                              만기 {asset.lease_expiry}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="hidden group-hover:flex items-center gap-1">
                        <Link href={`/assets/${asset.id}/edit`}>
                          <Button variant="ghost" size="sm" className="h-7 text-xs px-2">
                            수정
                          </Button>
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
                            : formatKRW(asset.current_value)
                          }
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
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
