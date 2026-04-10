-- Phase 0 of pace decomposition: store daily pace summary alongside briefing cards.
-- Separate jsonb column (not inside cards array) so existing BriefingCard parsing
-- and UI rendering remain untouched.

ALTER TABLE briefing_cards ADD COLUMN IF NOT EXISTS pace jsonb;
