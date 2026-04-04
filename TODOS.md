# TODOS

## P2: 연금 충족도 점수 (v2)
**What:** 재무건강점수에 연금 충족도 기준 추가 (현재 3개 → 4개)
**Why:** 나이, 은퇴 목표일, 목표 월 지출 등 추가 입력 필요. MVP에서는 과도한 복잡도.
**Context:** 현재 건강점수는 자산분산도/비상금비율/부채비율 3개 기준 100점. 연금 충족도는 4번째 기준으로, 사용자 프로필(나이, 은퇴 계획)을 수집한 후 추가. CEO 리뷰 외부 의견에서 "연구 문제"로 지적됨.
**Effort:** M (human: ~1주 / CC: ~1시간)
**Priority:** P2
**Depends on:** Phase 4 재무건강점수 기본 구현 완료 후
**Source:** /plan-ceo-review 2026-04-04, 외부 의견 반영

## P1: 주식 종목 검색/선택 UI
**What:** 주식 등록 시 텍스트 입력 대신 시장(코스피/코스닥/나스닥/NYSE) 선택 → 종목 검색 → 드롭다운 선택 방식으로 변경
**Why:** 현재 텍스트 입력은 오타 위험, 티커 모르는 사용자 불편. 종목명으로 검색하면 티커가 자동 매칭되어야 함.
**Context:** 네이버 금융 검색 API (`https://m.stock.naver.com/front-api/v1/search/autoComplete?query=삼성`) 활용 가능. 국내주식은 종목코드(6자리), 해외주식은 Yahoo 티커. 검색 결과에서 선택하면 ticker, name, price_source, asset_class가 자동 설정됨.
**Effort:** M (human: ~3일 / CC: ~30분)
**Priority:** P1
**Depends on:** 현재 자산 등록 폼 완성 후
**Source:** 사용자 요청 2026-04-04
