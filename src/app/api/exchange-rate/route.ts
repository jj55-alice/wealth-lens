import { createClient } from '@/lib/supabase/server';
import { getUsdKrwRate } from '@/lib/prices/bok';
import { NextResponse } from 'next/server';

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: '인증 필요' }, { status: 401 });
  }

  const rate = await getUsdKrwRate();
  return NextResponse.json({ rate });
}
