-- Migration: Add phone number to user_profiles
-- Phone number is optional but can be used for login instead of username

-- Add phone column
ALTER TABLE user_profiles
ADD COLUMN phone VARCHAR(20) DEFAULT NULL;

-- Create unique index for phone (allows NULL but unique when set)
CREATE UNIQUE INDEX idx_user_profiles_phone ON user_profiles(phone) WHERE phone IS NOT NULL;

-- Comment explaining the field
COMMENT ON COLUMN user_profiles.phone IS 'Optional phone number for login (alternative to username)';
