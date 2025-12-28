-- Migration: 012_lms_tables.sql
-- Description: Create tables for Rassa LMS feature (separate from card system)

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

-- Indexes
CREATE INDEX idx_lms_students_email ON lms_students(email);
CREATE INDEX idx_lms_students_username ON lms_students(username);
CREATE INDEX idx_lms_students_is_active ON lms_students(is_active);
CREATE INDEX idx_lms_students_class ON lms_students(class);

-- =====================================================
-- LMS Topics Table
-- =====================================================
CREATE TABLE IF NOT EXISTS lms_topics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    display_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_lms_topics_display_order ON lms_topics(display_order);

-- =====================================================
-- LMS Chapters Table
-- =====================================================
CREATE TABLE IF NOT EXISTS lms_chapters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    topic_id UUID NOT NULL REFERENCES lms_topics(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    display_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_lms_chapters_topic_id ON lms_chapters(topic_id);
CREATE INDEX idx_lms_chapters_display_order ON lms_chapters(topic_id, display_order);

-- =====================================================
-- LMS Lessons Table
-- =====================================================
CREATE TABLE IF NOT EXISTS lms_lessons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chapter_id UUID NOT NULL REFERENCES lms_chapters(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    youtube_url VARCHAR(500) NOT NULL,
    duration_seconds INTEGER,
    display_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_lms_lessons_chapter_id ON lms_lessons(chapter_id);
CREATE INDEX idx_lms_lessons_display_order ON lms_lessons(chapter_id, display_order);


-- =====================================================
-- LMS Subscriptions Table
-- =====================================================
CREATE TABLE IF NOT EXISTS lms_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES lms_students(id) ON DELETE CASCADE,
    topic_id UUID NOT NULL REFERENCES lms_topics(id) ON DELETE CASCADE,
    starts_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(student_id, topic_id)
);

CREATE INDEX idx_lms_subscriptions_student_id ON lms_subscriptions(student_id);
CREATE INDEX idx_lms_subscriptions_topic_id ON lms_subscriptions(topic_id);
CREATE INDEX idx_lms_subscriptions_expires_at ON lms_subscriptions(expires_at);

-- =====================================================
-- LMS Lesson Access Table
-- =====================================================
CREATE TABLE IF NOT EXISTS lms_lesson_access (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES lms_students(id) ON DELETE CASCADE,
    lesson_id UUID NOT NULL REFERENCES lms_lessons(id) ON DELETE CASCADE,
    is_unlocked BOOLEAN NOT NULL DEFAULT FALSE,
    unlocked_at TIMESTAMP WITH TIME ZONE,
    unlocked_by UUID REFERENCES user_profiles(id),
    was_unlocked_before_expiry BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(student_id, lesson_id)
);

CREATE INDEX idx_lms_lesson_access_student_id ON lms_lesson_access(student_id);
CREATE INDEX idx_lms_lesson_access_lesson_id ON lms_lesson_access(lesson_id);
CREATE INDEX idx_lms_lesson_access_unlocked ON lms_lesson_access(student_id, is_unlocked);

-- =====================================================
-- LMS Watch Progress Table
-- =====================================================
CREATE TABLE IF NOT EXISTS lms_watch_progress (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES lms_students(id) ON DELETE CASCADE,
    lesson_id UUID NOT NULL REFERENCES lms_lessons(id) ON DELETE CASCADE,
    watched_seconds INTEGER NOT NULL DEFAULT 0,
    total_seconds INTEGER NOT NULL DEFAULT 0,
    last_position_seconds INTEGER NOT NULL DEFAULT 0,
    max_percentage_watched DECIMAL(5,2) NOT NULL DEFAULT 0,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(student_id, lesson_id)
);

CREATE INDEX idx_lms_watch_progress_student_id ON lms_watch_progress(student_id);
CREATE INDEX idx_lms_watch_progress_lesson_id ON lms_watch_progress(lesson_id);


-- =====================================================
-- Updated At Triggers
-- =====================================================
CREATE OR REPLACE FUNCTION update_lms_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_lms_students_updated_at
    BEFORE UPDATE ON lms_students
    FOR EACH ROW EXECUTE FUNCTION update_lms_updated_at();

CREATE TRIGGER trigger_lms_topics_updated_at
    BEFORE UPDATE ON lms_topics
    FOR EACH ROW EXECUTE FUNCTION update_lms_updated_at();

CREATE TRIGGER trigger_lms_chapters_updated_at
    BEFORE UPDATE ON lms_chapters
    FOR EACH ROW EXECUTE FUNCTION update_lms_updated_at();

CREATE TRIGGER trigger_lms_lessons_updated_at
    BEFORE UPDATE ON lms_lessons
    FOR EACH ROW EXECUTE FUNCTION update_lms_updated_at();

CREATE TRIGGER trigger_lms_subscriptions_updated_at
    BEFORE UPDATE ON lms_subscriptions
    FOR EACH ROW EXECUTE FUNCTION update_lms_updated_at();

CREATE TRIGGER trigger_lms_lesson_access_updated_at
    BEFORE UPDATE ON lms_lesson_access
    FOR EACH ROW EXECUTE FUNCTION update_lms_updated_at();

CREATE TRIGGER trigger_lms_watch_progress_updated_at
    BEFORE UPDATE ON lms_watch_progress
    FOR EACH ROW EXECUTE FUNCTION update_lms_updated_at();


-- =====================================================
-- Row Level Security Policies
-- =====================================================
ALTER TABLE lms_students ENABLE ROW LEVEL SECURITY;
ALTER TABLE lms_topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE lms_chapters ENABLE ROW LEVEL SECURITY;
ALTER TABLE lms_lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE lms_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE lms_lesson_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE lms_watch_progress ENABLE ROW LEVEL SECURITY;

-- LMS Students: Only admins can manage
CREATE POLICY "Admins can manage lms_students" ON lms_students
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM user_profiles 
            WHERE user_profiles.user_id = auth.uid() 
            AND user_profiles.role = 'admin'
        )
    );

