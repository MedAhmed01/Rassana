-- Enable RLS on all tables
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE access_logs ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Service role has full access to user_profiles" ON user_profiles;
DROP POLICY IF EXISTS "Users can read own profile" ON user_profiles;
DROP POLICY IF EXISTS "Service role has full access to cards" ON cards;
DROP POLICY IF EXISTS "Authenticated users can read cards" ON cards;
DROP POLICY IF EXISTS "Service role has full access to access_logs" ON access_logs;
DROP POLICY IF EXISTS "Users can insert own access logs" ON access_logs;
DROP POLICY IF EXISTS "Users can read own access logs" ON access_logs;

-- ============================================
-- USER_PROFILES TABLE POLICIES
-- ============================================

-- Allow service role (admin client) full access
CREATE POLICY "Service role has full access to user_profiles" ON user_profiles
  FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role')
  WITH CHECK (auth.jwt() ->> 'role' = 'service_role');

-- Allow users to read their own profile
CREATE POLICY "Users can read own profile" ON user_profiles
  FOR SELECT
  USING (auth.uid() = user_id);

-- Allow admins to manage all profiles (via authenticated session)
CREATE POLICY "Admins can manage all profiles" ON user_profiles
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.user_id = auth.uid() AND up.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.user_id = auth.uid() AND up.role = 'admin'
    )
  );

-- ============================================
-- CARDS TABLE POLICIES
-- ============================================

-- Allow service role (admin client) full access
CREATE POLICY "Service role has full access to cards" ON cards
  FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role')
  WITH CHECK (auth.jwt() ->> 'role' = 'service_role');

-- Allow all authenticated users to read cards
CREATE POLICY "Authenticated users can read cards" ON cards
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- Allow admins to manage all cards
CREATE POLICY "Admins can manage all cards" ON cards
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.user_id = auth.uid() AND up.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.user_id = auth.uid() AND up.role = 'admin'
    )
  );

-- ============================================
-- ACCESS_LOGS TABLE POLICIES
-- ============================================

-- Allow service role (admin client) full access
CREATE POLICY "Service role has full access to access_logs" ON access_logs
  FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role')
  WITH CHECK (auth.jwt() ->> 'role' = 'service_role');

-- Allow users to insert their own access logs
CREATE POLICY "Users can insert own access logs" ON access_logs
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Allow users to read their own access logs
CREATE POLICY "Users can read own access logs" ON access_logs
  FOR SELECT
  USING (auth.uid() = user_id);

-- Allow admins to read all access logs
CREATE POLICY "Admins can read all access logs" ON access_logs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.user_id = auth.uid() AND up.role = 'admin'
    )
  );

-- Allow admins to delete access logs
CREATE POLICY "Admins can delete access logs" ON access_logs
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.user_id = auth.uid() AND up.role = 'admin'
    )
  );
