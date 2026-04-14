#!/usr/bin/env node
/**
 * 홍보용 더미데이터 시드 스크립트
 *
 * 대상: ara@wealth-lens.app (기본값, --email 로 변경 가능)
 * 실행: node scripts/seed-promo-data.mjs
 *
 * 동작:
 *   1. auth.users에서 이메일로 사용자 조회
 *   2. 사용자의 기존 가구와 연결된 데이터 모두 삭제 (idempotent)
 *   3. 가구 생성 + 멤버 등록
 *   4. 증권/암호화폐 계좌 별칭 등록
 *   5. 포트폴리오 자산 11종 + 부채 1종 삽입
 *   6. 90일치 asset/household 스냅샷 삽입 (우상향 트렌드)
 *   7. 오늘 날짜 briefing_cards 1행 삽입
 *
 * 필요 환경변수: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// ============================================================
// env 로딩 (.env.local)
// ============================================================
const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dirname, '..', '.env.local');
try {
  const envFile = readFileSync(envPath, 'utf8');
  for (const line of envFile.split('\n')) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (!m) continue;
    let val = m[2].trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!process.env[m[1]]) process.env[m[1]] = val;
  }
} catch (e) {
  console.warn(`⚠️  .env.local 읽기 실패: ${e.message}`);
}

// ============================================================
// 인자 파싱
// ============================================================
const args = process.argv.slice(2);
let targetEmail = 'ara@wealth-lens.app';
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--email' && args[i + 1]) targetEmail = args[++i];
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('❌ NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 필요');
  process.exit(1);
}

const sb = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// ============================================================
// 헬퍼
// ============================================================
const log = (msg) => console.log(`  ${msg}`);
const step = (msg) => console.log(`\n▸ ${msg}`);

/** 이메일로 auth 사용자 조회 (admin.listUsers 페이지네이션) */
async function findUserByEmail(email) {
  let page = 1;
  const perPage = 200;
  while (true) {
    const { data, error } = await sb.auth.admin.listUsers({ page, perPage });
    if (error) throw error;
    const u = data.users.find((x) => x.email?.toLowerCase() === email.toLowerCase());
    if (u) return u;
    if (data.users.length < perPage) return null;
    page++;
    if (page > 20) return null;
  }
}

/** N일 전 날짜 문자열 (YYYY-MM-DD, KST 기준) */
function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

