-- Optional: flight cards for profile page (JSON array). Safe if column already exists.
ALTER TABLE site_settings
  ADD COLUMN IF NOT EXISTS flights jsonb DEFAULT '[]'::jsonb;

COMMENT ON COLUMN site_settings.flights IS 'User-added flight info cards (FlightRecord[] JSON)';
