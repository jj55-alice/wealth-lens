'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTheme } from 'next-themes';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { useToast } from '@/components/ui/toast';
import { formatKRW } from '@/lib/format';
import { PRESETS, CLASS_LABELS } from '@/lib/rebalancing';
import type { RebalancingTarget } from '@/lib/rebalancing';

export default function SettingsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const [householdName, setHouseholdName] = useState('');
  const [goalNetWorth, setGoalNetWorth] = useState('');
  const [goalDividend, setGoalDividend] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [userNickname, setUserNickname] = useState('');
  const [upbitAccessKey, setUpbitAccessKey] = useState('');
  const [upbitSecretKey, setUpbitSecretKey] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState('');
  const [kisAppKey, setKisAppKey] = useState('');
  const [kisAppSecret, setKisAppSecret] = useState('');
  const [kisAccountNo, setKisAccountNo] = useState('');
  const [kisSyncing, setKisSyncing] = useState(false);
  const [kisSyncResult, setKisSyncResult] = useState('');
  const [showLogout, setShowLogout] = useState(false);
  const { theme, setTheme } = useTheme();
  const { toast } = useToast();

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
        return;
      }
      setUserNickname(user.user_metadata?.nickname ?? '');

      try {
        const res = await fetch('/api/settings');
        const data = await res.json();
        if (data.household) {
          setHouseholdName(data.household.name ?? '');
          setGoalNetWorth(data.household.goal_net_worth ? String(data.household.goal_net_worth) : '');
          setGoalDividend(data.household.goal_annual_dividend ? String(data.household.goal_annual_dividend) : '');
          setUpbitAccessKey(data.household.upbit_access_key ?? '');
          setUpbitSecretKey(data.household.upbit_secret_key ?? '');
          setKisAppKey(data.household.kis_app_key ?? '');
          setKisAppSecret(data.household.kis_app_secret ?? '');
          setKisAccountNo(data.household.kis_account_no ?? '');
        }
        if (data.user) {
          setUserEmail(data.user.email ?? '');
        }
      } catch {
        toast('설정을 불러오지 못했습니다', 'error');
      }
      setLoading(false);
    }
    load();
  }, [router]);

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    try {
      // 닉네임 업데이트 (Supabase Auth user_metadata)
      const supabase = createClient();
      await supabase.auth.updateUser({
        data: { nickname: userNickname },
      });

      // 가구 설정 업데이트
      await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: householdName,
          goal_net_worth: goalNetWorth ? Number(goalNetWorth) : null,
          goal_annual_dividend: goalDividend ? Number(goalDividend) : null,
          upbit_access_key: upbitAccessKey || null,
          upbit_secret_key: upbitSecretKey || null,
          kis_app_key: kisAppKey || null,
          kis_app_secret: kisAppSecret || null,
          kis_account_no: kisAccountNo || null,
        }),
      });
      setSaved(true);
      toast('설정이 저장되었습니다', 'success');
      setTimeout(() => setSaved(false), 2000);
    } catch {
      toast('저장에 실패했습니다', 'error');
    }
    setSaving(false);
  }

  async function handleUpbitSync() {
    setSyncing(true);
    setSyncResult('');
    try {
      const res = await fetch('/api/upbit-sync', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        setSyncResult(data.error || '동기화 실패');
      } else {
        setSyncResult(`${data.synced}개 코인 동기화 완료`);
      }
    } catch {
      setSyncResult('네트워크 오류');
    }
    setSyncing(false);
  }

  async function handleKisSync() {
    setKisSyncing(true);
    setKisSyncResult('');
    try {
      const res = await fetch('/api/kis-sync', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        setKisSyncResult(data.error || '동기화 실패');
      } else {
        let msg = `국내 ${data.domestic}종목 + 해외 ${data.foreign}��목 동기화 완료`;
        if (data.deleted > 0) msg += ` (${data.deleted}종목 매도 삭제)`;
        if (data.errors?.length > 0) msg += `\n⚠️ ${data.errors.join(', ')}`;
        if (data.debug) msg += `\n[debug] output1 items: ${data.debug?.output1?.length ?? 0}, output2: ${JSON.stringify(data.debug?.output2 ?? {}).slice(0, 200)}`;
        setKisSyncResult(msg);
      }
    } catch {
      setKisSyncResult('네트워크 오류');
    }
    setKisSyncing(false);
  }

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = '/login';
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <header className="border-b border-border px-6 py-4">
          <div className="mx-auto max-w-lg"><Skeleton className="h-6 w-24" /></div>
        </header>
        <main className="mx-auto max-w-lg px-6 py-8 space-y-4">
          <Skeleton className="h-40 w-full rounded-xl" />
          <Skeleton className="h-40 w-full rounded-xl" />
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border px-6 py-4">
        <div className="mx-auto max-w-lg flex items-center gap-4">
          <Link href="/dashboard">
            <Button variant="ghost" size="sm">← 대시보드</Button>
          </Link>
          <h1 className="text-lg font-semibold">설정</h1>
        </div>
      </header>

      <main className="mx-auto max-w-lg px-6 py-8 space-y-6">
        {/* 계정 정보 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">계정</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1.5">
              <Label>닉네임</Label>
              <Input
                value={userNickname}
                onChange={(e) => setUserNickname(e.target.value)}
                placeholder="닉네임"
                maxLength={20}
              />
            </div>
            <div className="space-y-1.5">
              <Label>이메일</Label>
              <Input value={userEmail} disabled className="bg-muted" />
            </div>
            <div className="space-y-1.5">
              <Label>가구 이름</Label>
              <Input
                value={householdName}
                onChange={(e) => setHouseholdName(e.target.value)}
                maxLength={50}
              />
            </div>
          </CardContent>
        </Card>

        {/* 목표 설정 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">목표 설정</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label>순자산 목표 (원)</Label>
              <Input
                type="number"
                placeholder="예: 1000000000 (10억)"
                value={goalNetWorth}
                onChange={(e) => setGoalNetWorth(e.target.value)}
                min={0}
              />
              {goalNetWorth && (
                <p className="text-xs text-muted-foreground">
                  {formatKRW(Number(goalNetWorth))}
                </p>
              )}
            </div>

            <Separator />

            <div className="space-y-1.5">
              <Label>연간 배당 목표 (원)</Label>
              <Input
                type="number"
                placeholder="예: 12000000 (월 100만원)"
                value={goalDividend}
                onChange={(e) => setGoalDividend(e.target.value)}
                min={0}
              />
              {goalDividend && (
                <p className="text-xs text-muted-foreground">
                  연 {formatKRW(Number(goalDividend))} (월 {formatKRW(Math.round(Number(goalDividend) / 12))})
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Upbit 연동 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Upbit 연동</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-xs text-muted-foreground">
              Upbit API 키를 입력하면 보유 코인을 자동으로 가져옵니다.
              API 키는 Upbit 앱 &gt; 마이페이지 &gt; Open API 관리에서 발급하세요.
              (자산조회 권한만 필요)
            </p>
            <div className="space-y-1.5">
              <Label>Access Key</Label>
              <Input
                type="password"
                value={upbitAccessKey}
                onChange={(e) => setUpbitAccessKey(e.target.value)}
                placeholder="Access Key"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Secret Key</Label>
              <Input
                type="password"
                value={upbitSecretKey}
                onChange={(e) => setUpbitSecretKey(e.target.value)}
                placeholder="Secret Key"
              />
            </div>
            {upbitAccessKey && upbitSecretKey && (
              <Button
                variant="outline"
                className="w-full"
                onClick={handleUpbitSync}
                disabled={syncing}
              >
                {syncing ? '동기화 중...' : '₿ 코인 동기화'}
              </Button>
            )}
            {syncResult && (
              <p className={`text-xs ${syncResult.includes('완료') ? 'text-emerald-500' : 'text-red-500'}`}>
                {syncResult}
              </p>
            )}
          </CardContent>
        </Card>

        {/* 한국투자증권 연동 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">한국투자증권 연동</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-xs text-muted-foreground">
              한국투자증권 API 키를 입력하면 보유 주식(국내+해외)을 자동으로 가져옵니다.
              KIS Developers (apiportal.koreainvestment.com)에서 발급하세요.
            </p>
            <div className="space-y-1.5">
              <Label>App Key</Label>
              <Input
                type="password"
                value={kisAppKey}
                onChange={(e) => setKisAppKey(e.target.value)}
                placeholder="App Key"
              />
            </div>
            <div className="space-y-1.5">
              <Label>App Secret</Label>
              <Input
                type="password"
                value={kisAppSecret}
                onChange={(e) => setKisAppSecret(e.target.value)}
                placeholder="App Secret"
              />
            </div>
            <div className="space-y-1.5">
              <Label>계좌번호</Label>
              <Input
                value={kisAccountNo}
                onChange={(e) => setKisAccountNo(e.target.value)}
                placeholder="00000000-00"
              />
              <p className="text-[10px] text-muted-foreground">
                8자리-2자리 형식 (예: 50012345-01)
              </p>
            </div>
            {kisAppKey && kisAppSecret && kisAccountNo && (
              <Button
                variant="outline"
                className="w-full"
                onClick={handleKisSync}
                disabled={kisSyncing}
              >
                {kisSyncing ? '동기화 중...' : '📈 주식 동기화'}
              </Button>
            )}
            {kisSyncResult && (
              <p className={`text-xs ${kisSyncResult.includes('완료') ? 'text-emerald-500' : 'text-red-500'}`}>
                {kisSyncResult}
              </p>
            )}
          </CardContent>
        </Card>

        {/* 주식 계좌 관리 */}
        <AccountManagementSection />

        {/* 리밸런싱 목표 */}
        <RebalancingTargetSection />

        {/* 테마 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">테마</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setTheme('light')}
                className={`flex-1 rounded-lg border px-4 py-3 text-sm transition-colors ${
                  theme === 'light'
                    ? 'border-primary bg-primary/10 font-semibold'
                    : 'border-border hover:bg-muted'
                }`}
              >
                ☀️ 라이트
              </button>
              <button
                type="button"
                onClick={() => setTheme('dark')}
                className={`flex-1 rounded-lg border px-4 py-3 text-sm transition-colors ${
                  theme === 'dark'
                    ? 'border-primary bg-primary/10 font-semibold'
                    : 'border-border hover:bg-muted'
                }`}
              >
                🌙 다크
              </button>
            </div>
          </CardContent>
        </Card>

        {/* 저장 */}
        <Button className="w-full" onClick={handleSave} disabled={saving}>
          {saving ? '저장 중...' : saved ? '저장됨' : '저장'}
        </Button>

        <Separator />

        {/* 로그아웃 */}
        <Button
          variant="outline"
          className="w-full text-red-500 hover:text-red-600"
          onClick={() => setShowLogout(true)}
        >
          로그아웃
        </Button>
      </main>

      <div id="rebalancing" />
      <Dialog open={showLogout} onOpenChange={setShowLogout}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>로그아웃</DialogTitle>
            <DialogDescription>
              정말 로그아웃하시겠습니까?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowLogout(false)}>
              취소
            </Button>
            <Button variant="destructive" onClick={handleLogout}>
              로그아웃
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

