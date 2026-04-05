-- Add KIS (한국투자증권) API credentials to households
ALTER TABLE households ADD COLUMN IF NOT EXISTS kis_app_key text;
ALTER TABLE households ADD COLUMN IF NOT EXISTS kis_app_secret text;
ALTER TABLE households ADD COLUMN IF NOT EXISTS kis_account_no text;
ALTER TABLE households ADD COLUMN IF NOT EXISTS kis_access_token text;
ALTER TABLE households ADD COLUMN IF NOT EXISTS kis_token_expires_at timestamptz;
