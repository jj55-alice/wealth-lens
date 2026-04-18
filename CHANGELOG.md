# Changelog

All notable changes to Wealth Lens will be documented in this file.

## [0.2.0.0] - 2026-04-18

### Added — 자산목록 페이지 (`/assets`) 신설
대시보드가 "요약·차트·알림" 공간이 되고, `자산 목록`은 전용 페이지로 분리되었습니다. 자산 목록에서는 주식을 **계좌유형별(연금저축/ISA/IRP/우리사주/일반)**로 1차 그룹화해서 각 그룹 합계를 한눈에 볼 수 있습니다. 그룹 정렬은 자산 규모 내림차순 — 집중도 높은 곳부터 보입니다. 비주식 자산은 기존 카테고리 그룹화를 유지합니다. 대시보드 상단 네비에 `💰 자산` 탭이 추가되고 모바일 하단 네비도 동기화되었습니다.

- 새 페이지 `src/app/assets/page.tsx` (서버 컴포넌트) + `src/components/assets-view.tsx` (클라이언트 — 소유자 필터).
- `AssetList` 컴포넌트에 `groupBy: 'category' | 'accountType'` prop 추가. 기존 대시보드 사용처는 `category`로 유지.
- 매수가 미입력 주식 배너 + 편집 링크가 `/assets` 상단에 표시됩니다.

### Changed — 계좌유형이 자산이 아닌 "계좌"의 속성이 됨
같은 키움증권 ISA 계좌에 들어있는 종목은 모두 같은 세제 혜택을 받습니다. 그런데 기존엔 계좌유형이 주식 자산 단위에 저장돼서, 같은 계좌 안 종목이 서로 다른 유형으로 등록되는 불일치가 가능했습니다. 이제 계좌유형은 `household_accounts` 테이블의 속성입니다.

- DB 마이그레이션 `20260418000001_account_type.sql`: `household_accounts.account_type` 컬럼 추가 (`pension/isa/irp/espp/other`, 기본 `other`). 기존 `assets.subcategory` 값을 `(user_id, brokerage, alias)` 매칭으로 backfill (같은 계좌에 값이 여러 개면 최신 자산 우선). 매칭 실패는 `other` 기본값.
- `/api/accounts` GET/POST에 `account_type` 필드 반영 + 유효성 검증.
- 설정 → 주식 계좌 관리에 계좌유형 Select 추가, 계좌 리스트에 유형 배지 표시.
- 자산 등록·편집 폼에서 "계좌 유형" Select 제거. 내 계좌 빠른 선택 버튼에 유형 배지 노출. 계좌 선택 시 `subcategory`가 해당 계좌의 `account_type`으로 자동 세팅됩니다.

### Changed — 히스토리 페이지에 "기간별 변동" 카드 추가
기간별 변동(1일/1달/3달/6달/1년)이 원래 수익률 페이지에 있었는데, "순자산 시계열" 맥락에 더 잘 맞는 히스토리 페이지로 옮겼습니다. `household_snapshots` 기반으로 계산되며, 해당 기간 스냅샷이 없으면 행 자체가 숨겨집니다. "순자산 기준"임이 라벨에 명시됩니다.

- `src/app/history/page.tsx`에 `findNearestSnapshotAsc` + `computePeriodChanges` 추가. `/api/snapshot`이 ASC 정렬로 반환하는 것에 맞춰 재작성.

### Removed — 수익률 페이지(`/returns`) 삭제
`/returns` 페이지는 (1) 전체 수익률 요약 (2) 기간별 변동 (3) 종목별 수익률 — 3가지를 섞어 보여줬습니다. (1)(3)은 이미 `/stocks`에 더 완성된 형태로 존재하고, (2)는 히스토리로 이동했습니다. 북마크/외부 링크는 404 처리됩니다.

- `src/app/returns/page.tsx` 삭제.
- 대시보드 헤더 + 모바일 네비의 `/returns` 링크 제거.
- 대시보드에서 `자산 목록` 카드는 `자산 목록 보러가기 →` 링크 카드로 대체되어 역할이 분리됩니다.

## [0.1.6.0] - 2026-04-10

