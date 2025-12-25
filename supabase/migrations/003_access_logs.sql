-- Migration: Create access_logs table
-- Tracks video access history for analytics

CREATE TABLE access_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  card_id VARCHAR(50) NOT NULL,
  accessed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for filtering by user_id
CREATE INDEX idx_access_logs_user_id ON access_logs(user_id);

-- Index for filtering by card_id
CREATE INDEX idx_access_logs_card_id ON access_logs(card_id);

-- Index for filtering by accessed_at (date range queries)
CREATE INDEX idx_access_logs_accessed_at ON access_logs(accessed_at);
