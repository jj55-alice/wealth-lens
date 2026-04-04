-- Household goal settings
ALTER TABLE households ADD COLUMN IF NOT EXISTS goal_net_worth numeric;
ALTER TABLE households ADD COLUMN IF NOT EXISTS goal_annual_dividend numeric;
