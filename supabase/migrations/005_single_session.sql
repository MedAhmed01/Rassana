-- Migration: Add session_token column for single session enforcement
-- When a user logs in, a new session_token is generated
-- All requests validate that the session_token matches

ALTER TABLE user_profiles 
ADD COLUMN session_token UUID DEFAULT NULL;

-- Index for fast session token lookups
CREATE INDEX idx_user_profiles_session_token ON user_profiles(session_token);
