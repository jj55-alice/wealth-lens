import { NextResponse } from 'next/server';
import { createClient as createAdminClient, type SupabaseClient } from '@supabase/supabase-js';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { getSupabaseUrl, getServiceRoleKey } from '@/lib/env';
import { fetchNewsForHoldings } from '@/lib/news';
import { generateBriefing } from '@/lib/briefing/generate';
import { decomposePace, type PaceSummary, type SnapshotRow } from '@/lib/briefing/pace';
import type { BriefingProvider, HoldingContext } from '@/lib/briefing/types';

type Admin = SupabaseClient;

// 두 가지 호출 경로:
//   1) Vercel cron: Authorization: Bearer <CRON_SECRET> 헤더 → 모든 가구 루프
//      Vercel cron 은 GET 기본이라 GET 도 동일 로직으로 export.
//   2) 로그인한 사용자의 수동 재시도: POST + 세션 인증 → 본인 가구만
//
// POST /api/briefing/generate — 사용자 수동 재시도
// GET  /api/briefing/generate — Vercel cron (CRON_SECRET Bearer)
//   Body: { household_id?: string }  // cron 모드에서만 특정 가구 지정 가능.
//   사용자 모드에선 무시하고 본인 가구로 강제.
export async function GET(request: Request) {
  return handleRequest(request);
}

export async function POST(request: Request) {
  return handleRequest(request);
}

async function handleRequest(request: Request) {
  const authHeader = request.headers.get('authorization') ?? '';
  const cronSecret = process.env.CRON_SECRET;
  const isDev = process.env.NODE_ENV !== 'production';
  const isCron = cronSecret ? authHeader === `Bearer ${cronSecret}` : isDev;

  const admin = createAdminClient(getSupabaseUrl(), getServiceRoleKey());

  // body는 옵션
  let bodyHouseholdId: string | undefined;
  try {
    const body = await request.json().catch(() => ({}));
    bodyHouseholdId = body?.household_id;
  } catch {
    // ignore
  }

  // cron 이 아니면 로그인된 사용자로 인증하고 본인 가구로 강제
  if (!isCron) {
    const supabase = await createServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json(
        { error: '인증 필요', detail: authError?.message ?? '세션이 만료되었습니다. 페이지를 새로고침 후 다시 시도해주세요.' },
        { status: 401 },
      );
    }
    const { data: membership } = await admin
      .from('household_members')
      .select('household_id')
      .eq('user_id', user.id)
      .maybeSingle();
    if (!membership) {
      return NextResponse.json({ error: '가구 없음' }, { status: 404 });
    }
    // 다른 가구를 지정하더라도 본인 가구로 덮어씀 (권한 분리)
    bodyHouseholdId = membership.household_id;
  }

  // 가구 목록 조회 (브리핑 provider 포함)
  let householdsQuery = admin.from('households').select('id, briefing_provider');
  if (bodyHouseholdId) householdsQuery = householdsQuery.eq('id', bodyHouseholdId);

  const { data: households, error: hErr } = await householdsQuery;
  if (hErr) {
    return NextResponse.json({ error: hErr.message }, { status: 500 });
  }
  if (!households || households.length === 0) {
    return NextResponse.json({ generated: 0, message: '가구 없음' });
  }

  const results: { household_id: string; status: string; cards: number; cost_usd: number }[] = [];

  for (const hh of households) {
    const provider = (hh.briefing_provider ?? 'anthropic') as BriefingProvider;
    const result = await generateForHousehold(admin, hh.id, provider);
    results.push(result);
  }

  return NextResponse.json({
    generated: results.length,
    results,
  });
}

