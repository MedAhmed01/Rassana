-- 018_user_sessions.sql
-- Proper session tracking table: each login creates one record
-- This replaces the unreliable session_token-in-user_profiles approach
-- and enables real single-device enforcement + admin visibility

CREATE TABLE IF NOT EXISTS user_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  device_id VARCHAR(255),
  device_info JSONB DEFAULT '{}',   -- { browser, os, screen, platform, touch_points }
  ip_address VARCHAR(45),
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ DEFAULT NOW(),
  terminated_at TIMESTAMPTZ DEFAULT NULL,
  terminated_by VARCHAR(20) DEFAULT NULL, -- 'user' | 'admin' | 'system'
  CONSTRAINT fk_user_sessions_profile
    FOREIGN KEY (user_id) REFERENCES user_profiles(user_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id
  ON user_sessions(user_id);

CREATE INDEX IF NOT EXISTS idx_user_sessions_active
  ON user_sessions(user_id, terminated_at)
  WHERE terminated_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_user_sessions_last_seen
  ON user_sessions(last_seen_at DESC)
  WHERE terminated_at IS NULL;

-- System-wide settings table
CREATE TABLE IF NOT EXISTS system_settings (
  key VARCHAR(100) PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Default: respect per-user device_binding_enabled flag
-- Possible values: 'off' | 'per_user' | 'all'
INSERT INTO system_settings (key, value)
VALUES ('device_binding_mode', '"per_user"')
ON CONFLICT (key) DO NOTHING;

-- RLS: only service_role (admin client) can access these tables
ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role only - user_sessions" ON user_sessions;
CREATE POLICY "Service role only - user_sessions"
  ON user_sessions FOR ALL TO service_role
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role only - system_settings" ON system_settings;
CREATE POLICY "Service role only - system_settings"
  ON system_settings FOR ALL TO service_role
  USING (true) WITH CHECK (true);
