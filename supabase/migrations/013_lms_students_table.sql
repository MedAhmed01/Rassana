-- Migration: 013_lms_students_table.sql
-- Description: Create lms_students table (separate from card system users)

-- =====================================================
-- LMS Students Table (separate from card system users)
-- =====================================================
CREATE TABLE IF NOT EXISTS lms_students (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(100) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    phone VARCHAR(20),
    class VARCHAR(50),
    password_hash VARCHAR(255) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes (use IF NOT EXISTS to avoid errors)
CREATE INDEX IF NOT EXISTS idx_lms_students_email ON lms_students(email);
CREATE INDEX IF NOT EXISTS idx_lms_students_username ON lms_students(username);
CREATE INDEX IF NOT EXISTS idx_lms_students_is_active ON lms_students(is_active);
CREATE INDEX IF NOT EXISTS idx_lms_students_class ON lms_students(class);

-- Updated At Trigger
CREATE OR REPLACE FUNCTION update_lms_students_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_lms_students_updated_at ON lms_students;
CREATE TRIGGER trigger_lms_students_updated_at
    BEFORE UPDATE ON lms_students
    FOR EACH ROW EXECUTE FUNCTION update_lms_students_updated_at();

-- Row Level Security
ALTER TABLE lms_students ENABLE ROW LEVEL SECURITY;

-- Drop existing policy if exists and recreate
DROP POLICY IF EXISTS "Admins can manage lms_students" ON lms_students;
CREATE POLICY "Admins can manage lms_students" ON lms_students
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM user_profiles 
            WHERE user_profiles.user_id = auth.uid() 
            AND user_profiles.role = 'admin'
        )
    );

-- Allow service role full access (for API routes)
DROP POLICY IF EXISTS "Service role has full access to lms_students" ON lms_students;
CREATE POLICY "Service role has full access to lms_students" ON lms_students
    FOR ALL USING (true);
