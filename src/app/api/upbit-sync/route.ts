import { createClient } from '@supabase/supabase-js';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { getSupabaseUrl, getServiceRoleKey } from '@/lib/env';
import { NextResponse } from 'next/server';
import crypto from 'crypto';

function createUpbitJwt(accessKey: string, secretKey: string): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({
    access_key: accessKey,
    nonce: crypto.randomUUID(),
    timestamp: Date.now(),
  })).toString('base64url');

  const signature = crypto
    .createHmac('sha256', secretKey)
    .update(`${header}.${payload}`)
    .digest('base64url');

  return `${header}.${payload}.${signature}`;
}

export async function POST() {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: '인증 필요' }, { status: 401 });
  }

  const supabaseAdmin = createClient(getSupabaseUrl(), getServiceRoleKey());

  const { data: membership } = await supabaseAdmin
    .from('household_members')
    .select('household_id, households(upbit_access_key, upbit_secret_key)')
    .eq('user_id', user.id)
    .single();

  if (!membership?.households) {
    return NextResponse.json({ error: '가구 없음' }, { status: 404 });
  }

  const hh = membership.households as unknown as {
    upbit_access_key: string | null;
    upbit_secret_key: string | null;
  };

  if (!hh.upbit_access_key || !hh.upbit_secret_key) {
    return NextResponse.json({ skipped: true, reason: 'no_keys' });
  }

  // Upbit 잔고 조회
  const token = createUpbitJwt(hh.upbit_access_key, hh.upbit_secret_key);

  let accounts;
  try {
    const res = await fetch('https://api.upbit.com/v1/accounts', {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) {
      const errBody = await res.text().catch(() => '');
      return NextResponse.json({
        error: `Upbit API 오류 (${res.status}): ${errBody.slice(0, 100)}`,
      }, { status: 400 });
    }

    accounts = await res.json();
  } catch {
    return NextResponse.json({ error: 'Upbit API 연결 실패' }, { status: 500 });
  }

  // KRW 마켓 코인만 (잔고가 0보다 큰 것)
  const holdings = (accounts as Array<{
    currency: string;
    balance: string;
    avg_buy_price: string;
    unit_currency: string;
  }>).filter(a =>
    a.unit_currency === 'KRW' &&
    a.currency !== 'KRW' &&
    Number(a.balance) > 0
  );

  const householdId = membership.household_id;
  let synced = 0;

  for (const h of holdings) {
    const ticker = h.currency; // BTC, ETH, etc.
    const quantity = Number(h.balance);
    const avgBuyPrice = Math.round(Number(h.avg_buy_price));

    // 기존 코인 자산 확인
    const { data: existing } = await supabaseAdmin
      .from('assets')
      .select('id')
      .eq('household_id', householdId)
      .eq('ticker', ticker)
      .eq('category', 'crypto')
      .maybeSingle();

    if (existing) {
      // 수량과 매수가 업데이트
      await supabaseAdmin
        .from('assets')
        .update({
          quantity,
          purchase_price: avgBuyPrice > 0 ? avgBuyPrice : null,
        })
        .eq('id', existing.id);
    } else {
      // 새로 등록
      await supabaseAdmin
        .from('assets')
        .insert({
          household_id: householdId,
          owner_user_id: user.id,
          category: 'crypto',
          name: ticker,
          ticker,
          quantity,
          purchase_price: avgBuyPrice > 0 ? avgBuyPrice : null,
          brokerage: '업비트',
          price_source: 'upbit',
          asset_class: 'crypto',
        });
    }
    synced++;
  }

  // KRW 잔고도 현금으로 동기화
  const krwAccount = (accounts as Array<{ currency: string; balance: string }>)
    .find(a => a.currency === 'KRW');
  if (krwAccount && Number(krwAccount.balance) > 0) {
    const krwBalance = Math.round(Number(krwAccount.balance));
    const { data: existingKrw } = await supabaseAdmin
      .from('assets')
      .select('id')
      .eq('household_id', householdId)
      .eq('name', '업비트 KRW')
      .eq('category', 'cash')
      .maybeSingle();

    if (existingKrw) {
      await supabaseAdmin
        .from('assets')
        .update({ manual_value: krwBalance })
        .eq('id', existingKrw.id);
    } else {
      await supabaseAdmin
        .from('assets')
        .insert({
          household_id: householdId,
          owner_user_id: user.id,
          category: 'cash',
          name: '업비트 KRW',
          manual_value: krwBalance,
          brokerage: '업비트',
          price_source: 'manual',
          asset_class: 'cash_equiv',
        });
    }
  }

  // 매도 완료된 코인 정리 (quantity=0)
  // API 응답에서 보유 중인 ticker 목록
  const holdingTickers = new Set(holdings.map(h => h.currency));
  const { data: allCryptoAssets } = await supabaseAdmin
    .from('assets')
    .select('id, ticker, quantity')
    .eq('household_id', householdId)
    .eq('category', 'crypto')
    .eq('brokerage', '업비트');

  if (allCryptoAssets) {
    for (const asset of allCryptoAssets) {
      // quantity가 0이거나, API에서 보유 중이 아닌 경우에만 제거 (안전: quantity=0만)
      if (asset.quantity !== null && Number(asset.quantity) === 0) {
        await supabaseAdmin.from('assets').delete().eq('id', asset.id);
      }
    }
  }

  // 시세 갱신 — 동기화한 코인의 시세를 price_cache에 저장
  try {
    const { fetchPricesBatch } = await import('@/lib/prices');
    const priceItems = holdings.map(h => ({ ticker: h.currency, source: 'upbit' as const }));
    const prices = await fetchPricesBatch(priceItems);
    for (const [ticker, result] of prices) {
      await supabaseAdmin.from('price_cache').upsert(
        { ticker, price: result.price, currency: result.currency, source: result.source, fetched_at: new Date().toISOString() },
        { onConflict: 'ticker' },
      );
    }
  } catch (err) {
    console.error('Upbit 시세 갱신 실패:', err);
  }

  return NextResponse.json({ synced, holdings: holdings.length });
}
