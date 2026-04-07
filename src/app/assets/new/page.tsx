'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { classifyAsset } from '@/lib/classification';
import { StockSearch } from '@/components/stock-search';
import { CryptoSearch } from '@/components/crypto-search';
import type { StockSearchResult } from '@/app/api/search/route';
import type { CryptoMarket } from '@/app/api/crypto-markets/route';
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
import { useToast } from '@/components/ui/toast';
import { Separator } from '@/components/ui/separator';
import type { AssetCategory, LiabilityCategory } from '@/types/database';

type EntryType = AssetCategory | 'liability';

const ENTRY_TYPES: { value: EntryType; label: string; icon: string }[] = [
  { value: 'real_estate', label: '부동산', icon: '🏠' },
  { value: 'stock', label: '주식', icon: '📈' },
  { value: 'gold', label: '금', icon: '🥇' },
  { value: 'crypto', label: '코인', icon: '₿' },
  { value: 'cash', label: '현금', icon: '💰' },
  { value: 'liability', label: '부채', icon: '📋' },
];

const BROKERAGES = [
  '키움증권', '현대차증권', '신한은행', '하나은행', '한국투자증권',
  '삼성증권', '미래에셋증권', 'NH투자증권', '업비트', '빗썸', '기타',
];

const STOCK_ACCOUNT_TYPES = [
  { value: 'pension', label: '연금저축' },
  { value: 'isa', label: 'ISA' },
  { value: 'irp', label: 'IRP' },
  { value: 'espp', label: '우리사주' },
  { value: 'other', label: '일반' },
];

const REAL_ESTATE_TYPES = [
  { value: 'owned', label: '소유 (매매)' },
  { value: 'jeonse', label: '전세' },
];

const LIABILITY_TYPES: { value: LiabilityCategory; label: string }[] = [
  { value: 'mortgage', label: '주택담보대출' },
  { value: 'credit', label: '신용대출' },
  { value: 'student', label: '학자금대출' },
  { value: 'deposit', label: '임대보증금 (전세)' },
  { value: 'other', label: '기타 대출' },
];

interface HouseholdMember {
  user_id: string;
  email: string;
  nickname: string | null;
  role: string;
}

