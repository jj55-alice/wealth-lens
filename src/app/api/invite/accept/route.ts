import { createClient } from '@supabase/supabase-js';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { getSupabaseUrl, getServiceRoleKey } from '@/lib/env';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 });
  }

  const { token } = await request.json();
  if (!token) {
    return NextResponse.json({ error: '초대 토큰 필요' }, { status: 400 });
  }

  const supabaseAdmin = createClient(getSupabaseUrl(), getServiceRoleKey());

  // Find invitation
  const { data: invitation } = await supabaseAdmin
    .from('invitations')
    .select('*')
    .eq('token', token)
    .is('accepted_at', null)
    .gt('expires_at', new Date().toISOString())
    .single();

  if (!invitation) {
    return NextResponse.json({ error: '유효하지 않거나 만료된 초대입니다' }, { status: 404 });
  }

  // Check if user already in a household
  const { data: existingMembership } = await supabaseAdmin
    .from('household_members')
    .select('household_id')
    .eq('user_id', user.id)
    .maybeSingle();

  if (existingMembership) {
    // Remove from current household
    await supabaseAdmin
      .from('household_members')
      .delete()
      .eq('user_id', user.id);
  }

  // Add to household
  const { error: memberError } = await supabaseAdmin
    .from('household_members')
    .insert({
      household_id: invitation.household_id,
      user_id: user.id,
      role: 'member',
    });

  if (memberError) {
    return NextResponse.json({ error: '가구 참여 실패' }, { status: 500 });
  }

  // Mark invitation accepted
  await supabaseAdmin
    .from('invitations')
    .update({ accepted_at: new Date().toISOString() })
    .eq('id', invitation.id);

  return NextResponse.json({ success: true });
}