/** 시드가 있는 난수 (재현 가능한 노이즈) */
function seededRand(seed) {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

// ============================================================
// 포트폴리오 정의
// ============================================================
const USD_KRW = 1350;

/**
 * 각 자산: 매입가 < 현재가 (대체로 수익 중) — 홍보용
 * currentValue = manual_value는 수동 입력 기준, 시세 자동 종목은 quantity×현재가
 * 여기선 전부 manual 기준으로 stable한 평가액 주입
 */
const PORTFOLIO = [
  // ── 국내주식 (삼성증권) ─────────────────────────────
  { name: '삼성전자', ticker: '005930', category: 'stock', asset_class: 'domestic_equity',
    brokerage: '삼성증권', account_alias: '메인', quantity: 300, purchase_price: 68000,
    current_price: 78500 },
  { name: 'SK하이닉스', ticker: '000660', category: 'stock', asset_class: 'domestic_equity',
    brokerage: '삼성증권', account_alias: '메인', quantity: 50, purchase_price: 165000,
    current_price: 234000 },
  { name: 'NAVER', ticker: '035420', category: 'stock', asset_class: 'domestic_equity',
    brokerage: '삼성증권', account_alias: '메인', quantity: 25, purchase_price: 195000,
    current_price: 218500 },
  { name: '카카오', ticker: '035720', category: 'stock', asset_class: 'domestic_equity',
    brokerage: '삼성증권', account_alias: '메인', quantity: 100, purchase_price: 52000,
    current_price: 48200 },

  // ── 해외주식 (키움증권) ─────────────────────────────
  { name: 'Apple', ticker: 'AAPL', category: 'stock', asset_class: 'foreign_equity',
    brokerage: '키움증권', account_alias: '해외', quantity: 50,
    purchase_price: 165 * USD_KRW, current_price: 228 * USD_KRW },
  { name: 'NVIDIA', ticker: 'NVDA', category: 'stock', asset_class: 'foreign_equity',
    brokerage: '키움증권', account_alias: '해외', quantity: 30,
    purchase_price: 420 * USD_KRW, current_price: 875 * USD_KRW },
  { name: 'Microsoft', ticker: 'MSFT', category: 'stock', asset_class: 'foreign_equity',
    brokerage: '키움증권', account_alias: '해외', quantity: 20,
    purchase_price: 380 * USD_KRW, current_price: 448 * USD_KRW },

  // ── ETF (미래에셋증권) ─────────────────────────────
  { name: 'TIGER 미국S&P500', ticker: '360750', category: 'stock', asset_class: 'foreign_equity',
    brokerage: '미래에셋증권', account_alias: 'ETF', quantity: 500,
    purchase_price: 15800, current_price: 18250 },
  { name: 'KODEX 200', ticker: '069500', category: 'stock', asset_class: 'domestic_equity',
    brokerage: '미래에셋증권', account_alias: 'ETF', quantity: 200,
    purchase_price: 36000, current_price: 38600 },

  // ── 암호화폐 (업비트) ──────────────────────────────
  { name: '비트코인', ticker: 'BTC', category: 'crypto', asset_class: 'crypto',
    brokerage: '업비트', account_alias: '메인', quantity: 0.85,
    purchase_price: 42000000, current_price: 95000000 },
  { name: '이더리움', ticker: 'ETH', category: 'crypto', asset_class: 'crypto',
    brokerage: '업비트', account_alias: '메인', quantity: 5,
    purchase_price: 2800000, current_price: 4500000 },
];

// 수동 평가 자산 (시세 없음)
const MANUAL_ASSETS = [
  { name: '마포 래미안', category: 'real_estate', subcategory: 'owned',
    asset_class: 'real_estate', manual_value: 1_180_000_000, purchase_price: 920_000_000,
    address: '서울특별시 마포구' },
  { name: '한국투자 IRP', category: 'pension', subcategory: 'irp',
    asset_class: 'domestic_equity', brokerage: '한국투자증권',
    manual_value: 45_000_000, purchase_price: 38_000_000 },
  { name: '비상금', category: 'cash', subcategory: 'savings',
    asset_class: 'cash_equiv', manual_value: 30_000_000 },
];

const LIABILITY = {
  name: '마포 주담대',
  category: 'mortgage',
  balance: 520_000_000,
  interest_rate: 3.85,
};

// ============================================================
// 메인
// ============================================================
async function main() {
  console.log(`\n🎯 홍보용 시드 시작 — 대상: ${targetEmail}\n`);

  step('1. 사용자 조회');
  const user = await findUserByEmail(targetEmail);
  if (!user) {
    console.error(`❌ ${targetEmail} 계정을 찾을 수 없습니다. Supabase Auth에 먼저 가입하세요.`);
    process.exit(1);
  }
  log(`✓ user_id: ${user.id}`);

  step('2. 기존 가구 데이터 정리');
  const { data: existingMembers } = await sb
    .from('household_members')
    .select('household_id')
    .eq('user_id', user.id);
  if (existingMembers && existingMembers.length > 0) {
    const hhIds = existingMembers.map((m) => m.household_id);
    log(`기존 가구 ${hhIds.length}개 삭제 중... (cascade)`);
    const { error } = await sb.from('households').delete().in('id', hhIds);
    if (error) throw error;
    log(`✓ 정리 완료`);
  } else {
    log(`기존 가구 없음`);
  }

  step('3. 가구 생성');
  const { data: hh, error: hhErr } = await sb
    .from('households')
    .insert({ name: '홍보용 포트폴리오' })
    .select()
    .single();
  if (hhErr) throw hhErr;
  log(`✓ household_id: ${hh.id}`);

  step('4. 멤버 등록 (owner)');
  {
    const { error } = await sb
      .from('household_members')
      .insert({ household_id: hh.id, user_id: user.id, role: 'owner' });
    if (error) throw error;
    log(`✓ owner 등록`);
  }

  step('5. 계좌 별칭 등록');
  const accountRows = [
    { user_id: user.id, household_id: hh.id, brokerage: '삼성증권', alias: '메인' },
    { user_id: user.id, household_id: hh.id, brokerage: '키움증권', alias: '해외' },
    { user_id: user.id, household_id: hh.id, brokerage: '미래에셋증권', alias: 'ETF' },
    { user_id: user.id, household_id: hh.id, brokerage: '업비트', alias: '메인' },
    { user_id: user.id, household_id: hh.id, brokerage: '한국투자증권', alias: 'IRP' },
  ];
  {
    const { error } = await sb.from('household_accounts').insert(accountRows);
    if (error) throw error;
    log(`✓ ${accountRows.length}개 계좌 등록`);
  }

  step('6. 포트폴리오 자산 삽입');
  const assetIds = [];
  const assetMeta = [];

  for (const p of PORTFOLIO) {
    const manual_value = p.quantity * p.current_price;
    const { data, error } = await sb
      .from('assets')
      .insert({
        household_id: hh.id,
        owner_user_id: user.id,
        category: p.category,
        subcategory: null,
        ownership: 'personal',
        name: p.name,
        ticker: p.ticker,
        quantity: p.quantity,
        manual_value,
        purchase_price: p.purchase_price,
        price_source: 'manual', // 시드용은 manual 고정 (API 호출 회피)
        asset_class: p.asset_class,
        brokerage: p.brokerage,
        account_alias: p.account_alias,
      })
      .select()
      .single();
    if (error) throw error;
    assetIds.push(data.id);
    assetMeta.push({ id: data.id, value: manual_value, ticker: p.ticker });
    log(`✓ ${p.name} (${p.ticker}) — ₩${manual_value.toLocaleString('ko-KR')}`);
  }

  for (const a of MANUAL_ASSETS) {
    const { data, error } = await sb
      .from('assets')
      .insert({
        household_id: hh.id,
        owner_user_id: user.id,
        category: a.category,
        subcategory: a.subcategory ?? null,
        ownership: 'personal',
        name: a.name,
        manual_value: a.manual_value,
        purchase_price: a.purchase_price ?? null,
        price_source: 'manual',
        asset_class: a.asset_class,
        brokerage: a.brokerage ?? null,
        address: a.address ?? null,
      })
      .select()
      .single();
    if (error) throw error;
    assetIds.push(data.id);
    assetMeta.push({ id: data.id, value: a.manual_value, ticker: null });
    log(`✓ ${a.name} — ₩${a.manual_value.toLocaleString('ko-KR')}`);
  }

  step('7. 부채 삽입');
  let liabilityId = null;
  {
    const { data, error } = await sb
      .from('liabilities')
      .insert({
        household_id: hh.id,
        owner_user_id: user.id,
        category: LIABILITY.category,
        name: LIABILITY.name,
        balance: LIABILITY.balance,
        interest_rate: LIABILITY.interest_rate,
        ownership: 'personal',
      })
      .select()
      .single();
    if (error) throw error;
    liabilityId = data.id;
    log(`✓ ${LIABILITY.name} — ₩${LIABILITY.balance.toLocaleString('ko-KR')}`);
  }

  step('8. 90일치 자산 스냅샷 생성 (우상향 트렌드)');
  const rand = seededRand(42);
  const DAYS = 90;
  const assetSnapshots = [];
  const liabilitySnapshots = [];
  const householdSnapshots = [];

  for (let d = DAYS; d >= 0; d--) {
    const dateStr = daysAgo(d);
    const progress = (DAYS - d) / DAYS; // 0 → 1
    // 자산별 스냅샷: 시작 85% → 현재 100%, ±2% 일일 노이즈
    let totalAssets = 0;
    for (const m of assetMeta) {
      const noise = (rand() - 0.5) * 0.04;
      const factor = 0.85 + progress * 0.15 + noise;
      const value = Math.round(m.value * factor);
      assetSnapshots.push({ asset_id: m.id, value, snapshot_date: dateStr });
      totalAssets += value;
    }
    // 부채는 매달 약간씩 감소 (원리금 상환)
    const monthsFromStart = (DAYS - d) / 30;
    const liabBalance = Math.round(LIABILITY.balance + 1_500_000 * (DAYS - d) / DAYS - 1_500_000 * monthsFromStart * 0);
    // 단순화: 시작 524M → 현재 520M 선형 감소
    const liabNow = Math.round(524_000_000 - 4_000_000 * progress);
    liabilitySnapshots.push({
      liability_id: liabilityId,
      balance: liabNow,
      snapshot_date: dateStr,
    });
    householdSnapshots.push({
      household_id: hh.id,
      total_assets: totalAssets,
      total_liabilities: liabNow,
      net_worth: totalAssets - liabNow,
      snapshot_date: dateStr,
    });
  }

  // 청크 단위 insert (Supabase row limit 방지)
  const chunk = (arr, n) => {
    const out = [];
    for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
    return out;
  };

  for (const c of chunk(assetSnapshots, 500)) {
    const { error } = await sb.from('asset_snapshots').insert(c);
    if (error) throw error;
  }
  log(`✓ asset_snapshots ${assetSnapshots.length}행`);

  for (const c of chunk(liabilitySnapshots, 500)) {
    const { error } = await sb.from('liability_snapshots').insert(c);
    if (error) throw error;
  }
  log(`✓ liability_snapshots ${liabilitySnapshots.length}행`);

  for (const c of chunk(householdSnapshots, 500)) {
    const { error } = await sb.from('household_snapshots').insert(c);
    if (error) throw error;
  }
  log(`✓ household_snapshots ${householdSnapshots.length}행`);

  step('9. AI 브리핑 카드 삽입 (오늘자)');
  const briefingCards = [
    {
      ticker: 'NVDA',
      name: 'NVIDIA',
      signal: 'opportunity',
      headline: '블랙웰 수요 여전히 견조, 데이터센터 매출 가이던스 상향',
      context:
        '지난 실적 발표에서 데이터센터 매출이 전년 동기 대비 112% 성장했습니다. 보유 중인 30주(평가액 약 3,541만원)는 매입가 대비 +108% 수익 중이며, AI 인프라 투자 사이클이 2026년까지 이어질 경우 추가 상승 여력이 있습니다.',
      news_urls: ['https://www.nvidia.com/en-us/about-nvidia/press-releases/'],
      feedback: null,
    },
    {
      ticker: '035720',
      name: '카카오',
      signal: 'risk',
      headline: '플랫폼 규제 논의 재점화, 단기 변동성 주의',
      context:
        '공정위의 온라인 플랫폼 규제 법안이 재논의되며 카카오·네이버 중심으로 투자 심리가 악화됐습니다. 보유 100주는 현재 -7.3% 손실 구간입니다. 장기 보유 계획이 아니라면 손절 또는 분할 매도를 검토해볼 시점입니다.',
      news_urls: [],
      feedback: null,
    },
    {
      ticker: 'BTC',
      name: '비트코인',
      signal: 'opportunity',
      headline: 'ETF 순유입 3주 연속, 9.5만 달러 저항선 근접',
      context:
        '미국 현물 ETF로의 순유입이 3주 연속 기록되고 있습니다. 보유 0.85 BTC는 매입가 대비 +126% 수익 중으로, 전체 포트폴리오에서 비중이 11%까지 올랐습니다. 리밸런싱을 고려할 수 있는 구간입니다.',
      news_urls: [],
      feedback: null,
    },
    {
      ticker: '005930',
      name: '삼성전자',
      signal: 'neutral',
      headline: 'HBM3E 양산 본격화, 실적은 4분기부터 반영 전망',
      context:
        '엔비디아향 HBM3E 공급이 본격화되는 것으로 전해지나, 실적 반영은 4분기부터 가시화될 전망입니다. 보유 300주는 +15.4% 수익 중이며 현 포지션 유지가 합리적입니다.',
      news_urls: [],
      feedback: null,
    },
  ];

  // 오늘자 카드가 이미 있으면 덮어쓰기
  await sb.from('briefing_cards').delete().eq('household_id', hh.id).eq('date', daysAgo(0));

  {
    const { error } = await sb.from('briefing_cards').insert({
      household_id: hh.id,
      date: daysAgo(0),
      cards: briefingCards,
      model: 'claude-sonnet-4-6',
      status: 'success',
      input_tokens: 4250,
      output_tokens: 1180,
      cost_usd: 0.0342,
    });
    if (error) throw error;
    log(`✓ 브리핑 카드 ${briefingCards.length}개 삽입`);
  }

  // ── 요약 ──────────────────────────────────────────
  const latest = householdSnapshots[householdSnapshots.length - 1];
  console.log(`\n✅ 시드 완료\n`);
  console.log(`   가구:        ${hh.name} (${hh.id})`);
  console.log(`   자산:        ${assetIds.length}종 — ₩${latest.total_assets.toLocaleString('ko-KR')}`);
  console.log(`   부채:        1종 — ₩${latest.total_liabilities.toLocaleString('ko-KR')}`);
  console.log(`   순자산:      ₩${latest.net_worth.toLocaleString('ko-KR')}`);
  console.log(`   스냅샷:      ${DAYS + 1}일치`);
  console.log(`   브리핑:      ${briefingCards.length}장 카드\n`);
  console.log(`   → ${targetEmail} 로그인 후 /dashboard 확인`);
}

main().catch((e) => {
  console.error('\n❌ 시드 실패:', e.message || e);
  if (e.details) console.error('   details:', e.details);
  if (e.hint) console.error('   hint:', e.hint);
  process.exit(1);
});