export default function NewAssetPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [entryType, setEntryType] = useState<EntryType | ''>('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [members, setMembers] = useState<HouseholdMember[]>([]);
  const [ownerUserId, setOwnerUserId] = useState('');
  const [ownership, setOwnership] = useState<'personal' | 'shared'>('personal');

  // Load household members
  useEffect(() => {
    async function loadMembers() {
      try {
        const res = await fetch('/api/invite');
        const data = await res.json();
        if (Array.isArray(data.members)) {
          setMembers(data.members);
          // 본인을 기본 소유자로 설정
          const supabase = createClient();
          const { data: { user } } = await supabase.auth.getUser();
          if (user) setOwnerUserId(user.id);
        }
      } catch {
        // ignore
      }
    }
    loadMembers();
  }, []);

  // Common fields
  const [name, setName] = useState('');
  const [brokerage, setBrokerage] = useState('');

  // Stock fields
  const [ticker, setTicker] = useState('');
  const [stockName, setStockName] = useState('');
  const [stockPriceSource, setStockPriceSource] = useState<'krx' | 'yahoo_finance'>('krx');
  const [purchasePrice, setPurchasePrice] = useState('');
  const [purchaseCurrency, setPurchaseCurrency] = useState<'KRW' | 'USD'>('KRW');
  const [quantity, setQuantity] = useState('');
  const [accountType, setAccountType] = useState('other');
  const [accountAlias, setAccountAlias] = useState('');

  // 사용자 등록 계좌 (퀵픽)
  const [userAccounts, setUserAccounts] = useState<{ id: string; brokerage: string; alias: string }[]>([]);
  useEffect(() => {
    fetch('/api/accounts')
      .then(r => r.json())
      .then(d => setUserAccounts(d.accounts ?? []))
      .catch(() => {});
  }, []);

  // Real estate fields
  const [realEstateType, setRealEstateType] = useState('owned');
  const [address, setAddress] = useState('');
  const [manualValue, setManualValue] = useState('');
  const [leaseExpiry, setLeaseExpiry] = useState('');
  const [kbComplexId, setKbComplexId] = useState('');
  const [useManualPrice, setUseManualPrice] = useState(false);
  const [hasJeonseTenant, setHasJeonseTenant] = useState(false);
  const [jeonseDeposit, setJeonseDeposit] = useState('');

  // Cash/pension fields
  const [amount, setAmount] = useState('');

  // Gold fields
  const [grams, setGrams] = useState('');

  // Crypto fields
  const [cryptoTicker, setCryptoTicker] = useState('');
  const [cryptoQuantity, setCryptoQuantity] = useState('');

  // Liability fields
  const [liabilityType, setLiabilityType] = useState<LiabilityCategory>('mortgage');
  const [balance, setBalance] = useState('');
  const [interestRate, setInterestRate] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('로그인이 필요합니다');

      // Get user's household
      const { data: membership } = await supabase
        .from('household_members')
        .select('household_id')
        .eq('user_id', user.id)
        .single();
      if (!membership) throw new Error('가구를 찾을 수 없습니다');

      const householdId = membership.household_id;

      if (entryType === 'liability') {
        await supabase.from('liabilities').insert({
          household_id: householdId,
          owner_user_id: ownerUserId || user.id,
          ownership,
          category: liabilityType,
          name,
          balance: Number(balance) || 0,
          interest_rate: interestRate ? Number(interestRate) : null,
        });
      } else {
        const assetData: Record<string, unknown> = {
          household_id: householdId,
          owner_user_id: ownerUserId || user.id,
          ownership,
          category: entryType,
        };

        switch (entryType) {
          case 'real_estate':
            assetData.name = name;
            assetData.subcategory = realEstateType;
            assetData.address = address || null;
            assetData.manual_value = Number(manualValue) || 0;
            if (purchasePrice) assetData.purchase_price = Number(purchasePrice);
            assetData.price_source = 'manual';
            assetData.asset_class = 'real_estate';
            assetData.lease_expiry = leaseExpiry || null;
            break;
          case 'stock': {
            assetData.name = stockName || ticker;
            assetData.ticker = ticker;
            assetData.quantity = Number(quantity) || 0;
            if (purchasePrice) {
              let pp = Number(purchasePrice);
              // 달러 입력이면 실시간 환율로 변환
              if (purchaseCurrency === 'USD' && stockPriceSource === 'yahoo_finance') {
                try {
                  const rateRes = await fetch('/api/exchange-rate');
                  const rateData = await rateRes.json();
                  if (rateData.rate) pp = Math.round(pp * rateData.rate);
                } catch {
                  pp = Math.round(pp * 1400); // 폴백
                }
              }
              assetData.purchase_price = pp;
            }
            assetData.subcategory = accountType;
            assetData.brokerage = brokerage || null;
            assetData.account_alias = accountAlias || null;
            assetData.price_source = stockPriceSource;
            assetData.asset_class = classifyAsset(stockName || ticker, 'stock', ticker);
            break;
          }
          case 'gold':
            assetData.name = '금 현물';
            assetData.ticker = 'GOLD';
            assetData.quantity = Number(grams) || 0;
            if (purchasePrice) assetData.purchase_price = Number(purchasePrice);
            assetData.brokerage = brokerage || null;
            assetData.price_source = 'gold_exchange';
            assetData.asset_class = 'commodity';
            break;
          case 'crypto':
            assetData.name = cryptoTicker.toUpperCase();
            assetData.ticker = cryptoTicker.toUpperCase();
            assetData.quantity = Number(cryptoQuantity) || 0;
            assetData.brokerage = brokerage || null;
            assetData.price_source = 'upbit';
            assetData.asset_class = 'crypto';
            break;
          case 'cash':
            assetData.name = name;
            assetData.manual_value = Number(amount) || 0;
            assetData.brokerage = brokerage || null;
            assetData.price_source = 'manual';
            assetData.asset_class = 'cash_equiv';
            break;
        }

        // 같은 종목이 이미 있으면 합치기 (수량 합산 + 평균 매수가)
        let insertedAsset: { id: string } | null = null;
        const assetTicker = assetData.ticker as string | undefined;

        if (assetTicker && (entryType === 'stock' || entryType === 'crypto')) {
          let existingQuery = supabase
            .from('assets')
            .select('id, quantity, purchase_price')
            .eq('household_id', householdId)
            .eq('ticker', assetTicker)
            .eq('category', entryType)
            .eq('owner_user_id', ownerUserId || user.id);
          if (assetData.brokerage) {
            existingQuery = existingQuery.eq('brokerage', assetData.brokerage);
          }
          const { data: existing } = await existingQuery.maybeSingle();

          if (existing) {
            const oldQty = Number(existing.quantity) || 0;
            const newQty = Number(assetData.quantity) || 0;
            const totalQty = oldQty + newQty;

            // 가중평균 매수가 계산
            const oldPP = Number(existing.purchase_price) || 0;
            const newPP = Number(assetData.purchase_price) || 0;
            let avgPP: number | null = null;
            if (oldPP > 0 && newPP > 0) {
              avgPP = Math.round((oldPP * oldQty + newPP * newQty) / totalQty);
            } else if (newPP > 0) {
              avgPP = newPP;
            } else if (oldPP > 0) {
              avgPP = oldPP;
            }

            const updates: Record<string, unknown> = { quantity: totalQty };
            if (avgPP !== null) updates.purchase_price = avgPP;
            if (assetData.brokerage) updates.brokerage = assetData.brokerage;

            const { error: updateError } = await supabase
              .from('assets')
              .update(updates)
              .eq('id', existing.id);

            if (updateError) throw new Error(updateError.message);
            insertedAsset = { id: existing.id };
          }
        }

        // 기존 종목이 없으면 새로 등록
        if (!insertedAsset) {
          const { data: newAsset, error: insertError } = await supabase
            .from('assets')
            .insert(assetData)
            .select('id')
            .single();

          if (insertError) {
            throw new Error(insertError.message);
          }
          insertedAsset = newAsset;
        }

        // 전세보증금 부채 자동 생성
        if (entryType === 'real_estate' && hasJeonseTenant && jeonseDeposit && insertedAsset) {
          // deposit 카테고리가 DB에 없을 수 있으므로 other로 폴백
          const depositInsert = await supabase.from('liabilities').insert({
            household_id: householdId,
            owner_user_id: user.id,
            category: 'deposit',
            name: `전세보증금 (${name})`,
            balance: Number(jeonseDeposit) || 0,
            linked_asset_id: insertedAsset.id,
          });
          if (depositInsert.error) {
            // deposit 카테고리 미지원 시 other로 재시도
            await supabase.from('liabilities').insert({
              household_id: householdId,
              owner_user_id: user.id,
              category: 'other',
              name: `전세보증금 (${name})`,
              balance: Number(jeonseDeposit) || 0,
              linked_asset_id: insertedAsset.id,
            });
          }
        }
      }

      // 주식/코인 등록 후 시세 갱신 (대시보드에서 바로 평가액이 보이도록)
      if (entryType === 'stock' || entryType === 'crypto') {
        try {
          await fetch('/api/prices', { method: 'POST' });
        } catch {
          // 시세 갱신 실패해도 등록은 완료
        }
      }

      toast('자산이 등록되었습니다', 'success');
      router.push('/dashboard');
      router.refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : '저장에 실패했습니다';
      toast(message, 'error');
      setError(message);
      setSaving(false);
    }
  }

  const PRESETS = [
    { label: '적금', icon: '🏦', category: 'cash' as EntryType, defaults: { name: '적금', brokerage: '', subcategory: 'savings' } },
    { label: 'CMA', icon: '💳', category: 'cash' as EntryType, defaults: { name: 'CMA', brokerage: '', subcategory: 'cma' } },
    { label: '예금', icon: '🏦', category: 'cash' as EntryType, defaults: { name: '예금', brokerage: '', subcategory: 'savings' } },
    { label: '비상금', icon: '💰', category: 'cash' as EntryType, defaults: { name: '비상금', brokerage: '', subcategory: 'other' } },
    { label: '월세보증금', icon: '🏠', category: 'real_estate' as EntryType, defaults: { name: '월세 보증금', realEstateType: 'jeonse' } },
    { label: '전세', icon: '🏠', category: 'real_estate' as EntryType, defaults: { name: '전세', realEstateType: 'jeonse' } },
  ];

  function applyPreset(preset: typeof PRESETS[number]) {
    setEntryType(preset.category);
    setName(preset.defaults.name);
    if ('brokerage' in preset.defaults && preset.defaults.brokerage) {
      setBrokerage(preset.defaults.brokerage);
    }
    if ('realEstateType' in preset.defaults && preset.defaults.realEstateType) {
      setRealEstateType(preset.defaults.realEstateType);
    }
  }

  if (!entryType) {
    return (
      <div className="min-h-screen bg-background">
        <header className="border-b border-border px-6 py-4">
          <div className="mx-auto max-w-lg flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={() => router.back()}>
              ←
            </Button>
            <h1 className="text-lg font-semibold">자산 등록</h1>
          </div>
        </header>
        <main className="mx-auto max-w-lg px-6 py-8">
          {/* Quick Presets */}
          <div className="mb-6">
            <p className="text-sm font-medium mb-3">빠른 등록</p>
            <div className="flex flex-wrap gap-2">
              {PRESETS.map((preset) => (
                <button
                  key={preset.label}
                  onClick={() => applyPreset(preset)}
                  className="flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs hover:bg-muted/50 transition-colors"
                >
                  <span>{preset.icon}</span>
                  <span>{preset.label}</span>
                </button>
              ))}
            </div>
          </div>

          <Separator className="mb-6" />

          <p className="text-sm text-muted-foreground mb-4">
            직접 선택하기
          </p>
          <div className="grid grid-cols-2 gap-3">
            {ENTRY_TYPES.map((type) => (
              <button
                key={type.value}
                onClick={() => setEntryType(type.value)}
                className="flex items-center gap-3 rounded-lg border border-border p-4 text-left hover:bg-muted/50 transition-colors"
              >
                <span className="text-2xl">{type.icon}</span>
                <span className="text-sm font-medium">{type.label}</span>
              </button>
            ))}
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border px-6 py-4">
        <div className="mx-auto max-w-lg flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => setEntryType('')}>
            ←
          </Button>
          <h1 className="text-lg font-semibold">
            {ENTRY_TYPES.find((t) => t.value === entryType)?.icon}{' '}
            {ENTRY_TYPES.find((t) => t.value === entryType)?.label} 등록
          </h1>
        </div>
      </header>

      <main className="mx-auto max-w-lg px-6 py-8">
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* 소유자 선택 (구성원이 2명일 때만 표시) */}
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

          {/* 부동산 */}
          {entryType === 'real_estate' && (
            <>
              <div className="space-y-1.5">
                <Label>유형</Label>
                <Select value={realEstateType} onValueChange={(v) => v && setRealEstateType(v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {REAL_ESTATE_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>이름</Label>
                <Input
                  placeholder="예: 래미안 블레스티지, 반포자이"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  maxLength={100}
                />
                {!name && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {['래미안', '자이', '힐스테이트', '푸르지오', 'e편한세상', '롯데캐슬', '아이파크'].map((apt) => (
                      <button
                        key={apt}
                        type="button"
                        onClick={() => setName(apt)}
                        className="px-2 py-0.5 text-xs rounded-full border border-border text-muted-foreground hover:bg-muted/50"
                      >
                        {apt}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="space-y-1.5">
                <Label>주소</Label>
                <Input
                  placeholder="서울시 강남구..."
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  maxLength={200}
                />
              </div>
              {realEstateType === 'owned' && (
                <div className="space-y-1.5">
                  <Label>매수가 (원)</Label>
                  <Input
                    type="number"
                    placeholder="실제 매수 금액"
                    value={purchasePrice}
                    onChange={(e) => setPurchasePrice(e.target.value)}
                    min={0}
                  />
                  <p className="text-xs text-muted-foreground">
                    현재 시세와의 차이(수익률)를 계산합니다
                  </p>
                </div>
              )}
              <div className="space-y-1.5">
                <Label>
                  {realEstateType === 'jeonse' ? '전세보증금 (원)' : '현재 시세 (원)'}
                </Label>
                <Input
                  type="number"
                  placeholder="0"
                  value={manualValue}
                  onChange={(e) => setManualValue(e.target.value)}
                  required
                  min={0}
                />
                <div className="flex gap-2 mt-1">
                  <a
                    href="https://kbland.kr"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-primary hover:underline"
                  >
                    KB시세 확인 →
                  </a>
                  <a
                    href="https://hogangnono.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-primary hover:underline"
                  >
                    호갱노노 →
                  </a>
                  <a
                    href="https://new.land.naver.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-primary hover:underline"
                  >
                    네이버 부동산 →
                  </a>
                </div>
                {purchasePrice && manualValue && Number(purchasePrice) > 0 && (
                  <div className="rounded-lg bg-muted/30 border border-border px-3 py-2 mt-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">매수가 대비</span>
                      <span className={Number(manualValue) >= Number(purchasePrice) ? 'text-emerald-500 font-semibold' : 'text-red-500 font-semibold'}>
                        {Number(manualValue) >= Number(purchasePrice) ? '+' : ''}
                        {(((Number(manualValue) - Number(purchasePrice)) / Number(purchasePrice)) * 100).toFixed(1)}%
                        {' '}
                        ({Number(manualValue) >= Number(purchasePrice) ? '+' : ''}
                        {((Number(manualValue) - Number(purchasePrice)) / 10000).toLocaleString('ko-KR')}만원)
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {realEstateType === 'jeonse' && (
                <div className="space-y-1.5">
                  <Label>전세 만기일</Label>
                  <Input
                    type="date"
                    value={leaseExpiry}
                    onChange={(e) => setLeaseExpiry(e.target.value)}
                  />
                </div>
              )}

              {/* 전세 놓음 (소유 매매만) */}
              {realEstateType === 'owned' && (
                <div className="space-y-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={hasJeonseTenant}
                      onChange={(e) => setHasJeonseTenant(e.target.checked)}
                      className="rounded border-border"
                    />
                    <span className="text-sm">전세 놓은 부동산 (전세보증금을 부채로 추가)</span>
                  </label>
                  {hasJeonseTenant && (
                    <div className="space-y-1.5 pl-6">
                      <Label>받은 전세보증금 (원)</Label>
                      <Input
                        type="number"
                        placeholder="0"
                        value={jeonseDeposit}
                        onChange={(e) => setJeonseDeposit(e.target.value)}
                        required
                        min={0}
                      />
                      <p className="text-xs text-muted-foreground">
                        부채에 자동 등록되며 해당 부동산과 연결됩니다
                      </p>
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {/* 주식 */}
          {entryType === 'stock' && (
            <>
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
                          className={`px-3 py-1.5 text-xs rounded-full border transition-colors ${
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
                  <p className="text-[10px] text-muted-foreground">
                    설정 → 주식 계좌 관리에서 등록할 수 있어요
                  </p>
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
                <Label>계좌 유형</Label>
                <Select value={accountType} onValueChange={(v) => v && setAccountType(v)}>
                  <SelectTrigger><SelectValue placeholder="일반" /></SelectTrigger>
                  <SelectContent>
                    {STOCK_ACCOUNT_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>종목 검색</Label>
                <StockSearch
                  onSelect={(result: StockSearchResult) => {
                    setTicker(result.ticker);
                    setStockName(result.name);
                    setStockPriceSource(result.priceSource);
                    setPurchaseCurrency(result.priceSource === 'yahoo_finance' ? 'USD' : 'KRW');
                  }}
                />
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label>매수 단가</Label>
                  {stockPriceSource === 'yahoo_finance' && (
                    <div className="flex gap-1">
                      <button
                        type="button"
                        onClick={() => setPurchaseCurrency('USD')}
                        className={`px-2 py-0.5 text-xs rounded border transition-colors ${
                          purchaseCurrency === 'USD'
                            ? 'bg-primary text-primary-foreground border-primary'
                            : 'border-border text-muted-foreground hover:bg-muted/50'
                        }`}
                      >
                        $ 달러
                      </button>
                      <button
                        type="button"
                        onClick={() => setPurchaseCurrency('KRW')}
                        className={`px-2 py-0.5 text-xs rounded border transition-colors ${
                          purchaseCurrency === 'KRW'
                            ? 'bg-primary text-primary-foreground border-primary'
                            : 'border-border text-muted-foreground hover:bg-muted/50'
                        }`}
                      >
                        ₩ 원화
                      </button>
                    </div>
                  )}
                </div>
                <Input
                  type="number"
                  placeholder={purchaseCurrency === 'USD' ? '예: 198.50' : '매수 시 단가를 입력하세요'}
                  value={purchasePrice}
                  onChange={(e) => setPurchasePrice(e.target.value)}
                  min={0}
                  step="any"
                />
                <p className="text-xs text-muted-foreground">
                  {purchaseCurrency === 'USD' && purchasePrice
                    ? `환율 적용 시 약 ${(Number(purchasePrice) * 1400).toLocaleString('ko-KR')}원 (저장 시 실시간 환율 적용)`
                    : '수익률 계산에 사용됩니다'
                  }
                </p>
              </div>
              <div className="space-y-1.5">
                <Label>수량 (주)</Label>
                <Input
                  type="number"
                  placeholder="0"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  required
                  min={0}
                  step="any"
                />
              </div>
            </>
          )}


          {/* 금 */}
          {entryType === 'gold' && (
            <>
              <div className="space-y-1.5">
                <Label>보유량 (그램)</Label>
                <Input
                  type="number"
                  placeholder="0"
                  value={grams}
                  onChange={(e) => setGrams(e.target.value)}
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
                />
                <p className="text-xs text-muted-foreground">
                  현재 금 시세와 비교하여 수익률을 계산합니다
                </p>
              </div>
              <div className="space-y-1.5">
                <Label>보관처</Label>
                <Input
                  placeholder="예: 한국투자증권"
                  value={brokerage}
                  onChange={(e) => setBrokerage(e.target.value)}
                  maxLength={50}
                />
              </div>
            </>
          )}

          {/* 코인 */}
          {entryType === 'crypto' && (
            <>
              <div className="space-y-1.5">
                <Label>종목 검색</Label>
                <CryptoSearch
                  onSelect={(result: CryptoMarket) => {
                    setCryptoTicker(result.ticker);
                  }}
                />
              </div>
              <div className="space-y-1.5">
                <Label>수량</Label>
                <Input
                  type="number"
                  placeholder="0"
                  value={cryptoQuantity}
                  onChange={(e) => setCryptoQuantity(e.target.value)}
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

          {/* 현금 */}
          {entryType === 'cash' && (
            <>
              <div className="space-y-1.5">
                <Label>이름</Label>
                <Input
                  placeholder="예: 비상금 (CMA), 정기예금 (신한)"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  maxLength={100}
                />
              </div>
              <div className="space-y-1.5">
                <Label>은행/증권사</Label>
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
                  placeholder="0"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  required
                  min={0}
                />
              </div>
            </>
          )}

          {/* 부채 */}
          {entryType === 'liability' && (
            <>
              <div className="space-y-1.5">
                <Label>유형</Label>
                <Select value={liabilityType} onValueChange={(v) => v && setLiabilityType(v as LiabilityCategory)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {LIABILITY_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>이름</Label>
                <Input
                  placeholder="예: 주택담보대출 (KB)"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  maxLength={100}
                />
              </div>
              <div className="space-y-1.5">
                <Label>잔액 (원)</Label>
                <Input
                  type="number"
                  placeholder="0"
                  value={balance}
                  onChange={(e) => setBalance(e.target.value)}
                  required
                  min={0}
                />
              </div>
              <div className="space-y-1.5">
                <Label>금리 (%)</Label>
                <Input
                  type="number"
                  placeholder="3.5"
                  value={interestRate}
                  onChange={(e) => setInterestRate(e.target.value)}
                  min={0}
                  step="0.01"
                />
              </div>
            </>
          )}

          {error && (
            <div className="rounded-lg bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-500">
              {error}
            </div>
          )}

          <div className="pt-2">
            <Button type="submit" className="w-full" disabled={saving}>
              {saving ? '저장 중...' : '등록하기'}
            </Button>
          </div>
        </form>
      </main>
    </div>
  );
}
