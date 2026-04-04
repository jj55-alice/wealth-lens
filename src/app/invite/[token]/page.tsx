'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const router = useRouter();
  const [status, setStatus] = useState<'loading' | 'ready' | 'accepting' | 'done' | 'error'>('loading');
  const [error, setError] = useState('');
  const [loggedIn, setLoggedIn] = useState(false);

  useEffect(() => {
    async function check() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      setLoggedIn(!!user);
      setStatus('ready');
    }
    check();
  }, []);

  async function handleAccept() {
    setStatus('accepting');
    try {
      const res = await fetch('/api/invite/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || '초대 수락 실패');
        setStatus('error');
        return;
      }
      setStatus('done');
      setTimeout(() => router.push('/dashboard'), 1500);
    } catch {
      setError('네트워크 오류');
      setStatus('error');
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle className="text-xl">가구 초대</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-center">
          {status === 'loading' && (
            <p className="text-sm text-muted-foreground">확인 중...</p>
          )}

          {status === 'ready' && !loggedIn && (
            <>
              <p className="text-sm text-muted-foreground">
                초대를 수락하려면 먼저 로그인해주세요.
              </p>
              <Button className="w-full" onClick={() => router.push(`/login?redirect=/invite/${token}`)}>
                로그인하기
              </Button>
            </>
          )}

          {status === 'ready' && loggedIn && (
            <>
              <p className="text-sm text-muted-foreground">
                가구에 초대되었습니다. 수락하면 상대방의 자산 정보를 함께 볼 수 있습니다.
              </p>
              <Button className="w-full" onClick={handleAccept}>
                초대 수락하기
              </Button>
            </>
          )}

          {status === 'accepting' && (
            <p className="text-sm text-muted-foreground">처리 중...</p>
          )}

          {status === 'done' && (
            <p className="text-sm text-emerald-500">
              가구에 참여했습니다. 대시보드로 이동합니다...
            </p>
          )}

          {status === 'error' && (
            <>
              <p className="text-sm text-red-500">{error}</p>
              <Button variant="outline" onClick={() => router.push('/dashboard')}>
                대시보드로 가기
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
