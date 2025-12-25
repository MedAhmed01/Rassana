-- Migration: Create cards table
-- Maps card identifiers to YouTube video URLs

CREATE TABLE cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id VARCHAR(50) UNIQUE NOT NULL,
  video_url TEXT NOT NULL,
  title VARCHAR(255),
  subject VARCHAR(50) CHECK (subject IN ('physics', 'math')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for fast card lookups by card_id
CREATE INDEX idx_cards_card_id ON cards(card_id);

-- Trigger to update updated_at timestamp
CREATE TRIGGER update_cards_updated_at
  BEFORE UPDATE ON cards
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
