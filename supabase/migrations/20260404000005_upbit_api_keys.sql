-- Upbit API keys for auto-sync
ALTER TABLE households ADD COLUMN IF NOT EXISTS upbit_access_key text;
ALTER TABLE households ADD COLUMN IF NOT EXISTS upbit_secret_key text;
