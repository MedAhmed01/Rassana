-- Migration: Create watch_progress table
-- Tracks video watch progress for "Continue Watching" feature

CREATE TABLE watch_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  card_id VARCHAR(50) NOT NULL,
  progress_seconds DECIMAL(10, 2) NOT NULL DEFAULT 0,
  duration_seconds DECIMAL(10, 2) NOT NULL DEFAULT 0,
  last_watched_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, card_id)
);

-- Index for quick lookups by user
CREATE INDEX idx_watch_progress_user_id ON watch_progress(user_id);

-- Index for sorting by last watched
CREATE INDEX idx_watch_progress_last_watched ON watch_progress(last_watched_at DESC);

-- RLS policies
ALTER TABLE watch_progress ENABLE ROW LEVEL SECURITY;

-- Users can read their own progress
CREATE POLICY "Users can read own watch progress"
  ON watch_progress FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own progress
CREATE POLICY "Users can insert own watch progress"
  ON watch_progress FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own progress
CREATE POLICY "Users can update own watch progress"
  ON watch_progress FOR UPDATE
  USING (auth.uid() = user_id);

-- Admins can read all progress (for analytics)
CREATE POLICY "Admins can read all watch progress"
  ON watch_progress FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role = 'admin'
    )
  );