async function generateForHousehold(
  admin: Admin,
  householdId: string,
  provider: BriefingProvider,
): Promise<{ household_id: string; status: string; cards: number; cost_usd: number }> {
  // 1. 보유 주식/코인 조회 (브리핑 대상은 stock + crypto, 부동산/현금은 제외)
  const { data: assets } = await admin
    .from('assets')
    .select('id, name, ticker, asset_class, quantity, manual_value, purchase_price, price_source, category')
    .eq('household_id', householdId)
    .in('category', ['stock', 'crypto'])
    .not('ticker', 'is', null);

  if (!assets || assets.length === 0) {
    return await saveResult(admin, householdId, {
      cards: [],
      status: 'empty',
      model: 'none',
      inputTokens: 0,
      outputTokens: 0,
      costUsd: 0,
    }, null);
  }

  // 2. 가격 캐시 조회 (current_value 계산용)
  const tickers = assets.map((a) => a.ticker as string);
  const { data: prices } = await admin
    .from('price_cache')
    .select('ticker, price')
    .in('ticker', tickers);
  const priceMap = new Map<string, number>();
  for (const p of prices ?? []) priceMap.set(p.ticker, Number(p.price));

  // 3. holding 컨텍스트 만들기
  const enriched = assets.map((a) => {
    const price = priceMap.get(a.ticker as string) ?? 0;
    const qty = a.quantity ? Number(a.quantity) : 0;
    const currentValue = a.manual_value ? Number(a.manual_value) : price * qty;
    return { ...a, current_value: currentValue };
  });
  const totalValue = enriched.reduce((s, a) => s + a.current_value, 0);

  const holdings: HoldingContext[] = enriched.map((a) => {
    const pp = a.purchase_price ? Number(a.purchase_price) : null;
    const qty = a.quantity ? Number(a.quantity) : 0;
    const investedTotal = pp && qty ? pp * qty : null;
    const returnPct = investedTotal && investedTotal > 0
      ? ((a.current_value - investedTotal) / investedTotal) * 100
      : null;
    return {
      ticker: a.ticker as string,
      name: a.name,
      asset_class: a.asset_class,
      quantity: qty || null,
      purchase_price: pp,
      current_value: a.current_value,
      weight_pct: totalValue > 0 ? (a.current_value / totalValue) * 100 : 0,
      return_pct: returnPct,
      price_source: a.price_source,
    };
  });

  // 4. 뉴스 fetch (실패해도 계속 진행)
  const newsByTicker = await fetchNewsForHoldings(holdings, 5);

  // 5. Pace decomposition — LLM 프롬프트 컨텍스트로 주입하기 위해 먼저 계산
  //    실패해도 브리핑 저장엔 영향 없도록 격리
  const pace = await computePaceForHousehold(admin, householdId).catch(() => null);

  // 6. LLM 호출 (가구 설정에 따라 Anthropic 또는 OpenAI)
  const result = await generateBriefing(holdings, newsByTicker, provider, pace);

  // 7. DB 저장 (upsert by household_id + date)
  return await saveResult(admin, householdId, result, pace);
}

/**
 * 해당 가구의 가장 최근 두 스냅샷 날짜를 찾아 decompose 한다.
 * 스냅샷이 1개 이하이면 null.
 */
async function computePaceForHousehold(admin: Admin, householdId: string): Promise<PaceSummary | null> {
  // 가구의 asset id 목록
  const { data: assetRows } = await admin
    .from('assets')
    .select('id, ticker, name')
    .eq('household_id', householdId);
  if (!assetRows || assetRows.length === 0) return null;
  const assetIds = assetRows.map((a) => a.id);

  // 가장 최근 2개의 snapshot_date 를 찾는다 (가구 전체 기준)
  const { data: distinctDates } = await admin
    .from('asset_snapshots')
    .select('snapshot_date')
    .in('asset_id', assetIds)
    .order('snapshot_date', { ascending: false })
    .limit(500); // 충분히 커서 중복 제거 후 2개 확보
  if (!distinctDates || distinctDates.length === 0) return null;

  const uniqueDates: string[] = [];
  for (const row of distinctDates) {
    if (!uniqueDates.includes(row.snapshot_date)) uniqueDates.push(row.snapshot_date);
    if (uniqueDates.length === 2) break;
  }
  if (uniqueDates.length < 2) return null;

  const [toDate, fromDate] = uniqueDates; // desc 정렬이므로 [0]=today, [1]=prior

  const { data: snapRows } = await admin
    .from('asset_snapshots')
    .select('asset_id, value, quantity, price, snapshot_date')
    .in('asset_id', assetIds)
    .in('snapshot_date', [toDate, fromDate]);
  if (!snapRows) return null;

  const prior = new Map<string, SnapshotRow>();
  const today = new Map<string, SnapshotRow>();
  for (const r of snapRows) {
    const row: SnapshotRow = {
      asset_id: r.asset_id,
      value: Number(r.value),
      quantity: r.quantity != null ? Number(r.quantity) : null,
      price: r.price != null ? Number(r.price) : null,
    };
    if (r.snapshot_date === toDate) today.set(r.asset_id, row);
    else if (r.snapshot_date === fromDate) prior.set(r.asset_id, row);
  }

  return decomposePace({
    from: fromDate,
    to: toDate,
    prior,
    today,
    assets: assetRows.map((a) => ({ id: a.id, ticker: a.ticker, name: a.name })),
  });
}

async function saveResult(
  admin: Admin,
  householdId: string,
  result: Awaited<ReturnType<typeof generateBriefing>>,
  pace: PaceSummary | null,
): Promise<{ household_id: string; status: string; cards: number; cost_usd: number }> {
  const today = new Date().toISOString().slice(0, 10);
  await admin
    .from('briefing_cards')
    .upsert(
      {
        household_id: householdId,
        date: today,
        cards: result.cards,
        model: result.model,
        status: result.status,
        input_tokens: result.inputTokens,
        output_tokens: result.outputTokens,
        cost_usd: result.costUsd,
        error_message: result.errorMessage ?? null,
        generated_at: new Date().toISOString(),
        pace,
      },
      { onConflict: 'household_id,date' },
    );

  return {
    household_id: householdId,
    status: result.status,
    cards: result.cards.length,
    cost_usd: result.costUsd,
  };
}
