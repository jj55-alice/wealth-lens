'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/components/ui/toast';
import { KbSearch } from '@/components/kb-search';
import type { Asset } from '@/types/database';

const CATEGORY_LABELS: Record<string, string> = {
  real_estate: '부동산',
  stock: '주식',
  pension: '연금',
  gold: '금',
  crypto: '코인',
  cash: '현금',
  other: '기타',
};

const BROKERAGES = [
  '키움증권', '현대차증권', '신한은행', '하나은행', '한국투자증권',
  '삼성증권', '미래에셋증권', 'NH투자증권', '업비트', '빗썸', '기타',
];

export default function EditAssetPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [asset, setAsset] = useState<Asset | null>(null);
  const { toast } = useToast();

  // Owner fields
  const [members, setMembers] = useState<Array<{ user_id: string; email: string; nickname: string | null; role: string }>>([]);
  const [ownerUserId, setOwnerUserId] = useState('');
  const [ownership, setOwnership] = useState<'personal' | 'shared'>('personal');

  // Editable fields
  const [name, setName] = useState('');
  const [manualValue, setManualValue] = useState('');
  const [quantity, setQuantity] = useState('');
  const [purchasePrice, setPurchasePrice] = useState('');
  const [brokerage, setBrokerage] = useState('');
  const [address, setAddress] = useState('');
  const [leaseExpiry, setLeaseExpiry] = useState('');
  const [kbComplexId, setKbComplexId] = useState<string | null>(null);
  const [showKbSearch, setShowKbSearch] = useState(false);
  const [accountAlias, setAccountAlias] = useState('');

  // 사용자 등록 계좌 (퀵픽) — 가구 전체를 한 번에 가져와서 owner로 필터
  const [allAccounts, setAllAccounts] = useState<{ id: string; brokerage: string; alias: string; user_id: string }[]>([]);
  useEffect(() => {
    fetch('/api/accounts?owner=all', { cache: 'no-store' })
      .then(r => r.json())
      .then(d => setAllAccounts(d.accounts ?? []))
      .catch(() => {});
  }, []);
  const userAccounts = allAccounts.filter(a => a.user_id === ownerUserId);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
        return;
      }

      const { data } = await supabase
        .from('assets')
        .select('*')
        .eq('id', id)
        .single();

      if (!data) {
        router.push('/dashboard');
        return;
      }

      setAsset(data as Asset);
      setName(data.name);
      setManualValue(data.manual_value ? String(data.manual_value) : '');
      setQuantity(data.quantity ? String(data.quantity) : '');
      setPurchasePrice(data.purchase_price ? String(data.purchase_price) : '');
      setBrokerage(data.brokerage ?? '');
      setAddress(data.address ?? '');
      setLeaseExpiry(data.lease_expiry ?? '');
      setKbComplexId(data.kb_complex_id ?? null);
      setAccountAlias(data.account_alias ?? '');
      setOwnerUserId(data.owner_user_id);
      setOwnership((data.ownership as 'personal' | 'shared') ?? 'personal');

      // Load household members
      try {
        const membersRes = await fetch('/api/invite');
        const membersData = await membersRes.json();
        if (Array.isArray(membersData.members)) setMembers(membersData.members);
      } catch (err) {
        console.error('멤버 목록 조회 실패:', err);
      }

      setLoading(false);
    }
    load();
  }, [id, router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!asset) return;

    // 입력 검증
    if (!name.trim()) {
      toast('이름을 입력해주세요', 'error');
      return;
    }

    setSaving(true);

    try {
      const supabase = createClient();
      const updates: Record<string, unknown> = { name: name.trim() };
      if (ownerUserId) updates.owner_user_id = ownerUserId;
      updates.ownership = ownership;

      switch (asset.category) {
        case 'real_estate':
          updates.manual_value = Number(manualValue) || 0;
          updates.address = address || null;
          updates.lease_expiry = leaseExpiry || null;
          updates.kb_complex_id = kbComplexId || null;
          break;
        case 'stock':
          updates.quantity = Number(quantity) || 0;
          updates.purchase_price = purchasePrice ? Number(purchasePrice) : null;
          updates.brokerage = brokerage || null;
          updates.account_alias = accountAlias || null;
          break;
        case 'pension':
        case 'cash':
          updates.manual_value = Number(manualValue) || 0;
          updates.brokerage = brokerage || null;
          break;
        case 'gold':
          updates.quantity = Number(quantity) || 0;
          updates.purchase_price = purchasePrice ? Number(purchasePrice) : null;
          updates.brokerage = brokerage || null;
          break;
        case 'crypto':
          updates.quantity = Number(quantity) || 0;
          updates.brokerage = brokerage || null;
          break;
      }

      const { error } = await supabase.from('assets').update(updates).eq('id', asset.id);
      if (error) throw error;
      toast('자산이 수정되었습니다', 'success');
      router.push('/dashboard');
      router.refresh();
    } catch {
      toast('수정에 실패했습니다', 'error');
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <header className="border-b border-border px-6 py-4">
          <div className="mx-auto max-w-lg">
            <Skeleton className="h-6 w-32" />
          </div>
        </header>
        <main className="mx-auto max-w-lg px-6 py-8 space-y-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </main>
      </div>
    );
  }

  if (!asset) return null;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border px-6 py-4">
        <div className="mx-auto max-w-lg flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => router.back()}>
            ←
          </Button>
          <h1 className="text-lg font-semibold">
            {CATEGORY_LABELS[asset.category] ?? '자산'} 수정
          </h1>
        </div>
      </header>

      <main className="mx-auto max-w-lg px-6 py-8">
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* 소유자 (구성원 2명일 때) */}
          {members.length > 1 && (
            <div className="space-y-3 rounded-lg border border-border p-3">
              <div className="space-y-1.5">
                <Label>소유자</Label>
                <div className="flex gap-2">
                  {members.map((m) => (
                    <button
                      key={m.user_id}
                      type="button"
                      onClick={() => setOwnerUserId(m.user_id)}
                      className={`flex-1 px-3 py-2 text-sm rounded-lg border transition-colors ${
                        ownerUserId === m.user_id
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'border-border text-muted-foreground hover:bg-muted/50'
                      }`}
                    >
                      {m.nickname || m.email.split('@')[0]}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>소유 형태</Label>
                <div className="flex gap-2">
                  {([['personal', '개인 소유'], ['shared', '공동 소유']] as const).map(([val, label]) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setOwnership(val)}
                      className={`flex-1 px-3 py-2 text-sm rounded-lg border transition-colors ${
                        ownership === val
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'border-border text-muted-foreground hover:bg-muted/50'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* 이름 (공통) */}
          <div className="space-y-1.5">
            <Label>이름</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              maxLength={100}
            />
          </div>

          {/* 부동산 */}
          {asset.category === 'real_estate' && (
            <>
              {/* KB 단지 연결 */}
              <div className="space-y-2 rounded-lg border border-border p-3">
                <div className="flex items-center justify-between">
                  <Label className="text-xs">KB 시세 연동</Label>
                  {kbComplexId ? (
                    <span className="text-xs text-emerald-500">연결됨 (ID: {kbComplexId})</span>
                  ) : (
                    <span className="text-xs text-muted-foreground">미연결</span>
                  )}
                </div>
                {!showKbSearch && !kbComplexId && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="w-full text-xs"
                    onClick={() => setShowKbSearch(true)}
                  >
                    KB 단지 검색으로 시세 연동하기
                  </Button>
                )}
                {!showKbSearch && kbComplexId && (
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="flex-1 text-xs"
                      onClick={() => setShowKbSearch(true)}
                    >
                      다른 단지로 변경
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="text-xs text-red-500"
                      onClick={() => { setKbComplexId(null); }}
                    >
                      연결 해제
                    </Button>
                  </div>
                )}
                {showKbSearch && (
                  <>
                    <KbSearch
                      realEstateType={asset.subcategory === 'jeonse' ? 'jeonse' : 'owned'}
                      onPriceFound={(price, complexId, complexName, addr) => {
                        setKbComplexId(complexId);
                        if (!name || name === asset.name) setName(complexName);
                        if (!address) setAddress(addr);
                        setShowKbSearch(false);
                      }}
                      onManualFallback={() => setShowKbSearch(false)}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-xs"
                      onClick={() => setShowKbSearch(false)}
                    >
                      취소
                    </Button>
                  </>
                )}
              </div>

              <Separator />

              <div className="space-y-1.5">
                <Label>주소</Label>
                <Input
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  maxLength={200}
                />
              </div>
              <div className="space-y-1.5">
                <Label>
                  {asset.subcategory === 'jeonse' ? '전세보증금' : '호가 (현재 시세)'}
                </Label>
                <Input
                  type="number"
                  value={manualValue}
                  onChange={(e) => setManualValue(e.target.value)}
                  required
                  min={0}
                />
              </div>
              {asset.subcategory === 'jeonse' && (
                <div className="space-y-1.5">
                  <Label>전세 만기일</Label>
                  <Input
                    type="date"
                    value={leaseExpiry}
                    onChange={(e) => setLeaseExpiry(e.target.value)}
                  />
                </div>
              )}
            </>
          )}

          {/* 주식 */}
          {asset.category === 'stock' && (
            <>
              <div className="space-y-1.5">
                <Label>종목</Label>
                <Input value={asset.ticker ?? ''} disabled className="bg-muted" />
                <p className="text-xs text-muted-foreground">종목은 변경할 수 없습니다</p>
              </div>
              {userAccounts.length > 0 && (
                <div className="space-y-1.5">
                  <Label>내 계좌 (빠른 선택)</Label>
                  <div className="flex flex-wrap gap-1.5">
                    {userAccounts.map((acc) => {
                      const isActive = brokerage === acc.brokerage && accountAlias === acc.alias;
                      return (
                        <button
                          key={acc.id}
                          type="button"
                          onClick={() => {
                            setBrokerage(acc.brokerage);
                            setAccountAlias(acc.alias);
                          }}
                          className={`px-3 py-1.5 text-xs rounded-md border transition-colors ${
                            isActive
                              ? 'border-primary bg-primary text-primary-foreground'
                              : 'border-border bg-muted/30 hover:bg-muted'
                          }`}
                        >
                          {acc.brokerage} · {acc.alias}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
              <div className="space-y-1.5">
                <Label>증권사</Label>
                <Select value={brokerage} onValueChange={(v) => v && setBrokerage(v)}>
                  <SelectTrigger><SelectValue placeholder="선택" /></SelectTrigger>
                  <SelectContent>
                    {BROKERAGES.map((b) => (
                      <SelectItem key={b} value={b}>{b}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>계좌 별칭 (선택)</Label>
                <Input
                  placeholder="예: 메인, ISA"
                  value={accountAlias}
                  onChange={(e) => setAccountAlias(e.target.value)}
                  maxLength={50}
                />
              </div>
              <div className="space-y-1.5">
                <Label>매수 단가 (원)</Label>
                <Input
                  type="number"
                  value={purchasePrice}
                  onChange={(e) => setPurchasePrice(e.target.value)}
                  min={0}
                  step="any"
                />
              </div>
              <div className="space-y-1.5">
                <Label>수량 (주)</Label>
                <Input
                  type="number"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  required
                  min={0}
                  step="any"
                />
              </div>
            </>
          )}

          {/* 연금/현금 */}
          {(asset.category === 'pension' || asset.category === 'cash') && (
            <>
              <div className="space-y-1.5">
                <Label>증권사/은행</Label>
                <Select value={brokerage} onValueChange={(v) => v && setBrokerage(v)}>
                  <SelectTrigger><SelectValue placeholder="선택" /></SelectTrigger>
                  <SelectContent>
                    {BROKERAGES.map((b) => (
                      <SelectItem key={b} value={b}>{b}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>금액 (원)</Label>
                <Input
                  type="number"
                  value={manualValue}
                  onChange={(e) => setManualValue(e.target.value)}
                  required
                  min={0}
                />
              </div>
            </>
          )}

          {/* 금 */}
          {asset.category === 'gold' && (
            <>
              <div className="space-y-1.5">
                <Label>보유량 (그램)</Label>
                <Input
                  type="number"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  required
                  min={0}
                  step="any"
                />
              </div>
              <div className="space-y-1.5">
                <Label>평균 매입가 (원/g)</Label>
                <Input
                  type="number"
                  placeholder="예: 95000"
                  value={purchasePrice}
                  onChange={(e) => setPurchasePrice(e.target.value)}
                  min={0}
                  step="any"
                />
                <p className="text-xs text-muted-foreground">
                  현재 금 시세와 비교하여 수익률을 계산합니다
                </p>
              </div>
              <div className="space-y-1.5">
                <Label>보관처</Label>
                <Input
                  value={brokerage}
                  onChange={(e) => setBrokerage(e.target.value)}
                  maxLength={50}
                />
              </div>
            </>
          )}

          {/* 코인 */}
          {asset.category === 'crypto' && (
            <>
              <div className="space-y-1.5">
                <Label>종목</Label>
                <Input value={asset.ticker ?? ''} disabled className="bg-muted" />
                <p className="text-xs text-muted-foreground">종목은 변경할 수 없습니다</p>
              </div>
              <div className="space-y-1.5">
                <Label>수량</Label>
                <Input
                  type="number"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  required
                  min={0}
                  step="any"
                />
              </div>
              <div className="space-y-1.5">
                <Label>거래소</Label>
                <Select value={brokerage} onValueChange={(v) => v && setBrokerage(v)}>
                  <SelectTrigger><SelectValue placeholder="선택" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="업비트">업비트</SelectItem>
                    <SelectItem value="빗썸">빗썸</SelectItem>
                    <SelectItem value="바이낸스">바이낸스</SelectItem>
                    <SelectItem value="기타">기타</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </>
          )}

          <div className="flex gap-3 pt-2">
            <Button type="button" variant="outline" className="flex-1" onClick={() => router.back()}>
              취소
            </Button>
            <Button type="submit" className="flex-1" disabled={saving}>
              {saving ? '저장 중...' : '저장'}
            </Button>
          </div>
        </form>
      </main>
    </div>
  );
}
