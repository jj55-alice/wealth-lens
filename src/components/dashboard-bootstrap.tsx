'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Skeleton } from '@/components/ui/skeleton';

/**
 * 첫 로그인 시 가구가 없는 경우, /api/household 를 호출해 생성한 뒤
 * 대시보드를 다시 로드한다. 드물게 발생하는 케이스라 별도 client 컴포넌트로 분리.
 */
export function DashboardBootstrap() {
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/household', { method: 'POST' });
        if (!cancelled && res.ok) router.refresh();
      } catch {
        // noop
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border px-6 py-4">
        <div className="mx-auto max-w-5xl">
          <Skeleton className="h-6 w-32" />
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-6 py-8 space-y-6">
        <Skeleton className="h-40 w-full rounded-xl" />
        <div className="grid grid-cols-2 gap-6">
          <Skeleton className="h-64 rounded-xl" />
          <Skeleton className="h-64 rounded-xl" />
        </div>
        <Skeleton className="h-48 rounded-xl" />
      </main>
    </div>
  );
}
