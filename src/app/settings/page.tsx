'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
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

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
        return;
      }

      try {
        const res = await fetch('/api/settings');
        const data = await res.json();
        if (data.household) {
          setHouseholdName(data.household.name ?? '');
          setGoalNetWorth(data.household.goal_net_worth ? String(data.household.goal_net_worth) : '');
          setGoalDividend(data.household.goal_annual_dividend ? String(data.household.goal_annual_dividend) : '');
        }
        if (data.user) {
          setUserEmail(data.user.email ?? '');
        }
      } catch {
        // ignore
      }
      setLoading(false);
    }
    load();
  }, [router]);

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    try {
      await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: householdName,
          goal_net_worth: goalNetWorth ? Number(goalNetWorth) : null,
          goal_annual_dividend: goalDividend ? Number(goalDividend) : null,
        }),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      // ignore
    }
    setSaving(false);
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

        {/* 저장 */}
        <Button className="w-full" onClick={handleSave} disabled={saving}>
          {saving ? '저장 중...' : saved ? '저장됨' : '저장'}
        </Button>

        <Separator />

        {/* 로그아웃 */}
        <Button
          variant="outline"
          className="w-full text-red-500 hover:text-red-600"
          onClick={handleLogout}
        >
          로그아웃
        </Button>
      </main>
    </div>
  );
}
