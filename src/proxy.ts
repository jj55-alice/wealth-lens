import { type NextRequest, NextResponse } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';

export async function proxy(request: NextRequest) {
  const { response, user } = await updateSession(request);

  // 루트 페이지: 로그인된 사용자는 대시보드로 리다이렉트
  // (updateSession이 이미 getUser()를 한 번 호출했으므로 재사용)
  if (request.nextUrl.pathname === '/' && user) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  return response;
}

export const config = {
  matcher: [
    // 정적 자산, 이미지, public 파일, cron 엔드포인트(자체 인증) 제외
    '/((?!_next/static|_next/image|favicon.ico|api/cron|api/briefing/generate|api/report|fonts/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|woff|woff2|ttf|css|js)$).*)',
  ],
};
