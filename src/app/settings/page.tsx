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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { useToast } from '@/components/ui/toast';
import { formatKRW } from '@/lib/format';

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