### Added — Pace decomposition: 어제 → 오늘 순자산 변동 분해
하루치 순자산 변동을 "기여(매수·매도)" vs "시장 변동(가격 움직임)" 두 축으로 자동 분해합니다. 주식이 떨어졌는데 잔고가 늘었다면, 그게 본인이 더 샀기 때문인지 시장이 올라서인지 한 줄로 알 수 있습니다. 브리핑 카드 상단에 요약 바가 노출되고, 동일 정보가 LLM 프롬프트에도 컨텍스트로 들어가서 카피가 "매수 기여"와 "시장 변동"을 혼동하지 않습니다.

- **DB 스키마**: `asset_snapshots`에 `quantity`/`price` 컬럼 추가, `briefing_cards`에 `pace jsonb` 컬럼 추가. 기존 행은 NULL 허용 — 첫날엔 분해 불가능하지만 다음날부터 정상 동작.
- **스냅샷 경로 통일**: cron(`/api/cron`)과 수동 스냅샷(`/api/snapshot`) 두 진입점 모두 새 컬럼을 채우도록 정리. `quantity != null` 체크로 0 수량도 보존.
- **분해 엔진** (`src/lib/briefing/pace.ts`): 순수 함수.
  - `Δvalue = prior.qty × (to.price − from.price)` (시장) + `(to.qty − prior.qty) × to.price` (기여)
  - prior 없는 자산 → `new_asset`, today 없는 자산 → `removed_asset`, NULL 수량/가격 → `missing_*` — 분해 불가는 `unknownDelta`로 별도 집계.
- **브리핑 파이프라인 연결**: `/api/briefing/generate`가 가장 최근 두 스냅샷 날짜를 자동 조회해서 분해 → `briefing_cards.pace`에 jsonb 저장. 실패해도 브리핑 자체엔 영향 없도록 격리.
- **UI** (`src/components/briefing-cards.tsx`): `PaceSummaryBar` 컴포넌트로 총 변동 ±₩X, 기여/시장 2색 분포 바, "주로 매수 기여" / "주로 시장 상승" 같은 지배 요인 라벨. LLM 카드가 0개여도 pace 요약 단독 노출.
- **LLM 컨텍스트 주입** (`src/lib/briefing/prompts.ts`): user 프롬프트 최상단에 "최근 1일 순자산 변동" 섹션 + 주요 움직임 상위 3개 자산. 카피 가이드: "시장이 올랐다"를 본인 매수 때문인 변동에 잘못 쓰지 말라는 명시적 지시.

## [0.1.5.0] - 2026-04-09

### Changed — Vercel 배포 성능 개선 (체감 LCP 2~4s → 1s 목표)
프로덕션에서 대시보드가 너무 느리다는 문제를 조사해 3개 근본 원인을 찾아 한 번에 수정했습니다. 주요 병목은 (1) proxy가 모든 요청마다 Supabase Auth 왕복 2회, (2) 대시보드가 통째로 클라이언트 컴포넌트라 5~7개 네트워크 요청을 브라우저에서 직렬로 실행, (3) recharts 차트 전체가 초기 JS 번들에 포함된 것이었습니다.

- **proxy 중복 auth 제거** (`src/proxy.ts`): `updateSession()`이 이미 `getUser()`를 호출하는데 루트 경로에서 또 한 번 호출하던 중복 제거. `updateSession`이 user를 함께 반환하도록 변경. matcher에 폰트/CSS/JS/cron 추가 제외 → 모든 요청 TTFB 약 0.4~0.8초 단축 기대.
- **대시보드 서버 컴포넌트 전환** (`src/app/dashboard/page.tsx`): `'use client'` + `useEffect` 안의 직렬 워터폴을 서버 컴포넌트 + `Promise.all` 병렬 fetch로 재작성. assets, liabilities, members, snapshots, 환율을 한 번에 병렬 로딩. 서버↔Supabase는 브라우저↔Supabase보다 훨씬 빠름. HTML이 데이터까지 포함해서 한 번에 내려옴 → LCP 약 1.5~2.5초 단축 기대.
- **차트 dynamic import** (`src/components/dashboard-view.tsx`): recharts 기반 `AssetPieChart`, `AllocationPieChart`, `ChangeAttribution`, `GoalProjection`, `BriefingCards`, `MonthlyChange`를 `next/dynamic({ ssr: false })` 로 lazy load. 로딩 중 Skeleton fallback. 초기 JS 번들 축소.
- **next.config.ts**: `experimental.optimizePackageImports` 에 recharts, lucide-react, @base-ui/react 추가 → 사용 안 하는 export tree-shake.
- **queries.ts 확장**: `getHouseholdMembers`, `getMonthlyGrowth` 신규 추가. `getHouseholdAssets`가 부동산 `kb_estimated_value` 처리. `getUserHousehold(userId)` 옵션 인자로 중복 `getUser()` 방지.
- **DashboardView**: `onMutate` 미지정 시 `router.refresh()` 로 폴백 → 서버 컴포넌트 재검증 패턴 지원. 가격/부동산 새로고침 시 자동으로 서버 데이터 다시 불러옴.
- **첫 로그인 가구 생성**: 드문 케이스는 `DashboardBootstrap` client 컴포넌트로 분리해서 `/api/household` POST 후 `router.refresh()`.

