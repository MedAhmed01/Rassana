-- Migration: Clear all session tokens
-- This allows all users to login again after removing the force logout feature

UPDATE user_profiles
SET session_token = NULL
WHERE session_token IS NOT NULL;

-- Also clear force_logout_at if it exists
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'user_profiles' 
        AND column_name = 'force_logout_at'
    ) THEN
        UPDATE user_profiles SET force_logout_at = NULL;
    END IF;
END $$;

-- Also clear last_login_at if it exists
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'user_profiles' 
        AND column_name = 'last_login_at'
    ) THEN
        UPDATE user_profiles SET last_login_at = NULL;
    END IF;
END $$;
