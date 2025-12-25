-- Migration: Add subscription system
-- Students can subscribe to Math, Physics, Science, or any combination
-- Cards specify which subscriptions are required for access

-- Add subscriptions array to user_profiles
ALTER TABLE user_profiles
ADD COLUMN subscriptions TEXT[] DEFAULT '{}';

-- Create index for subscription queries
CREATE INDEX idx_user_profiles_subscriptions ON user_profiles USING GIN(subscriptions);

-- Update cards table to support multiple subjects/subscriptions
ALTER TABLE cards
DROP CONSTRAINT IF EXISTS cards_subject_check;

ALTER TABLE cards
ALTER COLUMN subject TYPE TEXT;

-- Add required_subscriptions array to cards
ALTER TABLE cards
ADD COLUMN required_subscriptions TEXT[] DEFAULT '{}';

-- Create index for subscription queries on cards
CREATE INDEX idx_cards_required_subscriptions ON cards USING GIN(required_subscriptions);

-- Update existing cards to use the new subscription system
-- If a card has a subject, add it to required_subscriptions
UPDATE cards
SET required_subscriptions = ARRAY[subject]
WHERE subject IS NOT NULL AND subject != '';

-- Comment explaining the subscription values
COMMENT ON COLUMN user_profiles.subscriptions IS 'Array of subscriptions: math, physics, science';
COMMENT ON COLUMN cards.required_subscriptions IS 'Array of required subscriptions to access this card: math, physics, science';
