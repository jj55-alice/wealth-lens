import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { searchKbComplex, getKbAreas, getKbPrice } from '@/lib/prices/kb';

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: '인증 필요' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action');

  // 단지 검색
  if (action === 'search') {
    const query = searchParams.get('q')?.trim();
    if (!query || query.length < 2) {
      return NextResponse.json([]);
    }
    const results = await searchKbComplex(query);
    return NextResponse.json(results);
  }

  // 면적 리스트
  if (action === 'areas') {
    const complexId = searchParams.get('complexId');
    if (!complexId) {
      return NextResponse.json({ error: 'complexId 필요' }, { status: 400 });
    }
    const areas = await getKbAreas(complexId);
    return NextResponse.json(areas);
  }

  // 시세 조회
  if (action === 'price') {
    const complexId = searchParams.get('complexId');
    if (!complexId) {
      return NextResponse.json({ error: 'complexId 필요' }, { status: 400 });
    }
    const areaId = searchParams.get('areaId') ?? undefined;
    const price = await getKbPrice(complexId, areaId);
    return NextResponse.json(price);
  }

  return NextResponse.json({ error: 'action 필요' }, { status: 400 });
}
