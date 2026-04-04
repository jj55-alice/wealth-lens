-- Wealth Lens v2: Asset management enhancements
-- purchase_price for stocks, deposit liability, KB real estate, dividend cache

-- 1. assets: purchase_price for cost-basis tracking
ALTER TABLE assets ADD COLUMN IF NOT EXISTS purchase_price numeric;

-- 2. assets: kb_complex_id for KB real estate price lookups
ALTER TABLE assets ADD COLUMN IF NOT EXISTS kb_complex_id text;

-- 3. liabilities: add 'deposit' category for jeonse deposits received
ALTER TABLE liabilities DROP CONSTRAINT IF EXISTS liabilities_category_check;
ALTER TABLE liabilities ADD CONSTRAINT liabilities_category_check
  CHECK (category IN ('mortgage', 'credit', 'student', 'deposit', 'other'));

-- 4. assets: add 'kb_real_estate' price source
ALTER TABLE assets DROP CONSTRAINT IF EXISTS assets_price_source_check;
ALTER TABLE assets ADD CONSTRAINT assets_price_source_check
  CHECK (price_source IN ('krx', 'upbit', 'gold_exchange', 'yahoo_finance', 'kb_real_estate', 'manual'));

-- 5. dividend cache table
CREATE TABLE IF NOT EXISTS dividend_cache (
  ticker text NOT NULL,
  dividend_per_share numeric NOT NULL,
  ex_date date NOT NULL,
  payment_date date,
  frequency text CHECK (frequency IN ('quarterly', 'semi_annual', 'annual')),
  fetched_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (ticker, ex_date)
);

-- RLS for dividend_cache
ALTER TABLE dividend_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read dividend cache"
  ON dividend_cache FOR SELECT
  TO authenticated
  USING (true);
