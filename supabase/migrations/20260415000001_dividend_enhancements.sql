-- Dividend enhancements: per-event history + summary columns
-- 배당락일/지급일을 종목별 N회 정확히 저장. dividend_cache는 최근 요약만 유지.

-- 1. dividend_cache 컬럼 보강
ALTER TABLE dividend_cache ADD COLUMN IF NOT EXISTS dividend_yield numeric;
ALTER TABLE dividend_cache ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'KRW';
ALTER TABLE dividend_cache ADD COLUMN IF NOT EXISTS announcement_date date;
ALTER TABLE dividend_cache ADD COLUMN IF NOT EXISTS source text;

-- 2. dividend_events: 종목별 배당 이벤트 (과거 + 예정)
CREATE TABLE IF NOT EXISTS dividend_events (
  ticker text NOT NULL,
  ex_date date NOT NULL,
  payment_date date,
  record_date date,
  amount_per_share numeric NOT NULL,
  currency text NOT NULL DEFAULT 'KRW',
  source text,
  fetched_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (ticker, ex_date)
);

CREATE INDEX IF NOT EXISTS idx_dividend_events_ex_date ON dividend_events(ex_date DESC);
CREATE INDEX IF NOT EXISTS idx_dividend_events_ticker ON dividend_events(ticker);

-- RLS: 배당 데이터는 공용 참조 자료 (티커 기반, 사용자 정보 없음)
ALTER TABLE dividend_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read dividend events" ON dividend_events;
CREATE POLICY "Anyone can read dividend events"
  ON dividend_events FOR SELECT
  TO authenticated
  USING (true);
