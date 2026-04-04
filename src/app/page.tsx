import Link from 'next/link';

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 p-8">
      <div className="text-center">
        <h1 className="text-4xl font-bold tracking-tight">Wealth Lens</h1>
        <p className="mt-2 text-lg text-muted-foreground">
          우리 집 자산을 한눈에
        </p>
      </div>

      <div className="flex gap-4">
        <Link
          href="/login"
          className="rounded-lg bg-primary px-6 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          시작하기
        </Link>
      </div>

      <div className="mt-8 max-w-md text-center text-sm text-muted-foreground">
        <p>부동산, 주식, 연금, 금, 코인, 현금까지</p>
        <p>부부가 함께 보는 가구 자산 대시보드</p>
      </div>
    </div>
  );
}
