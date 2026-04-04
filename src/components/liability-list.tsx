'use client';

import { useState } from 'react';
import { formatKRW } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { createClient } from '@/lib/supabase/client';
import type { Liability } from '@/types/database';

interface Props {
  liabilities: Liability[];
}

export function LiabilityList({ liabilities }: Props) {
  const [deleteTarget, setDeleteTarget] = useState<Liability | null>(null);
  const [editTarget, setEditTarget] = useState<Liability | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [saving, setSaving] = useState(false);

  // Edit form state
  const [editName, setEditName] = useState('');
  const [editBalance, setEditBalance] = useState('');
  const [editRate, setEditRate] = useState('');

  function openEdit(liability: Liability) {
    setEditTarget(liability);
    setEditName(liability.name);
    setEditBalance(String(liability.balance));
    setEditRate(liability.interest_rate ? String(liability.interest_rate) : '');
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const supabase = createClient();
      await supabase.from('liabilities').delete().eq('id', deleteTarget.id);
      setDeleteTarget(null);
      window.location.reload();
    } catch (err) {
      console.error('Delete error:', err);
      setDeleting(false);
    }
  }

  async function handleSaveEdit() {
    if (!editTarget) return;
    setSaving(true);
    try {
      const supabase = createClient();
      await supabase
        .from('liabilities')
        .update({
          name: editName,
          balance: Number(editBalance) || 0,
          interest_rate: editRate ? Number(editRate) : null,
        })
        .eq('id', editTarget.id);
      setEditTarget(null);
      window.location.reload();
    } catch (err) {
      console.error('Update error:', err);
      setSaving(false);
    }
  }

  return (
    <>
      <div className="space-y-1">
        {liabilities.map((liability) => (
          <div
            key={liability.id}
            className="group flex items-center justify-between py-2 px-3 rounded-lg hover:bg-muted/50 transition-colors"
          >
            <div>
              <p className="text-sm font-medium">{liability.name}</p>
              <div className="flex items-center gap-2 mt-0.5">
                {liability.interest_rate && (
                  <span className="text-xs text-muted-foreground">
                    금리 {liability.interest_rate}%
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="hidden group-hover:flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs px-2"
                  onClick={() => openEdit(liability)}
                >
                  수정
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs px-2 text-red-500 hover:text-red-600"
                  onClick={() => setDeleteTarget(liability)}
                >
                  삭제
                </Button>
              </div>
              <p className="text-sm font-medium tabular-nums text-red-500">
                -{formatKRW(liability.balance)}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* 삭제 확인 */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>부채 삭제</DialogTitle>
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

      {/* 수정 다이얼로그 */}
      <Dialog open={!!editTarget} onOpenChange={(open) => !open && setEditTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>부채 수정</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>이름</Label>
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                maxLength={100}
              />
            </div>
            <div className="space-y-1.5">
              <Label>잔액 (원)</Label>
              <Input
                type="number"
                value={editBalance}
                onChange={(e) => setEditBalance(e.target.value)}
                min={0}
              />
            </div>
            <div className="space-y-1.5">
              <Label>금리 (%)</Label>
              <Input
                type="number"
                value={editRate}
                onChange={(e) => setEditRate(e.target.value)}
                min={0}
                step="0.01"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditTarget(null)} disabled={saving}>
              취소
            </Button>
            <Button onClick={handleSaveEdit} disabled={saving}>
              {saving ? '저장 중...' : '저장'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