-- Topics: Admins can manage, public read
CREATE POLICY "Admins can manage topics" ON lms_topics
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM user_profiles 
            WHERE user_profiles.user_id = auth.uid() 
            AND user_profiles.role = 'admin'
        )
    );

CREATE POLICY "Public can view topics" ON lms_topics
    FOR SELECT USING (true);

-- Chapters: Admins can manage, public read
CREATE POLICY "Admins can manage chapters" ON lms_chapters
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM user_profiles 
            WHERE user_profiles.user_id = auth.uid() 
            AND user_profiles.role = 'admin'
        )
    );

CREATE POLICY "Public can view chapters" ON lms_chapters
    FOR SELECT USING (true);

-- Lessons: Admins can manage, public read
CREATE POLICY "Admins can manage lessons" ON lms_lessons
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM user_profiles 
            WHERE user_profiles.user_id = auth.uid() 
            AND user_profiles.role = 'admin'
        )
    );

CREATE POLICY "Public can view lessons" ON lms_lessons
    FOR SELECT USING (true);

-- Subscriptions: Admins can manage, public read (access controlled at app level)
CREATE POLICY "Admins can manage subscriptions" ON lms_subscriptions
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM user_profiles 
            WHERE user_profiles.user_id = auth.uid() 
            AND user_profiles.role = 'admin'
        )
    );

CREATE POLICY "Public can view subscriptions" ON lms_subscriptions
    FOR SELECT USING (true);

-- Lesson Access: Admins can manage, public read (access controlled at app level)
CREATE POLICY "Admins can manage lesson access" ON lms_lesson_access
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM user_profiles 
            WHERE user_profiles.user_id = auth.uid() 
            AND user_profiles.role = 'admin'
        )
    );

CREATE POLICY "Public can view lesson access" ON lms_lesson_access
    FOR SELECT USING (true);

-- Watch Progress: Admins can manage, public can manage (access controlled at app level)
CREATE POLICY "Admins can manage progress" ON lms_watch_progress
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM user_profiles 
            WHERE user_profiles.user_id = auth.uid() 
            AND user_profiles.role = 'admin'
        )
    );

CREATE POLICY "Public can manage progress" ON lms_watch_progress
    FOR ALL USING (true);


-- =====================================================
-- Helper Functions
-- =====================================================
CREATE OR REPLACE FUNCTION is_lms_subscription_active(p_student_id UUID, p_topic_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM lms_subscriptions
        WHERE student_id = p_student_id
        AND topic_id = p_topic_id
        AND expires_at > NOW()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION get_first_lesson_of_topic(p_topic_id UUID)
RETURNS UUID AS $$
DECLARE
    first_lesson_id UUID;
BEGIN
    SELECT l.id INTO first_lesson_id
    FROM lms_lessons l
    JOIN lms_chapters c ON l.chapter_id = c.id
    WHERE c.topic_id = p_topic_id
    ORDER BY c.display_order ASC, l.display_order ASC
    LIMIT 1;
    
    RETURN first_lesson_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
