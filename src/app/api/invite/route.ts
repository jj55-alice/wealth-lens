import { createClient } from '@supabase/supabase-js';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { getSupabaseUrl, getServiceRoleKey } from '@/lib/env';
import { NextResponse } from 'next/server';

// 초대 생성
export async function POST(request: Request) {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: '인증 필요' }, { status: 401 });
  }

  const { email } = await request.json();
  if (!email) {
    return NextResponse.json({ error: '이메일 필요' }, { status: 400 });
  }

  const supabaseAdmin = createClient(getSupabaseUrl(), getServiceRoleKey());

  // Get user's household
  const { data: membership } = await supabaseAdmin
    .from('household_members')
    .select('household_id, role')
    .eq('user_id', user.id)
    .single();

  if (!membership) {
    return NextResponse.json({ error: '가구 없음' }, { status: 404 });
  }

  // Check member count (max 2)
  const { count } = await supabaseAdmin
    .from('household_members')
    .select('*', { count: 'exact', head: true })
    .eq('household_id', membership.household_id);

  if ((count ?? 0) >= 2) {
    return NextResponse.json({ error: '가구 최대 인원(2명) 초과' }, { status: 400 });
  }

  // Check for existing pending invitation
  const { data: existingInvite } = await supabaseAdmin
    .from('invitations')
    .select('id')
    .eq('household_id', membership.household_id)
    .eq('invitee_email', email)
    .is('accepted_at', null)
    .gt('expires_at', new Date().toISOString())
    .maybeSingle();

  if (existingInvite) {
    return NextResponse.json({ error: '이미 보낸 초대가 있습니다' }, { status: 400 });
  }

  // Create invitation
  const { data: invitation, error } = await supabaseAdmin
    .from('invitations')
    .insert({
      household_id: membership.household_id,
      inviter_user_id: user.id,
      invitee_email: email,
    })
    .select('token')
    .single();

  if (error) {
    return NextResponse.json({ error: '초대 생성 실패' }, { status: 500 });
  }

  return NextResponse.json({ token: invitation.token });
}

// 초대 목록 조회
export async function GET() {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: '인증 필요' }, { status: 401 });
  }

  const supabaseAdmin = createClient(getSupabaseUrl(), getServiceRoleKey());

  const { data: membership } = await supabaseAdmin
    .from('household_members')
    .select('household_id')
    .eq('user_id', user.id)
    .single();

  if (!membership) {
    return NextResponse.json({ members: [], invitations: [] });
  }

  // Get members
  const { data: members } = await supabaseAdmin
    .from('household_members')
    .select('user_id, role, created_at')
    .eq('household_id', membership.household_id);

  // Get user emails for members
  const memberDetails = [];
  for (const m of members ?? []) {
    const { data: userData } = await supabaseAdmin.auth.admin.getUserById(m.user_id);
    memberDetails.push({
      ...m,
      email: userData?.user?.email ?? '알 수 없음',
    });
  }

  // Get pending invitations
  const { data: invitations } = await supabaseAdmin
    .from('invitations')
    .select('id, invitee_email, token, expires_at, accepted_at, created_at')
    .eq('household_id', membership.household_id)
    .is('accepted_at', null)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false });

  return NextResponse.json({
    members: memberDetails ?? [],
    invitations: invitations ?? [],
  });
}
