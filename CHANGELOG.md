# Changelog

All notable changes to Wealth Lens will be documented in this file.

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