const ASSET_CLASSES = ['domestic_equity', 'foreign_equity', 'bond', 'commodity', 'crypto', 'cash_equiv'] as const;
const BAR_COLORS: Record<string, string> = {
  domestic_equity: '#3b82f6',
  foreign_equity: '#8b5cf6',
  bond: '#06b6d4',
  commodity: '#f59e0b',
  crypto: '#10b981',
  cash_equiv: '#6b7280',
};

function RebalancingTargetSection() {
  const [targets, setTargets] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [preset, setPreset] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/rebalancing');
        const data = await res.json();
        if (data.targets?.length > 0) {
          const map: Record<string, number> = {};
          for (const t of data.targets) map[t.asset_class] = t.target_ratio;
          setTargets(map);
        }
      } catch (err) {
        console.error('리밸런싱 목표 조회 실패:', err);
      }
      setLoading(false);
    }
    load();
  }, []);

  const total = Object.values(targets).reduce((s, v) => s + v, 0);
  const isValid = Math.abs(total - 100) < 0.1;

  function applyPreset(key: string) {
    const p = PRESETS[key];
    if (!p) return;
    const map: Record<string, number> = {};
    for (const t of p) map[t.asset_class] = t.target_ratio;
    setTargets(map);
    setPreset(key);
  }

  function setRatio(cls: string, value: number) {
    setTargets(prev => ({ ...prev, [cls]: Math.max(0, Math.min(100, value)) }));
    setPreset('custom');
  }

  async function handleSave() {
    if (!isValid) {
      toast(`합계가 ${total.toFixed(1)}%입니다. 100%로 맞춰주세요.`, 'error');
      return;
    }
    setSaving(true);
    try {
      const targetArray = ASSET_CLASSES.map(cls => ({
        asset_class: cls,
        target_ratio: targets[cls] ?? 0,
      }));
      const res = await fetch('/api/rebalancing', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targets: targetArray }),
      });
      if (!res.ok) {
        const data = await res.json();
        toast(data.error || '저장 실패', 'error');
      } else {
        toast('리밸런싱 목표가 저장되었습니다', 'success');
      }
    } catch {
      toast('네트워크 오류', 'error');
    }
    setSaving(false);
  }

  if (loading) {
    return (
      <Card>
        <CardHeader><CardTitle className="text-sm">리밸런싱 목표</CardTitle></CardHeader>
        <CardContent><Skeleton className="h-40 w-full" /></CardContent>
      </Card>
    );
  }

  const presetButtons = [
    { key: 'conservative', label: '보수형' },
    { key: 'balanced', label: '균형형' },
    { key: 'aggressive', label: '공격형' },
    { key: 'custom', label: '직접설정' },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">리밸런싱 목표</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* 프리셋 */}
        <div className="flex gap-2">
          {presetButtons.map(b => (
            <button
              key={b.key}
              type="button"
              onClick={() => b.key !== 'custom' ? applyPreset(b.key) : null}
              className={`flex-1 px-2 py-2 text-xs rounded-lg border transition-colors ${
                preset === b.key
                  ? 'border-primary bg-primary/10 font-semibold'
                  : 'border-border hover:bg-muted'
              }`}
            >
              {b.label}
            </button>
          ))}
        </div>

        {/* 슬라이더 */}
        <div className="space-y-3">
          {ASSET_CLASSES.map(cls => {
            const value = targets[cls] ?? 0;
            return (
              <div key={cls}>
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <span>{CLASS_LABELS[cls] ?? cls}</span>
                  <span className="font-semibold tabular-nums">{value}%</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 bg-muted h-1.5 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${value}%`, backgroundColor: BAR_COLORS[cls] }}
                    />
                  </div>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={value}
                    onChange={(e) => setRatio(cls, Number(e.target.value))}
                    className="w-14 text-xs text-right bg-transparent border border-border rounded px-1.5 py-1 tabular-nums"
                  />
                </div>
              </div>
            );
          })}
        </div>

        {/* 합계 */}
        <div className="flex justify-between items-center pt-3 border-t border-border text-sm">
          <span className="font-semibold">합계</span>
          <span className={`font-semibold tabular-nums ${isValid ? 'text-emerald-500' : 'text-red-500'}`}>
            {total.toFixed(0)}%
          </span>
        </div>

        <Button
          className="w-full"
          onClick={handleSave}
          disabled={saving || !isValid}
        >
          {saving ? '저장 중...' : '목표 저장'}
        </Button>
      </CardContent>
    </Card>
  );
}

const ACCOUNT_BROKERAGES = [
  '키움증권', '현대차증권', '신한은행', '하나은행', '한국투자증권',
  '삼성증권', '미래에셋증권', 'NH투자증권', '기타',
];

interface UserAccount {
  id: string;
  brokerage: string;
  alias: string;
  user_id: string;
}

interface HouseholdMember {
  user_id: string;
  email: string;
  nickname: string | null;
}

function AccountManagementSection() {
  const [accounts, setAccounts] = useState<UserAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [members, setMembers] = useState<HouseholdMember[]>([]);
  const [currentUserId, setCurrentUserId] = useState('');
  const [targetUserId, setTargetUserId] = useState('');
  const [brokerage, setBrokerage] = useState('');
  const [alias, setAlias] = useState('');
  const [adding, setAdding] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<UserAccount | null>(null);
  const { toast } = useToast();

  async function load() {
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setCurrentUserId(user.id);
        if (!targetUserId) setTargetUserId(user.id);
      }

      // 가구 멤버 조회
      const membersRes = await fetch('/api/invite');
      const membersData = await membersRes.json();
      if (Array.isArray(membersData.members)) {
        setMembers(membersData.members);
      }

      // 가구 전체 계좌 조회 (owner 정보 포함)
      const res = await fetch('/api/accounts?owner=all');
      const data = await res.json();
      setAccounts(data.accounts ?? []);
    } catch {
      toast('계좌 목록을 불러오지 못했습니다', 'error');
    }
    setLoading(false);
  }

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function memberLabel(userId: string): string {
    const m = members.find(mm => mm.user_id === userId);
    if (!m) return userId === currentUserId ? '나' : '가족';
    // 닉네임 우선, 폴백은 이메일의 @ 앞부분
    const label = m.nickname || (m.email ? m.email.split('@')[0] : '가족');
    return userId === currentUserId ? `${label} (나)` : label;
  }

  async function handleAdd() {
    if (!brokerage || !alias.trim()) {
      toast('금융사와 별칭을 모두 입력해주세요', 'error');
      return;
    }
    setAdding(true);
    try {
      const res = await fetch('/api/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brokerage,
          alias: alias.trim(),
          user_id: targetUserId || currentUserId,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast(data.error || '추가 실패', 'error');
      } else {
        setAccounts([...accounts, data.account]);
        setBrokerage('');
        setAlias('');
        toast('계좌가 추가되었습니다', 'success');
      }
    } catch {
      toast('네트워크 오류', 'error');
    }
    setAdding(false);
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    try {
      await fetch(`/api/accounts?id=${deleteTarget.id}`, { method: 'DELETE' });
      setAccounts(accounts.filter(a => a.id !== deleteTarget.id));
      setDeleteTarget(null);
      toast('계좌가 삭제되었습니다', 'success');
    } catch {
      toast('삭제 실패', 'error');
    }
  }

  // 멤버별로 그룹핑 (현재 사용자 먼저)
  const groupedAccounts = (() => {
    const groups = new Map<string, UserAccount[]>();
    for (const acc of accounts) {
      const list = groups.get(acc.user_id) ?? [];
      list.push(acc);
      groups.set(acc.user_id, list);
    }
    const orderedIds = [
      currentUserId,
      ...members.map(m => m.user_id).filter(id => id !== currentUserId),
    ];
    return orderedIds
      .filter(id => groups.has(id))
      .map(id => ({ userId: id, items: groups.get(id)! }));
  })();

  const showOwnerSelect = members.length > 1;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">주식 계좌 관리</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-muted-foreground">
          금융사별 계좌를 별칭과 함께 등록해두면, 자산 등록 시 빠르게 선택할 수 있어요.
        </p>

        {loading ? (
          <Skeleton className="h-16 w-full" />
        ) : accounts.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border py-6 px-4 text-center">
            <p className="text-sm text-muted-foreground mb-1">아직 등록된 계좌가 없어요</p>
            <p className="text-xs text-muted-foreground">
              아래에서 첫 번째 계좌를 추가해보세요
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {groupedAccounts.map((group) => (
              <div key={group.userId}>
                {showOwnerSelect && (
                  <p className="text-xs font-medium text-muted-foreground mb-1 px-1">
                    {memberLabel(group.userId)}
                  </p>
                )}
                <div className="space-y-1.5">
                  {group.items.map((acc) => (
                    <div
                      key={acc.id}
                      className="group flex items-center justify-between rounded-lg border border-border px-3 py-2"
                    >
                      <div className="text-sm">
                        <span className="font-medium">{acc.brokerage}</span>
                        <span className="text-muted-foreground"> · {acc.alias}</span>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setDeleteTarget(acc)}
                        className="h-7 text-xs px-2 text-red-500 hover:text-red-600 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
                      >
                        삭제
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="space-y-2 pt-2 border-t border-border">
          {showOwnerSelect && (
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">소유자</Label>
              <Select value={targetUserId} onValueChange={(v) => v && setTargetUserId(v)}>
                <SelectTrigger>
                  <SelectValue placeholder="소유자 선택" />
                </SelectTrigger>
                <SelectContent>
                  {[currentUserId, ...members.map(m => m.user_id).filter(id => id !== currentUserId)]
                    .filter(id => id)
                    .map((id) => (
                      <SelectItem key={id} value={id}>{memberLabel(id)}</SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="grid grid-cols-2 gap-2">
            <Select value={brokerage} onValueChange={(v) => v && setBrokerage(v)}>
              <SelectTrigger>
                <SelectValue placeholder="금융사" />
              </SelectTrigger>
              <SelectContent>
                {ACCOUNT_BROKERAGES.map((b) => (
                  <SelectItem key={b} value={b}>{b}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              placeholder="별칭 (예: 메인, ISA)"
              value={alias}
              onChange={(e) => setAlias(e.target.value)}
              maxLength={50}
            />
          </div>
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={handleAdd}
            disabled={adding || !brokerage || !alias.trim()}
          >
            {adding ? '추가 중...' : '+ 계좌 추가'}
          </Button>
        </div>
      </CardContent>

      {/* 삭제 확인 다이얼로그 */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>계좌 삭제</DialogTitle>
            <DialogDescription>
              &quot;{deleteTarget?.brokerage} · {deleteTarget?.alias}&quot; 계좌를 삭제하시겠습니까?
              이미 등록된 자산은 영향을 받지 않지만, 퀵픽 목록에서 사라집니다.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              취소
            </Button>
            <Button variant="destructive" onClick={confirmDelete}>
              삭제
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
