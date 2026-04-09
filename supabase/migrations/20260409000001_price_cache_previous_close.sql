-- Add previous_close to price_cache for daily change tracking.
-- Used by stock treemap to show today's delta (yesterday close -> current/today close)
-- instead of all-time return. During market hours, providers return previousClose
-- as yesterday's close; after market close, providers return today's close as price
-- and yesterday's close as previousClose. Same formula works for both cases.
alter table price_cache
  add column if not exists previous_close numeric;
