import { createClient } from '@supabase/supabase-js';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { getSupabaseUrl, getServiceRoleKey } from '@/lib/env';
import { NextResponse } from 'next/server';

export async function POST() {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 });
  }

  const supabaseAdmin = createClient(getSupabaseUrl(), getServiceRoleKey());

  // Check if user already has a household
  const { data: existing } = await supabaseAdmin
    .from('household_members')
    .select('household_id')
    .eq('user_id', user.id)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ household_id: existing.household_id });
  }

  // Create household + add member atomically via RPC to prevent race condition
  // Fallback: insert with conflict handling
  const { data: household, error: hhError } = await supabaseAdmin
    .from('households')
    .insert({ name: '우리 가구' })
    .select()
    .single();

  if (hhError || !household) {
    return NextResponse.json({ error: '가구 생성 실패' }, { status: 500 });
  }

  // Use upsert to handle race condition (concurrent requests)
  const { error: memberError } = await supabaseAdmin
    .from('household_members')
    .upsert(
      { household_id: household.id, user_id: user.id, role: 'owner' },
      { onConflict: 'household_id,user_id' },
    );

  if (memberError) {
    // Race condition: another request may have created a membership.
    // Check again and return whatever exists.
    const { data: retry } = await supabaseAdmin
      .from('household_members')
      .select('household_id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (retry) {
      return NextResponse.json({ household_id: retry.household_id });
    }
    return NextResponse.json({ error: '멤버 추가 실패' }, { status: 500 });
  }

  return NextResponse.json({ household_id: household.id });
}
