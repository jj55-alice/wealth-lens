import { createClient } from '@supabase/supabase-js';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

// Uses service_role to bypass RLS for initial household creation
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export async function POST() {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 });
  }

  // Check if user already has a household
  const { data: existing } = await supabaseAdmin
    .from('household_members')
    .select('household_id')
    .eq('user_id', user.id)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ household_id: existing.household_id });
  }

  // Create household with service_role (bypasses RLS)
  const { data: household, error: hhError } = await supabaseAdmin
    .from('households')
    .insert({ name: '우리 가구' })
    .select()
    .single();

  if (hhError || !household) {
    return NextResponse.json({ error: '가구 생성 실패' }, { status: 500 });
  }

  // Add user as owner
  const { error: memberError } = await supabaseAdmin
    .from('household_members')
    .insert({
      household_id: household.id,
      user_id: user.id,
      role: 'owner',
    });

  if (memberError) {
    return NextResponse.json({ error: '멤버 추가 실패' }, { status: 500 });
  }

  return NextResponse.json({ household_id: household.id });
}
