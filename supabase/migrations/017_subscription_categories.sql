CREATE TABLE subscription_categories (
  id TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT 'slate',
  hidden BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE subscription_categories ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can read (needed for student dashboard)
CREATE POLICY "Authenticated users can read categories"
  ON subscription_categories FOR SELECT TO authenticated USING (true);

-- Admin-only write access
CREATE POLICY "Admins can insert categories"
  ON subscription_categories FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM user_profiles up WHERE up.user_id = auth.uid() AND up.role = 'admin'));
CREATE POLICY "Admins can update categories"
  ON subscription_categories FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM user_profiles up WHERE up.user_id = auth.uid() AND up.role = 'admin'));
CREATE POLICY "Admins can delete categories"
  ON subscription_categories FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM user_profiles up WHERE up.user_id = auth.uid() AND up.role = 'admin'));

-- Seed existing categories
INSERT INTO subscription_categories (id, label, color, sort_order) VALUES
  ('math', 'Math', 'orange', 1),
  ('physics', 'Physics', 'teal', 2),
  ('science', 'Sciences', 'green', 3),
  ('bmath', 'B Math', 'blue', 4),
  ('bphysics', 'B Physique', 'purple', 5),
  ('bscience', 'B Sciences', 'cyan', 6),
  ('brevetmath', 'Brevet Math', 'rose', 7),
  ('brevetphysics', 'Brevet Physique', 'amber', 8);