### Fixed — MilestoneCheck 및 대시보드 데이터 정합성
- **대시보드 query에 `goal_net_worth`, `goal_annual_dividend` 포함**: 목표 진행률 계산에 필요한 컬럼이 빠져있던 문제.
- **MilestoneCheck 사용자 목표 우선**: 가구 설정보다 사용자 개인 목표를 먼저 사용하도록 수정. 이후 컴포넌트 자체는 제거.
- **시세 갱신 버튼이 업비트 잔고도 동기화**: 기존엔 가격만 갱신했는데, 이제 `/api/upbit-sync` 도 같이 호출해서 보유 수량까지 최신화. 업비트 키 미설정/실패해도 시세 갱신은 계속 진행.

## [0.1.4.0] - 2026-04-07

### Added — 보유 종목 AI 브리핑 (Phase 4 MVP, B-lite)
매일 06:00 KST에 보유 주식·코인 관련 뉴스를 가져와서 Anthropic Claude가 사용자 포트폴리오 컨텍스트(매수가, 비중, 수익률)와 함께 분석한 인사이트 카드를 대시보드 상단에 표시합니다. 토스/네이버 같은 일반 증권 앱과 달리 본인 보유 종목에만 집중한 개인화된 신호.

- **DB**: `briefing_cards` 테이블 + 측정 인프라 컬럼 (`status`, `input_tokens`, `output_tokens`, `cost_usd`, `error_message`). RLS는 가구 멤버 SELECT/UPDATE만, INSERT는 service role(cron) 전용.
- **lib/news**: 네이버 종목 뉴스 + Yahoo Finance RSS fetch. 24시간 필터, 부분 실패 허용 (한 종목 fetch 실패해도 전체 진행).
- **lib/briefing**: Anthropic SDK 직접 호출. 한국어 출력, JSON 형식 강제. **액션 phrase 자동 필터**: "추가 매수", "매도 권장", "팔아라" 등 차단. 정상 단어("매수가", "매도세")는 통과. 카드 5장 cap.
- **API**:
  - `POST /api/briefing/generate` — cron 호출 (CRON_SECRET 검증). 가구별 보유 종목 → 뉴스 → LLM → upsert.
  - `GET /api/briefing/today` — 본인 가구 가장 최근 카드. stale 판정 포함.
  - `POST /api/briefing/feedback` — 카드별 👍/👎 (1/-1/null). 본인 가구 검증.
- **Cron**: `vercel.json`에 매일 21:00 UTC (=06:00 KST 다음날) 등록.
- **UI**: `BriefingCards` 컴포넌트 — 신호별 색상(amber 주의 / emerald 기회 / muted 참고), 피드백 버튼, 원본 뉴스 링크, footnote disclaimer, 실패 배너, stale 표시. 대시보드 Net Worth 카드 직후 노출 (ownerFilter='all'일 때만).
- **Tests**: 9 evals — JSON 파싱, 마크다운 펜스, 액션 phrase 필터, 정상 단어 통과, signal 검증, 5장 cap, Yahoo RSS 파싱.

### Scope (CEO 리뷰 후 조정)
- **포함**: 일일 카드 + 측정 인프라 + 피드백 버튼 + cron 실패 배너 + 액션 phrase 금지 + evals
- **NOT in scope (1주 dogfood 후 결정)**: 종목 상세 모달, on-demand AI 분석, 챗봇, DART 공시, 이메일 알림

### 환경변수 (배포 필수)
- `ANTHROPIC_API_KEY` — Claude API 키. Vercel + 로컬 .env 양쪽 필요.
- `CRON_SECRET` (옵션) — Vercel cron 인증. 미설정 시 dev mode에서만 호출 가능.

## [0.1.3.9] - 2026-04-07

