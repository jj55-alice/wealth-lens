# Changelog

All notable changes to Wealth Lens will be documented in this file.

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
