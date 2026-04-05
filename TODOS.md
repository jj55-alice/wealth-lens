# TODOS

## P2: 연금 충족도 점수 (v2)
**What:** 재무건강점수에 연금 충족도 기준 추가 (현재 3개 → 4개)응
**Why:** 나이, 은퇴 목표일, 목표 월 지출 등 추가 입력 필요. MVP에서는 과도한 복잡도.
**Context:** 현재 건강점수는 자산분산도/비상금비율/부채비율 3개 기준 100점. 연금 충족도는 4번째 기준으로, 사용자 프로필(나이, 은퇴 계획)을 수집한 후 추가. CEO 리뷰 외부 의견에서 "연구 문제"로 지적됨.
**Effort:** M (human: ~1주 / CC: ~1시간)
**Priority:** P2
**Depends on:** Phase 4 재무건강점수 기본 구현 완료 후
**Source:** /plan-ceo-review 2026-04-04, 외부 의견 반영

## ~~P1: 주식 종목 검색/선택 UI~~ (DONE - 2026-04-04)
**What:** 주식 등록 시 텍스트 입력 대신 시장(코스피/코스닥/나스닥/NYSE) 선택 → 종목 검색 → 드롭다운 선택 방식으로 변경
**Why:** 현재 텍스트 입력은 오타 위험, 티커 모르는 사용자 불편. 종목명으로 검색하면 티커가 자동 매칭되어야 함.
**Context:** 네이버 금융 검색 API (`https://m.stock.naver.com/front-api/v1/search/autoComplete?query=삼성`) 활용 가능. 국내주식은 종목코드(6자리), 해외주식은 Yahoo 티커. 검색 결과에서 선택하면 ticker, name, price_source, asset_class가 자동 설정됨.
**Effort:** M (human: ~3일 / CC: ~30분)
**Priority:** P1
**Depends on:** 현재 자산 등록 폼 완성 후
**Source:** 사용자 요청 2026-04-04

## P1: 서비스화 전 API 키 암호화
**What:** broker_credentials 테이블의 credentials jsonb를 pgcrypto 또는 앱 레벨 AES로 암호화
**Why:** 다른 사용자의 증권 계좌 접근 권한을 plaintext로 저장하면 보안 사고. service_role_key가 모든 데이터 접근 가능.
**Context:** 현재 개인 앱(1-2가구)이라 RLS로 충분하지만, 서비스화 시 다중 사용자 환경에서는 암호화 필수. broker_credentials 테이블 생성 시 구조는 잡되, 암호화는 Phase 4 전에 추가.
**Effort:** M (human: ~1일 / CC: ~20분)
**Priority:** P1 (서비스화 전 필수)
**Depends on:** broker_credentials 테이블 생성 (Phase 2)
**Source:** /plan-eng-review 2026-04-05, outside voice 지적

## P2: cron 핸들러 분리
**What:** cron/route.ts를 시세갱신/스냅샷/KB부동산/알림 별도 엔드포인트로 분리
**Why:** 가구 수 증가 시 단일 Vercel 함수에서 timeout 리스크 (300초 제한)
**Context:** 현재 1-2가구라 문제없지만, 10+ 가구에서 전체 시세 + 스냅샷 + KB + 알림을 한 함수에서 처리하면 터질 수 있음. 각 작업을 별도 cron 엔드포인트로 분리하고 vercel.json에서 개별 스케줄.
**Effort:** M (human: ~2일 / CC: ~30분)
**Priority:** P2 (서비스화 시)
**Depends on:** Phase 4 서비스화 시작 전
**Source:** /plan-eng-review 2026-04-05, outside voice 지적

## P3: DESIGN.md 생성
**What:** 프로젝트 디자인 시스템 문서 생성 (색상 토큰, 타이포그래피 스케일, 컴포넌트 패턴, 반응형 브레이크포인트)
**Why:** 디자인 리뷰 시 기준이 없어 매번 ad-hoc 판단. 서비스화 시 일관성 유지에 필수.
**Context:** 현재 shadcn/ui 기반 de facto 패턴 존재 (emerald-500/red-500, text-xs~4xl, max-w-5xl). /design-consultation 스킬로 생성 가능.
**Effort:** S (human: ~2시간 / CC: ~15분)
**Priority:** P3
**Depends on:** 없음
**Source:** /plan-design-review 2026-04-05
