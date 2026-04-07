import { createClient } from '@supabase/supabase-js';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { getSupabaseUrl, getServiceRoleKey } from '@/lib/env';
import { ensureToken, fetchAllHoldings, type KisSyncResult } from '@/lib/brokers/kis';
import { NextResponse } from 'next/server';

export async function POST() {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: '인증 필요' }, { status: 401 });
  }

  const supabaseAdmin = createClient(getSupabaseUrl(), getServiceRoleKey());

  const { data: membership } = await supabaseAdmin
    .from('household_members')
    .select('household_id, households(kis_app_key, kis_app_secret, kis_account_no, kis_access_token, kis_token_expires_at)')
    .eq('user_id', user.id)
    .single();

  if (!membership?.households) {
    return NextResponse.json({ error: '가구 없음' }, { status: 404 });
  }

  const hh = membership.households as unknown as {
    kis_app_key: string | null;
    kis_app_secret: string | null;
    kis_account_no: string | null;
    kis_access_token: string | null;
    kis_token_expires_at: string | null;
  };

  if (!hh.kis_app_key || !hh.kis_app_secret || !hh.kis_account_no) {
    return NextResponse.json({
      error: '한국투자증권 API 키가 설정되지 않았습니다. 설정 페이지에서 입력해주세요.',
    }, { status: 400 });
  }

  const householdId = membership.household_id;

  // 토큰 확인/갱신
  let token: string;
  try {
    token = await ensureToken(
      {
        appKey: hh.kis_app_key,
        appSecret: hh.kis_app_secret,
        accountNo: hh.kis_account_no,
        accessToken: hh.kis_access_token,
        tokenExpiresAt: hh.kis_token_expires_at,
      },
      async (newToken, expiresAt) => {
        await supabaseAdmin
          .from('households')
          .update({ kis_access_token: newToken, kis_token_expires_at: expiresAt })
          .eq('id', householdId);
      },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'KIS 토큰 발급 실패';
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  // 보유 주식 조회 (국내+해외 병렬)
  let result: KisSyncResult;
  try {
    result = await fetchAllHoldings(token, hh.kis_app_key, hh.kis_app_secret, hh.kis_account_no);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'KIS API 조회 실패';
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  const { holdings, errors: apiErrors } = result;

  // 기존 KIS 자산 일괄 조회 (배치 패턴)
  const { data: existingAssets } = await supabaseAdmin
    .from('assets')
    .select('id, ticker, category')
    .eq('household_id', householdId)
    .eq('brokerage', '한국투자증권');

  const existingMap = new Map(
    (existingAssets ?? []).map(a => [a.ticker, a]),
  );

  let synced = 0;
  const upsertBatch: Record<string, unknown>[] = [];

  for (const h of holdings) {
    const existing = existingMap.get(h.ticker);

    if (existing) {
      // 기존 자산 업데이트
      await supabaseAdmin
        .from('assets')
        .update({
          quantity: h.quantity,
          purchase_price: h.purchasePrice > 0 ? h.purchasePrice : null,
        })
        .eq('id', existing.id);
      existingMap.delete(h.ticker);
    } else {
      // 신규 자산 등록
      upsertBatch.push({
        household_id: householdId,
        owner_user_id: user.id,
        category: 'stock',
        name: h.name,
        ticker: h.ticker,
        quantity: h.quantity,
        purchase_price: h.purchasePrice > 0 ? h.purchasePrice : null,
        brokerage: '한국투자증권',
        price_source: h.market === 'domestic' ? 'krx' : 'yahoo_finance',
        asset_class: h.market === 'domestic' ? 'domestic_equity' : 'foreign_equity',
      });
    }
    synced++;
  }

  // 신규 자산 일괄 insert
  if (upsertBatch.length > 0) {
    await supabaseAdmin.from('assets').insert(upsertBatch);
  }

  // 매도 종목 삭제 (API에 없는데 DB에 있는 것)
  const soldTickers = Array.from(existingMap.values());
  if (soldTickers.length > 0) {
    await supabaseAdmin
      .from('assets')
      .delete()
      .in('id', soldTickers.map(a => a.id));
  }

  // 시세 갱신 트리거
  try {
    await fetch(new URL('/api/prices', process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').toString(), { method: 'POST' });
  } catch (err) {
    console.error('KIS 시세 갱신 트리거 실패:', err);
  }

  // 디버그: raw API 응답 포함 (금현물 등 누락 원인 확인용)
  let debugRaw = null;
  try {
    const [acctPrefix, acctSuffix] = hh.kis_account_no!.split('-');
    const debugRes = await fetch(
      `https://openapi.koreainvestment.com:9443/uapi/domestic-stock/v1/trading/inquire-balance?` +
      new URLSearchParams({
        CANO: acctPrefix,
        ACNT_PRDT_CD: acctSuffix,
        AFHR_FLPR_YN: 'N',
        OFL_YN: '',
        INQR_DVSN: '02',
        UNPR_DVSN: '01',
        FUND_STTL_ICLD_YN: 'N',
        FNCG_AMT_AUTO_RDPT_YN: 'N',
        PRCS_DVSN: '01',
        CTX_AREA_FK100: '',
        CTX_AREA_NK100: '',
      }),
      {
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          authorization: `Bearer ${token}`,
          appkey: hh.kis_app_key!,
          appsecret: hh.kis_app_secret!,
          tr_id: 'TTTC8434R',
        },
      },
    );
    debugRaw = await debugRes.json();
  } catch (err) {
    console.error('KIS 디버그 API 조회 실패:', err);
  }

  return NextResponse.json({
    synced,
    domestic: holdings.filter(h => h.market === 'domestic').length,
    foreign: holdings.filter(h => h.market === 'foreign').length,
    deleted: soldTickers.length,
    errors: apiErrors,
    debug: debugRaw,
  });
}