### Fixed
- **다른 계좌인데도 종목이 합쳐지던 문제**: 자산 등록 시 같은 ticker의 기존 자산이 있으면 합치는 로직이 매칭 키에 `brokerage`만 보고 `account_alias`는 무시했음. 그래서 같은 키움증권의 "메인"과 "ISA" 계좌가 하나로 합쳐졌음. 매칭 키에 `account_alias`를 추가해서 같은 (owner + 금융사 + 별칭)일 때만 합치도록 fix (`src/app/assets/new/page.tsx`).

## [0.1.3.8] - 2026-04-07

### Fixed
- **계좌가 어디에서도 표시되지 않던 문제**: `/api/accounts`가 server-side Supabase client + RLS에 의존했는데, 서버 측에서 사용자 세션이 제대로 전달되지 않거나 RLS 정책 평가에 문제가 있어서 빈 응답이 나가던 것으로 추정. `/api/invite`, `/api/prices` 등 다른 API와 동일하게 **service role admin client**로 변경. 인증은 server client로 검증하고, 데이터 query는 admin client가 담당. household_id 기반 명시적 필터로 다른 가구 데이터 노출 방지 (`src/app/api/accounts/route.ts`).

## [0.1.3.7] - 2026-04-07

### Fixed
- **6개 계좌를 다시 아라(jj55.alice@gmail.com)로 되돌림**: v0.1.3.6에서 본인을 잘못 추정해 희성으로 옮긴 것을 원래대로 b0568ba4로 되돌림. (사용자 본인이 아라.)
- **소유자 셀렉트박스가 hash로 표시되던 문제**: shadcn/Radix `<SelectValue>`가 옵션이 mount되기 전에는 raw value(user_id)를 표시할 수 있어서 hash가 보였음. `<SelectValue>` children에 `memberLabel(targetUserId)` 명시해 항상 닉네임이 표시되도록 fix (`src/app/settings/page.tsx`).

## [0.1.3.6] - 2026-04-07

### Fixed
- **계좌 6개를 본인(희성) 소유로 마이그레이션**: v0.1.3.2 마이그레이션이 가구 owner를 추정해서 첫 번째 멤버(아라)에게 잘못 할당했던 문제. 6개 계좌(키움 해외/연금/ISA, 현대차 국내, 기타 우리사주, 신한 IRP)를 모두 thanatosv@naver.com (희성)로 직접 교정.
- **계좌 소유자 라벨이 user_id hash로 표시되던 문제**: `memberLabel`이 닉네임 우선으로 되돌아감 (v0.1.3.5에서 email 우선으로 잘못 변경했던 것). 폴백은 이메일의 `@` 앞부분.
- **자산 등록/수정 퀵픽이 owner 변경에 반응 안 하던 문제**: ownerUserId 변경 시마다 fetch하는 구조가 stale 응답이나 race를 만들 수 있어, 가구 전체 계좌(`?owner=all`)를 한 번만 fetch하고 클라이언트에서 `user_id`로 즉시 필터링. owner 클릭 즉시 갱신, 캐시 우려도 사라짐 (`cache: 'no-store'` 강제).

## [0.1.3.5] - 2026-04-07

### Changed
- **계좌 관리 멤버 라벨이 이메일 우선 표시**: 닉네임 대신 가입한 이메일(아이디)를 우선 노출. 같은 이름의 가족이 있어도 헷갈리지 않음. 본인 옆에는 "(나)" 표시 (`src/app/settings/page.tsx`).

## [0.1.3.4] - 2026-04-07

### Fixed
- **가족 구성원 계좌 등록 불가**: v0.1.3.2에서 계좌를 user_id 단위로 분리한 게 너무 strict해서, 가구 owner가 배우자의 계좌를 미리 등록해줄 방법이 없었음. RLS 정책을 "같은 가구 멤버는 모두 조회/생성/삭제 가능"으로 변경하고, API에 `?owner=<user_id>` 필터 + POST body의 `user_id` 지정 지원 추가. 표시 시 분리는 UI/API 레이어에서 담당 (`supabase/migrations/20260408000003_account_household_visible.sql`).

### Changed
- **Settings 계좌 관리에 소유자 선택**: 가구 멤버가 2명 이상이면 "소유자" 셀렉트가 노출되어, 내 계좌든 배우자 계좌든 한 화면에서 등록 가능. 등록된 계좌는 멤버별로 그룹핑되어 표시 (`src/app/settings/page.tsx`).
- **자산 등록/수정 퀵픽이 owner 기준으로 fetch**: 자산 소유자가 바뀌면 그 사람 명의의 계좌만 퀵픽에 표시. 부부가 한 화면에서 작업할 때 헷갈리지 않음.

