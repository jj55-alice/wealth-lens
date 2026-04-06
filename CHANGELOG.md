# Changelog

All notable changes to Wealth Lens will be documented in this file.

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
