'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { classifyAsset } from '@/lib/classification';
import { StockSearch } from '@/components/stock-search';
import { CryptoSearch } from '@/components/crypto-search';
import { KbSearch } from '@/components/kb-search';
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
import type { AssetCategory, LiabilityCategory } from '@/types/database';

type EntryType = AssetCategory | 'liability';

const ENTRY_TYPES: { value: EntryType; label: string; icon: string }[] = [
  { value: 'real_estate', label: '부동산', icon: '🏠' },
  { value: 'stock', label: '주식', icon: '📈' },
  { value: 'pension', label: '연금', icon: '🏦' },
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

export default function NewAssetPage() {
  const router = useRouter();
  const [entryType, setEntryType] = useState<EntryType | ''>('');
  const [saving, setSaving] = useState(false);

  // Common fields
  const [name, setName] = useState('');
  const [brokerage, setBrokerage] = useState('');

  // Stock fields
  const [ticker, setTicker] = useState('');
  const [stockName, setStockName] = useState('');
  const [stockPriceSource, setStockPriceSource] = useState<'krx' | 'yahoo_finance'>('krx');
  const [stockCurrentPrice, setStockCurrentPrice] = useState<number | null>(null);
  const [purchasePrice, setPurchasePrice] = useState('');
  const [quantity, setQuantity] = useState('');
  const [accountType, setAccountType] = useState('other');

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
          owner_user_id: user.id,
          category: liabilityType,
          name,
          balance: Number(balance) || 0,
          interest_rate: interestRate ? Number(interestRate) : null,
        });
      } else {
        const assetData: Record<string, unknown> = {
          household_id: householdId,
          owner_user_id: user.id,
          category: entryType,
        };

        switch (entryType) {
          case 'real_estate':
            assetData.name = name;
            assetData.subcategory = realEstateType;
            assetData.address = address || null;
            assetData.manual_value = Number(manualValue) || 0;
            assetData.price_source = kbComplexId ? 'kb_real_estate' : 'manual';
            assetData.asset_class = 'alternative';
            assetData.lease_expiry = leaseExpiry || null;
            assetData.kb_complex_id = kbComplexId || null;
            break;
          case 'stock':
            assetData.name = stockName || ticker;
            assetData.ticker = ticker;
            assetData.quantity = Number(quantity) || 0;
            assetData.purchase_price = purchasePrice ? Number(purchasePrice) : null;
            assetData.subcategory = accountType;
            assetData.brokerage = brokerage || null;
            assetData.price_source = stockPriceSource;
            assetData.asset_class = classifyAsset(stockName || ticker, 'stock', ticker);
            break;
          case 'pension':
            assetData.name = name;
            assetData.manual_value = Number(amount) || 0;
            assetData.brokerage = brokerage || null;
            assetData.price_source = 'manual';
            assetData.asset_class = 'domestic_equity';
            break;
          case 'gold':
            assetData.name = '금 현물';
            assetData.quantity = Number(grams) || 0;
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
            assetData.asset_class = 'alternative';
            break;
          case 'cash':
            assetData.name = name;
            assetData.manual_value = Number(amount) || 0;
            assetData.brokerage = brokerage || null;
            assetData.price_source = 'manual';
            assetData.asset_class = 'cash_equiv';
            break;
        }

        const { data: insertedAsset } = await supabase.from('assets').insert(assetData).select('id').single();

        // 전세보증금 부채 자동 생성
        if (entryType === 'real_estate' && hasJeonseTenant && jeonseDeposit && insertedAsset) {
          await supabase.from('liabilities').insert({
            household_id: householdId,
            owner_user_id: user.id,
            category: 'deposit',
            name: `전세보증금 (${name})`,
            balance: Number(jeonseDeposit) || 0,
            linked_asset_id: insertedAsset.id,
          });
        }
      }

      router.push('/dashboard');
      router.refresh();
    } catch (err) {
      console.error('Save error:', err);
      setSaving(false);
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
          <p className="text-sm text-muted-foreground mb-4">
            어떤 자산을 등록하시겠어요?
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

              {/* KB시세 검색 또는 수동 입력 */}
              {!useManualPrice ? (
                <KbSearch
                  realEstateType={realEstateType}
                  onPriceFound={(price, complexId, complexName, complexAddress) => {
                    setManualValue(String(price));
                    setKbComplexId(complexId);
                    if (!name) setName(complexName);
                    if (!address) setAddress(complexAddress);
                  }}
                  onManualFallback={() => setUseManualPrice(true)}
                />
              ) : (
                <>
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label>이름</Label>
                      <button
                        type="button"
                        onClick={() => setUseManualPrice(false)}
                        className="text-xs text-primary hover:underline"
                      >
                        KB시세 검색으로 돌아가기
                      </button>
                    </div>
                    <Input
                      placeholder="예: 구의7단지 현대아파트"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required
                      maxLength={100}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>주소</Label>
                    <Input
                      placeholder="서울시 광진구..."
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      maxLength={200}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>
                      {realEstateType === 'jeonse' ? '전세보증금' : '호가 (현재 시세)'}
                    </Label>
                    <Input
                      type="number"
                      placeholder="0"
                      value={manualValue}
                      onChange={(e) => setManualValue(e.target.value)}
                      required
                      min={0}
                    />
                  </div>
                </>
              )}

              {/* KB시세로 이름/주소 자동 입력된 경우 표시 */}
              {!useManualPrice && name && (
                <div className="space-y-1.5">
                  <Label>이름</Label>
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    maxLength={100}
                  />
                </div>
              )}

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
                    setStockCurrentPrice(result.currentPrice);
                  }}
                />
              </div>
              {stockCurrentPrice && (
                <div className="rounded-lg bg-muted/30 border border-border px-4 py-3">
                  <p className="text-xs text-muted-foreground">현재 시세</p>
                  <p className="text-lg font-bold">{stockCurrentPrice.toLocaleString('ko-KR')}원</p>
                </div>
              )}
              <div className="space-y-1.5">
                <Label>매수 단가 (원)</Label>
                <Input
                  type="number"
                  placeholder="매수 시 단가를 입력하세요"
                  value={purchasePrice}
                  onChange={(e) => setPurchasePrice(e.target.value)}
                  min={0}
                  step="any"
                />
                <p className="text-xs text-muted-foreground">
                  수익률 계산에 사용됩니다
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

          {/* 연금 */}
          {entryType === 'pension' && (
            <>
              <div className="space-y-1.5">
                <Label>이름</Label>
                <Input
                  placeholder="예: IRP (신한), 연금저축 (키움)"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  maxLength={100}
                />
              </div>
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
                <Label>현재 잔고 (원)</Label>
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
