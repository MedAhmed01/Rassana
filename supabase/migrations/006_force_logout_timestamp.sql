-- Migration: Add force_logout_at column to user_profiles
-- This timestamp tracks when an admin force-logged out a user
-- Used to invalidate sessions created before this timestamp

ALTER TABLE user_profiles 
ADD COLUMN force_logout_at TIMESTAMPTZ DEFAULT NULL,
ADD COLUMN last_login_at TIMESTAMPTZ DEFAULT NULL;

-- Index for fast force logout checks
CREATE INDEX idx_user_profiles_force_logout_at ON user_profiles(force_logout_at);

-- Comments explaining the columns
COMMENT ON COLUMN user_profiles.force_logout_at IS 'Timestamp when admin force-logged out this user. Sessions created before this time are invalid.';
COMMENT ON COLUMN user_profiles.last_login_at IS 'Timestamp when user last logged in successfully.';
