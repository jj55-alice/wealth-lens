-- Add kb_estimated_value column for auto-fetched KB real estate prices
-- Preserves manual_value (user input) while storing KB estimated price separately
ALTER TABLE assets ADD COLUMN IF NOT EXISTS kb_estimated_value bigint;
ALTER TABLE assets ADD COLUMN IF NOT EXISTS kb_estimated_at timestamptz;
