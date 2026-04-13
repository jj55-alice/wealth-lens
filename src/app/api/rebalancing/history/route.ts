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

const VALID_STATUSES = ['balanced', 'needs_adjustment', 'urgent'];

export async function POST(request: Request) {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const status = VALID_STATUSES.includes(body.status) ? body.status : 'balanced';
  const maxDrift = Number(body.maxDrift) || 0;
  const totalLiquid = Number(body.totalLiquid) || 0;
  const suggestions = Array.isArray(body.suggestions) ? body.suggestions : [];

  const admin = createAdminClient(getSupabaseUrl(), getServiceRoleKey());
  const { data: membership } = await admin
    .from('household_members')
    .select('household_id')
    .eq('user_id', user.id)
    .maybeSingle();
  if (!membership) return NextResponse.json({ error: 'No household' }, { status: 404 });

  const { error } = await admin
    .from('rebalancing_history')
    .insert({
      household_id: membership.household_id,
      status,
      max_drift: maxDrift,
      suggestions,
      total_liquid: totalLiquid,
      checked_at: new Date().toISOString(),
    });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