## [0.1.3.3] - 2026-04-07

### Fixed
- **금 시세 추출 약 1.6배 부풀려지는 버그**: 네이버 금 페이지 파서가 첫 번째 150k-400k 범위 숫자를 잡았는데, 그게 페이지 상단 "돈 단위 가격 표"의 4돈 가격(3,368,623원)에서 잘린 일부분 "368,623"이었음. 진짜 그램당 매도가는 222,329원인데 366,425원으로 저장되어 잔고가 1.65배 부풀려짐. 파서를 "계좌 (고객출금 시)" 라벨 기반으로 재작성. price_cache의 잘못된 row도 즉시 교정 (`src/lib/prices/gold.ts`).
- **회귀 방지 테스트 추가**: 돈 단위 표 fixture로 잘못 매칭하지 않음을 검증 (`test/gold-price.test.ts`).

## [0.1.3.2] - 2026-04-07

### Changed
- **계좌를 사용자별로 분리**: 가구를 공유하는 경우에도 다른 사람의 계좌가 보이지 않도록 `household_accounts`를 user 단위로 변경. `user_id` 컬럼 추가, RLS는 `user_id = auth.uid()` 기반. unique 제약은 `(user_id, brokerage, alias)`로 변경. 기존 row는 가구 owner에게 자동 할당 (`supabase/migrations/20260408000002_account_per_user.sql`).

### Added
- **주식 수정 페이지 퀵픽**: `/assets/[id]/edit` 주식 분기에도 사용자가 등록한 계좌를 한 번에 적용하는 빠른 선택 버튼 추가. 신규 등록 폼과 동일한 UI 패턴 (`src/app/assets/[id]/edit/page.tsx`).

## [0.1.3.1] - 2026-04-07

### Fixed (디자인 리뷰)
- **계좌 삭제 확인 다이얼로그 추가**: 설정 페이지에서 클릭 한 번에 계좌가 사라지던 문제. asset-list와 동일한 패턴으로 confirmation Dialog 추가 (`src/app/settings/page.tsx`).
- **계좌 empty state 보강**: "등록된 계좌가 없습니다" 한 줄 텍스트 → dashed border 카드 + 따뜻한 안내 문구. DESIGN.md "데이터 없음은 디자인이 아님" 원칙.
- **금액 표시 tabular-nums 강제 적용 누락 수정**: 카테고리 합계 (`asset-list.tsx`), 연간 배당 hero, 종목별 배당 금액 (`dividend-calendar.tsx`)에서 빠져 있던 `tabular-nums` 추가.
- **퀵픽 버튼 형태 정정**: `rounded-full` → `rounded-md`. DESIGN.md에서 `rounded-full`은 프로필 이미지/범례 전용.
- **매직 폰트 사이즈 제거**: `text-[10px]`, `text-[11px]` → `text-xs`. DESIGN.md 스케일 준수.
- **계좌 삭제 버튼 일관성**: 항상 빨간색 노출되던 텍스트 버튼 → asset-list와 동일한 ghost variant + group-hover 패턴.

## [0.1.3.0] - 2026-04-07

### Added
- **사용자 정의 주식 계좌 별칭**: 설정 페이지에서 금융사+별칭(예: 키움증권 · 메인, 한국투자증권 · ISA) 등록 가능. 새 테이블 `household_accounts` + `assets.account_alias` 컬럼.
- **자산 등록 시 계좌 퀵픽**: 주식 등록 폼에 사용자가 등록한 계좌가 버튼으로 노출되어 클릭 한 번에 금융사+별칭 자동 입력.
- **금 현물 매입가 입력 (편집 화면)**: 기존엔 신규 등록 폼에만 있던 매입가 필드를 자산 수정 화면에도 추가 (`src/app/assets/[id]/edit/page.tsx`).
- **자산 수정 폼 계좌 별칭 필드**: 주식 자산 수정 시에도 계좌 별칭을 변경 가능.

