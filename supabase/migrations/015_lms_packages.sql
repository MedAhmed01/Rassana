-- Migration: 015_lms_packages.sql
-- Description: Replace topic subscriptions with package-based access

-- =====================================================
-- LMS Packages Table
-- =====================================================
CREATE TABLE IF NOT EXISTS lms_packages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    description TEXT,
    price DECIMAL(10, 2) DEFAULT 0,
    duration_days INTEGER NOT NULL DEFAULT 30,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    display_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- Package-Topic Junction Table (many-to-many)
-- =====================================================
CREATE TABLE IF NOT EXISTS lms_package_topics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    package_id UUID NOT NULL REFERENCES lms_packages(id) ON DELETE CASCADE,
    topic_id UUID NOT NULL REFERENCES lms_topics(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(package_id, topic_id)
);

-- =====================================================
-- Add is_free column to topics
-- =====================================================
ALTER TABLE lms_topics ADD COLUMN IF NOT EXISTS is_free BOOLEAN NOT NULL DEFAULT FALSE;

-- =====================================================
-- Student Package Subscriptions (replaces lms_subscriptions)
-- =====================================================
CREATE TABLE IF NOT EXISTS lms_student_packages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES lms_students(id) ON DELETE CASCADE,
    package_id UUID NOT NULL REFERENCES lms_packages(id) ON DELETE CASCADE,
    starts_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(student_id, package_id)
);

-- =====================================================
-- Indexes
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_lms_packages_is_active ON lms_packages(is_active);
CREATE INDEX IF NOT EXISTS idx_lms_packages_display_order ON lms_packages(display_order);
CREATE INDEX IF NOT EXISTS idx_lms_package_topics_package_id ON lms_package_topics(package_id);
CREATE INDEX IF NOT EXISTS idx_lms_package_topics_topic_id ON lms_package_topics(topic_id);
CREATE INDEX IF NOT EXISTS idx_lms_student_packages_student_id ON lms_student_packages(student_id);
CREATE INDEX IF NOT EXISTS idx_lms_student_packages_package_id ON lms_student_packages(package_id);
CREATE INDEX IF NOT EXISTS idx_lms_student_packages_expires_at ON lms_student_packages(expires_at);
CREATE INDEX IF NOT EXISTS idx_lms_topics_is_free ON lms_topics(is_free);

-- =====================================================
-- Updated At Triggers
-- =====================================================
CREATE OR REPLACE FUNCTION update_lms_packages_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_lms_packages_updated_at ON lms_packages;
CREATE TRIGGER trigger_lms_packages_updated_at
    BEFORE UPDATE ON lms_packages
    FOR EACH ROW EXECUTE FUNCTION update_lms_packages_updated_at();

CREATE OR REPLACE FUNCTION update_lms_student_packages_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_lms_student_packages_updated_at ON lms_student_packages;
CREATE TRIGGER trigger_lms_student_packages_updated_at
    BEFORE UPDATE ON lms_student_packages
    FOR EACH ROW EXECUTE FUNCTION update_lms_student_packages_updated_at();

-- =====================================================
-- Row Level Security
-- =====================================================
ALTER TABLE lms_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE lms_package_topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE lms_student_packages ENABLE ROW LEVEL SECURITY;

-- Service role policies
DROP POLICY IF EXISTS "Service role has full access to lms_packages" ON lms_packages;
CREATE POLICY "Service role has full access to lms_packages" ON lms_packages FOR ALL USING (true);

DROP POLICY IF EXISTS "Service role has full access to lms_package_topics" ON lms_package_topics;
CREATE POLICY "Service role has full access to lms_package_topics" ON lms_package_topics FOR ALL USING (true);

DROP POLICY IF EXISTS "Service role has full access to lms_student_packages" ON lms_student_packages;
CREATE POLICY "Service role has full access to lms_student_packages" ON lms_student_packages FOR ALL USING (true);

-- =====================================================
-- Helper function to check if student has access to topic
-- =====================================================
CREATE OR REPLACE FUNCTION has_topic_access(p_student_id UUID, p_topic_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    -- Check if topic is free
    IF EXISTS (SELECT 1 FROM lms_topics WHERE id = p_topic_id AND is_free = TRUE) THEN
        RETURN TRUE;
    END IF;
    
    -- Check if student has active package containing this topic
    RETURN EXISTS (
        SELECT 1 
        FROM lms_student_packages sp
        JOIN lms_package_topics pt ON pt.package_id = sp.package_id
        WHERE sp.student_id = p_student_id
        AND pt.topic_id = p_topic_id
        AND sp.expires_at > NOW()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
