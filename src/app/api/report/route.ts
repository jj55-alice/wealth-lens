import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';
import { getSupabaseUrl, getServiceRoleKey, getCronSecret } from '@/lib/env';
import { formatKRW } from '@/lib/format';
import { NextResponse } from 'next/server';

// Vercel cron 은 GET 기본이라 GET 도 동일 로직으로 export.
export async function GET(request: Request) {
  return handleRequest(request);
}

export async function POST(request: Request) {
  return handleRequest(request);
}

async function handleRequest(request: Request) {
  const cronSecret = getCronSecret();
  const authHeader = request.headers.get('authorization');
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabaseAdmin = createClient(getSupabaseUrl(), getServiceRoleKey());
  const resend = process.env.RESEND_API_KEY
    ? new Resend(process.env.RESEND_API_KEY)
    : null;

  if (!resend) {
    return NextResponse.json({ error: 'Resend not configured' }, { status: 500 });
  }

  // Get all households
  const { data: households } = await supabaseAdmin
    .from('households')
    .select('id, name');

  if (!households) return NextResponse.json({ sent: 0 });

  let sent = 0;

  for (const hh of households) {
    // Get members with emails
    const { data: members } = await supabaseAdmin
      .from('household_members')
      .select('user_id')
      .eq('household_id', hh.id);

    if (!members) continue;

    // Get user emails
    const emails: string[] = [];
    for (const m of members) {
      const { data: { user } } = await supabaseAdmin.auth.admin.getUserById(m.user_id);
      if (user?.email) emails.push(user.email);
    }

    if (emails.length === 0) continue;

    // Get current snapshot
    const { data: latestSnapshot } = await supabaseAdmin
      .from('household_snapshots')
      .select('*')
      .eq('household_id', hh.id)
      .order('snapshot_date', { ascending: false })
      .limit(1)
      .maybeSingle();

    // Get week-ago snapshot
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const { data: prevSnapshot } = await supabaseAdmin
      .from('household_snapshots')
      .select('*')
      .eq('household_id', hh.id)
      .lte('snapshot_date', weekAgo.toISOString().split('T')[0])
      .order('snapshot_date', { ascending: false })
      .limit(1)
      .maybeSingle();

    const currentNW = latestSnapshot ? Number(latestSnapshot.net_worth) : 0;
    const prevNW = prevSnapshot ? Number(prevSnapshot.net_worth) : currentNW;
    const change = currentNW - prevNW;
    const changePercent = prevNW !== 0 ? ((change / prevNW) * 100).toFixed(1) : '0';
    const changeSign = change >= 0 ? '+' : '';

    // Get top movers (assets with biggest value changes)
    const { data: currentAssets } = await supabaseAdmin
      .from('assets')
      .select('id, name, category')
      .eq('household_id', hh.id);

    // Build email HTML
    const emailHtml = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 480px; margin: 0 auto; background: #0a0a0a; color: #fafafa; padding: 32px; border-radius: 12px;">
        <h1 style="font-size: 20px; margin: 0 0 4px;">Wealth Lens</h1>
        <p style="color: #a1a1aa; font-size: 13px; margin: 0 0 24px;">${hh.name} 주간 리포트</p>

        <div style="background: #18181b; border-radius: 8px; padding: 20px; margin-bottom: 16px;">
          <p style="color: #a1a1aa; font-size: 12px; margin: 0;">총 순자산</p>
          <p style="font-size: 28px; font-weight: 700; margin: 4px 0;">${formatKRW(currentNW)}</p>
          <p style="font-size: 14px; color: ${change >= 0 ? '#10b981' : '#ef4444'}; margin: 0;">
            이번 주 ${changeSign}${formatKRW(change)} (${changeSign}${changePercent}%)
          </p>
        </div>

        <div style="background: #18181b; border-radius: 8px; padding: 16px; margin-bottom: 16px;">
          <p style="font-size: 12px; color: #a1a1aa; margin: 0 0 8px;">요약</p>
          <p style="font-size: 13px; margin: 0; line-height: 1.6;">
            총 자산: ${formatKRW(latestSnapshot ? Number(latestSnapshot.total_assets) : 0)}<br/>
            총 부채: ${formatKRW(latestSnapshot ? Number(latestSnapshot.total_liabilities) : 0)}<br/>
            등록 자산: ${currentAssets?.length ?? 0}건
          </p>
        </div>

        <p style="font-size: 11px; color: #52525b; text-align: center; margin-top: 24px;">
          Wealth Lens — 우리 집 자산을 한눈에
        </p>
      </div>
    `;

    try {
      await resend.emails.send({
        from: 'Wealth Lens <noreply@wealth-lens.app>',
        to: emails,
        subject: `📊 주간 리포트: 순자산 ${formatKRW(currentNW)} (${changeSign}${changePercent}%)`,
        html: emailHtml,
      });
      sent++;
    } catch (err) {
      console.error(`Failed to send report to ${hh.name}:`, err);
    }
  }

  return NextResponse.json({ sent, total: households.length });
}
