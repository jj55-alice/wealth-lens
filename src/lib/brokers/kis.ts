/**
 * 한국투자증권 (KIS) OpenAPI 클라이언트
 * https://apiportal.koreainvestment.com
 *
 * OAuth2 토큰 관리 + 국내/해외 주식 보유 조회
 */

const KIS_BASE = 'https://openapi.koreainvestment.com:9443';

interface KisCredentials {
  appKey: string;
  appSecret: string;
  accountNo: string; // XXXXXXXX-XX 형식
  accessToken?: string | null;
  tokenExpiresAt?: string | null;
}

interface KisTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

export interface KisHolding {
  ticker: string;
  name: string;
  quantity: number;
  purchasePrice: number; // 매수 평균가 (원)
  currentPrice: number;
  market: 'domestic' | 'foreign';
  currency: 'KRW' | 'USD';
}

/**
 * OAuth2 access token 발급
 */
export async function getKisToken(appKey: string, appSecret: string): Promise<KisTokenResponse> {
  const res = await fetch(`${KIS_BASE}/oauth2/tokenP`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'client_credentials',
      appkey: appKey,
      appsecret: appSecret,
    }),
  });

  if (!res.ok) {
    const err = await res.text().catch(() => '');
    throw new Error(`KIS 토큰 발급 실패 (${res.status}): ${err.slice(0, 200)}`);
  }

  return res.json();
}

/**
 * 토큰이 유효한지 확인하고, 만료되었으면 재발급
 */
export async function ensureToken(
  creds: KisCredentials,
  onTokenRefresh: (token: string, expiresAt: string) => Promise<void>,
): Promise<string> {
  if (creds.accessToken && creds.tokenExpiresAt) {
    const expiresAt = new Date(creds.tokenExpiresAt);
    // 만료 1시간 전에 갱신
    if (expiresAt.getTime() - Date.now() > 60 * 60 * 1000) {
      return creds.accessToken;
    }
  }

  const tokenData = await getKisToken(creds.appKey, creds.appSecret);
  const expiresAt = new Date(Date.now() + tokenData.expires_in * 1000).toISOString();
  await onTokenRefresh(tokenData.access_token, expiresAt);
  return tokenData.access_token;
}

/**
 * 국내 주식 보유 조회 (TTTC8434R)
 */
async function fetchDomesticHoldings(
  token: string,
  appKey: string,
  appSecret: string,
  accountNo: string,
): Promise<KisHolding[]> {
  const [acctPrefix, acctSuffix] = accountNo.split('-');

  const res = await fetch(
    `${KIS_BASE}/uapi/domestic-stock/v1/trading/inquire-balance?` +
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
        appkey: appKey,
        appsecret: appSecret,
        tr_id: 'TTTC8434R',
      },
    },
  );

  if (!res.ok) {
    const err = await res.text().catch(() => '');
    throw new Error(`국내 주식 조회 실패 (${res.status}): ${err.slice(0, 200)}`);
  }

  const data = await res.json();

  if (data.rt_cd !== '0') {
    const msg = (data.msg1 || '').trim();
    if (msg.includes('금현물계좌')) {
      throw new Error('금현물 전용 계좌는 주식 조회가 불가합니다. 주식 계좌번호를 입력해주세요.');
    }
    throw new Error(`국내 조회 에러: ${msg || data.msg_cd || JSON.stringify(data).slice(0, 200)}`);
  }

  const items = data?.output1 ?? [];

  return items
    .filter((item: Record<string, string>) => Number(item.hldg_qty) > 0)
    .map((item: Record<string, string>) => ({
      ticker: item.pdno, // 종목코드 6자리
      name: item.prdt_name,
      quantity: Number(item.hldg_qty),
      purchasePrice: Math.round(Number(item.pchs_avg_pric)),
      currentPrice: Number(item.prpr),
      market: 'domestic' as const,
      currency: 'KRW' as const,
    }));
}

/**
 * 해외 주식 보유 조회 (TTTS3012R)
 */
async function fetchForeignHoldings(
  token: string,
  appKey: string,
  appSecret: string,
  accountNo: string,
): Promise<KisHolding[]> {
  const [acctPrefix, acctSuffix] = accountNo.split('-');

  const res = await fetch(
    `${KIS_BASE}/uapi/overseas-stock/v1/trading/inquire-balance?` +
    new URLSearchParams({
      CANO: acctPrefix,
      ACNT_PRDT_CD: acctSuffix,
      OVRS_EXCG_CD: 'NASD',
      TR_CRCY_CD: 'USD',
      CTX_AREA_FK200: '',
      CTX_AREA_NK200: '',
    }),
    {
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        authorization: `Bearer ${token}`,
        appkey: appKey,
        appsecret: appSecret,
        tr_id: 'TTTS3012R',
      },
    },
  );

  if (!res.ok) {
    const err = await res.text().catch(() => '');
    throw new Error(`해외 주식 조회 실패 (${res.status}): ${err.slice(0, 200)}`);
  }

  const data = await res.json();

  if (data.rt_cd !== '0') {
    throw new Error(`해��� 조회 에러: ${data.msg1 || data.msg_cd || JSON.stringify(data).slice(0, 200)}`);
  }

  const items = data?.output1 ?? [];

  // NYSE도 조회
  const resNyse = await fetch(
    `${KIS_BASE}/uapi/overseas-stock/v1/trading/inquire-balance?` +
    new URLSearchParams({
      CANO: acctPrefix,
      ACNT_PRDT_CD: acctSuffix,
      OVRS_EXCG_CD: 'NYSE',
      TR_CRCY_CD: 'USD',
      CTX_AREA_FK200: '',
      CTX_AREA_NK200: '',
    }),
    {
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        authorization: `Bearer ${token}`,
        appkey: appKey,
        appsecret: appSecret,
        tr_id: 'TTTS3012R',
      },
    },
  );

  if (resNyse.ok) {
    const nyseData = await resNyse.json();
    items.push(...(nyseData?.output1 ?? []));
  }

  return items
    .filter((item: Record<string, string>) => Number(item.ovrs_cblc_qty) > 0)
    .map((item: Record<string, string>) => ({
      ticker: item.ovrs_pdno, // 해외 종목 티커 (AAPL, MSFT 등)
      name: item.ovrs_item_name,
      quantity: Number(item.ovrs_cblc_qty),
      purchasePrice: Number(item.pchs_avg_pric),
      currentPrice: Number(item.now_pric2),
      market: 'foreign' as const,
      currency: 'USD' as const,
    }));
}

/**
 * 국내 + 해외 보유 주식 전체 조회 (병렬)
 */
export interface KisSyncResult {
  holdings: KisHolding[];
  errors: string[];
}

export async function fetchAllHoldings(
  token: string,
  appKey: string,
  appSecret: string,
  accountNo: string,
): Promise<KisSyncResult> {
  const errors: string[] = [];

  const [domestic, foreign] = await Promise.all([
    fetchDomesticHoldings(token, appKey, appSecret, accountNo).catch((e: Error) => {
      errors.push(`국내: ${e.message}`);
      return [] as KisHolding[];
    }),
    fetchForeignHoldings(token, appKey, appSecret, accountNo).catch((e: Error) => {
      errors.push(`해외: ${e.message}`);
      return [] as KisHolding[];
    }),
  ]);

  return { holdings: [...domestic, ...foreign], errors };
}
