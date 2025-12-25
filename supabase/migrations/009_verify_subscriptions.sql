-- Migration: Verify and fix subscriptions column
-- This ensures the subscriptions column exists and has proper defaults

-- Check if subscriptions column exists, if not add it
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'user_profiles' 
        AND column_name = 'subscriptions'
    ) THEN
        ALTER TABLE user_profiles
        ADD COLUMN subscriptions TEXT[] DEFAULT '{}';
        
        CREATE INDEX idx_user_profiles_subscriptions ON user_profiles USING GIN(subscriptions);
        
        RAISE NOTICE 'Added subscriptions column to user_profiles';
    ELSE
        RAISE NOTICE 'subscriptions column already exists';
    END IF;
END $$;

-- Check if required_subscriptions column exists on cards, if not add it
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'cards' 
        AND column_name = 'required_subscriptions'
    ) THEN
        ALTER TABLE cards
        ADD COLUMN required_subscriptions TEXT[] DEFAULT '{}';
        
        CREATE INDEX idx_cards_required_subscriptions ON cards USING GIN(required_subscriptions);
        
        RAISE NOTICE 'Added required_subscriptions column to cards';
    ELSE
        RAISE NOTICE 'required_subscriptions column already exists';
    END IF;
END $$;

-- Ensure all existing users have an empty array for subscriptions if NULL
UPDATE user_profiles
SET subscriptions = '{}'
WHERE subscriptions IS NULL;

-- Ensure all existing cards have an empty array for required_subscriptions if NULL
UPDATE cards
SET required_subscriptions = '{}'
WHERE required_subscriptions IS NULL;

-- Verify the changes
SELECT 
    'user_profiles' as table_name,
    COUNT(*) as total_rows,
    COUNT(subscriptions) as rows_with_subscriptions,
    COUNT(*) FILTER (WHERE subscriptions IS NOT NULL AND array_length(subscriptions, 1) > 0) as rows_with_active_subscriptions
FROM user_profiles
UNION ALL
SELECT 
    'cards' as table_name,
    COUNT(*) as total_rows,
    COUNT(required_subscriptions) as rows_with_required_subscriptions,
    COUNT(*) FILTER (WHERE required_subscriptions IS NOT NULL AND array_length(required_subscriptions, 1) > 0) as rows_with_active_requirements
FROM cards;
