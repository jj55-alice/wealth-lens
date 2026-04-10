-- Phase 0 of pace decomposition: track quantity + price at snapshot time
-- so contribution-vs-market analysis can detect mid-month quantity changes.
-- Existing rows remain NULL; decompose engine treats those as "data unavailable"
-- and excludes them from market drift calculation.

ALTER TABLE asset_snapshots ADD COLUMN IF NOT EXISTS quantity numeric;
ALTER TABLE asset_snapshots ADD COLUMN IF NOT EXISTS price numeric;
