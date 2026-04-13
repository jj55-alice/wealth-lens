import { NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { getSupabaseUrl, getServiceRoleKey } from '@/lib/env';

export async function GET() {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const admin = createAdminClient(getSupabaseUrl(), getServiceRoleKey());
  const { data: membership } = await admin
    .from('household_members')
    .select('household_id')
    .eq('user_id', user.id)
    .maybeSingle();
  if (!membership) return NextResponse.json({ history: [] });

  const { data } = await admin
    .from('rebalancing_history')
    .select('*')
    .eq('household_id', membership.household_id)
    .order('checked_at', { ascending: false })
    .limit(20);

  return NextResponse.json({ history: data ?? [] });
}

export async function POST(request: Request) {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const admin = createAdminClient(getSupabaseUrl(), getServiceRoleKey());
  const { data: membership } = await admin
    .from('household_members')
    .select('household_id')
    .eq('user_id', user.id)
    .maybeSingle();
  if (!membership) return NextResponse.json({ error: 'No household' }, { status: 404 });

  const body = await request.json();

  const { error } = await admin
    .from('rebalancing_history')
    .insert({
      household_id: membership.household_id,
      status: body.status,
      max_drift: body.maxDrift,
      suggestions: body.suggestions,
      total_liquid: body.totalLiquid,
      checked_at: new Date().toISOString(),
    });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
