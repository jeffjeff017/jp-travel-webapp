-- ❤️❤️ 次數：各 Day 累計（管理員於行程頁 😈 新增）
ALTER TABLE site_settings
  ADD COLUMN IF NOT EXISTS day_heart_counts jsonb DEFAULT '{}'::jsonb;

COMMENT ON COLUMN site_settings.day_heart_counts IS 'Per-day heart tap counts (Record<dayString, number> JSON)';
