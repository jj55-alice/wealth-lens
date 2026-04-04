import { createClient } from '@supabase/supabase-js';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { getSupabaseUrl, getServiceRoleKey } from '@/lib/env';
import { NextResponse } from 'next/server';

export async function GET() {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: '인증 필요' }, { status: 401 });
  }

  const supabaseAdmin = createClient(getSupabaseUrl(), getServiceRoleKey());

  const { data: membership } = await supabaseAdmin
    .from('household_members')
    .select('household_id, role, households(id, name, goal_net_worth, goal_annual_dividend)')
    .eq('user_id', user.id)
    .single();

  if (!membership?.households) {
    return NextResponse.json({ error: '가구 없음' }, { status: 404 });
  }

  const hh = membership.households as unknown as {
    id: string;
    name: string;
    goal_net_worth: number | null;
    goal_annual_dividend: number | null;
  };

  return NextResponse.json({
    household: hh,
    user: { id: user.id, email: user.email },
    role: membership.role,
  });
}

export async function PUT(request: Request) {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: '인증 필요' }, { status: 401 });
  }

  const body = await request.json();
  const supabaseAdmin = createClient(getSupabaseUrl(), getServiceRoleKey());

  const { data: membership } = await supabaseAdmin
    .from('household_members')
    .select('household_id')
    .eq('user_id', user.id)
    .single();

  if (!membership) {
    return NextResponse.json({ error: '가구 없음' }, { status: 404 });
  }

  const updates: Record<string, unknown> = {};
  if ('name' in body) updates.name = body.name;
  if ('goal_net_worth' in body) updates.goal_net_worth = body.goal_net_worth || null;
  if ('goal_annual_dividend' in body) updates.goal_annual_dividend = body.goal_annual_dividend || null;

  const { error } = await supabaseAdmin
    .from('households')
    .update(updates)
    .eq('id', membership.household_id);

  if (error) {
    return NextResponse.json({ error: '저장 실패' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