### Changed
- **대시보드 주식 그룹핑**: 주식 카테고리는 금융사+계좌별칭 단위로 sub-group 묶음 표시. 그룹/항목 모두 가나다순 정렬 (`src/components/asset-list.tsx`).
- **주식 상세 종목 합산**: 같은 ticker로 여러 계좌에 분산 보유 중인 자산은 stocks 페이지에서 한 줄로 합쳐서 표시. 수량/평가액 합산, 매수가는 가중평균, 보유 증권사는 콤마로 join (`src/components/stock-portfolio.tsx`).
- **배당지급일 표시**: 배당락일 외에 지급일(payment date)도 노출되도록 UI 보강. 데이터 소스가 paymentDate를 채우면 자동 표시 (`src/components/dividend-calendar.tsx`).

### Fixed
- **국내주식 배당 정보 누락**: 네이버 금융 구 endpoint(`/api/stock/{ticker}/dividend`, `/front-api/v1/stock/{ticker}/dividend`)가 404로 죽어 있어 모든 국내주식 배당이 표시 안 되던 문제. 살아있는 `integration` endpoint로 교체 (`src/lib/dividends.ts`). 단, 네이버는 이 endpoint에서 배당락일/지급일을 제공하지 않으므로 정확한 일정은 차후 DART API 통합 작업으로 분리.

## [0.1.2.1] - 2026-04-07

### Fixed
- 리밸런싱 페이지 잔고가 1700억대로 부풀려지는 버그 수정. `price_cache`는 이미 USD→KRW 변환 후 저장되는데 `computeRebalancing`이 yahoo_finance 자산에 환율을 또 한번 곱해서 약 1460배 부풀려졌음. 해외주식 1.48억 × 환율 ≈ 1700억대로 표시되던 문제. 환율 곱셈 분기를 제거하고 대시보드와 동일하게 `current_value`를 그대로 합산하도록 수정 (`src/lib/rebalancing.ts`).

## [0.1.2.0] - 2026-04-07

### Added
- 리밸런싱 MVP: 목표 자산 배분 설정 + 현재 vs 목표 비교 + 조정 제안
- `/rebalancing` 페이지: 유동 자산 총액, 도넛 차트 비교, 리밸런싱 제안 카드
- `/settings`에 리밸런싱 목표 섹션: 프리셋(보수형/균형형/공격형) + 직접설정 + 100% 검증
- `/api/rebalancing` API: 목표 CRUD + 합계 100% 서버 검증
- `src/lib/rebalancing.ts` 제안 엔진: 자산 클래스별 비교, stale 경고, 환율 적용
- `rebalancing_targets` DB 테이블 + RLS 정책
- 대시보드에 리밸런싱 진입점 카드 추가
- 리밸런싱 제안 엔진 테스트 10개 (rebalancing.test.ts)

## [0.1.1.0] - 2026-04-06

### Added
- DESIGN.md 디자인 시스템 문서 생성 (색상, 타이포, 스페이싱, 레이아웃, 모션 규칙)
- asset_class에 'crypto', 'real_estate' 추가 (기존 'alternative'에서 분리)
- `src/lib/calculations.ts` 수익률 계산 유틸리티 (DRY 통합)
- Upbit 동기화 시 매도 완료 코인(quantity=0) 자동 정리
- 목표 프로젝션에서 순자산 감소 추세 시 경고 메시지 표시

### Changed
- classification.ts: crypto → 'crypto', real_estate → 'real_estate'로 분류 변경
- allocation-pie-chart: 8색 팔레트로 확장 (crypto, real_estate 별도 색상)
- CLAUDE.md에 디자인 시스템 참조 섹션 추가

### Fixed
- purchase_price 접근 시 불필요한 `as unknown as` 캐스팅 4곳 제거
- 빈 catch 블록 10곳 → console.error로 에러 로깅 추가
- design-doc-phase3.md 디자인 문서 추가 (리밸런싱 MVP 설계)

## [0.1.0.0] - 2026-04-05

### Added
- 소유자별 자산 필터: 대시보드에서 전체/본인/배우자/공동 탭으로 자산과 부채를 필터링
- 빠른 자산 등록: 적금, CMA, 예금, 비상금, 전세 등 원터치 프리셋으로 빠르게 등록
- 부동산 시세 자동 갱신: KB부동산 추정가를 매주 자동으로 가져오되 수동 입력값은 보존
- vitest 테스트 프레임워크 및 소유자 필터 단위 테스트 7개

### Changed
- 부동산 자산에 'KB 추정가' badge 표시 (수동 입력값이 없을 때)

### Fixed
- KB cron 요일 체크를 KST 기준으로 변경 (UTC 대신)
- manual_value가 0일 때 falsy로 처리되던 버그 수정
