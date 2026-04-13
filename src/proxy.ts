import { type NextRequest, NextResponse } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';

export async function proxy(request: NextRequest) {
  // cron 엔드포인트: Authorization Bearer 헤더가 있으면 Supabase 세션 불필요 → 바이패스
  const isCronRequest = request.headers.get('authorization')?.startsWith('Bearer ');
  const isCronPath = request.nextUrl.pathname === '/api/cron'
    || request.nextUrl.pathname === '/api/briefing/generate'
    || request.nextUrl.pathname === '/api/report';

  if (isCronPath && isCronRequest) {
    return NextResponse.next();
  }

  const { response, user } = await updateSession(request);

  // 루트 페이지: 로그인된 사용자는 대시보드로 리다이렉트
  if (request.nextUrl.pathname === '/' && user) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  return response;
}

export const config = {
  matcher: [
    // 정적 자산, 이미지, public 파일 제외
    '/((?!_next/static|_next/image|favicon.ico|fonts/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|woff|woff2|ttf|css|js)$).*)',
  ],
};
