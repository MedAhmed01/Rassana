-- Migration: 014_fix_lms_subscriptions.sql
-- Description: Fix lms_subscriptions to use student_id instead of user_id

-- Check if user_id column exists and rename it to student_id
DO $$
BEGIN
    -- Check if user_id exists in lms_subscriptions
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'lms_subscriptions' AND column_name = 'user_id'
    ) THEN
        -- Rename user_id to student_id
        ALTER TABLE lms_subscriptions RENAME COLUMN user_id TO student_id;
    END IF;
    
    -- Drop old foreign key if exists
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'lms_subscriptions_user_id_fkey' 
        AND table_name = 'lms_subscriptions'
    ) THEN
        ALTER TABLE lms_subscriptions DROP CONSTRAINT lms_subscriptions_user_id_fkey;
    END IF;
    
    -- Add foreign key to lms_students if not exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'lms_subscriptions_student_id_fkey' 
        AND table_name = 'lms_subscriptions'
    ) THEN
        ALTER TABLE lms_subscriptions 
        ADD CONSTRAINT lms_subscriptions_student_id_fkey 
        FOREIGN KEY (student_id) REFERENCES lms_students(id) ON DELETE CASCADE;
    END IF;
END $$;

-- Recreate indexes with correct column name
DROP INDEX IF EXISTS idx_lms_subscriptions_user_id;
CREATE INDEX IF NOT EXISTS idx_lms_subscriptions_student_id ON lms_subscriptions(student_id);

-- Fix unique constraint
ALTER TABLE lms_subscriptions DROP CONSTRAINT IF EXISTS lms_subscriptions_user_id_topic_id_key;
ALTER TABLE lms_subscriptions DROP CONSTRAINT IF EXISTS lms_subscriptions_student_id_topic_id_key;
ALTER TABLE lms_subscriptions ADD CONSTRAINT lms_subscriptions_student_id_topic_id_key UNIQUE (student_id, topic_id);

-- Also fix lms_lesson_access table
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'lms_lesson_access' AND column_name = 'user_id'
    ) THEN
        ALTER TABLE lms_lesson_access RENAME COLUMN user_id TO student_id;
    END IF;
    
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'lms_lesson_access_user_id_fkey' 
        AND table_name = 'lms_lesson_access'
    ) THEN
        ALTER TABLE lms_lesson_access DROP CONSTRAINT lms_lesson_access_user_id_fkey;
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'lms_lesson_access_student_id_fkey' 
        AND table_name = 'lms_lesson_access'
    ) THEN
        ALTER TABLE lms_lesson_access 
        ADD CONSTRAINT lms_lesson_access_student_id_fkey 
        FOREIGN KEY (student_id) REFERENCES lms_students(id) ON DELETE CASCADE;
    END IF;
END $$;

DROP INDEX IF EXISTS idx_lms_lesson_access_user_id;
CREATE INDEX IF NOT EXISTS idx_lms_lesson_access_student_id ON lms_lesson_access(student_id);

ALTER TABLE lms_lesson_access DROP CONSTRAINT IF EXISTS lms_lesson_access_user_id_lesson_id_key;
ALTER TABLE lms_lesson_access DROP CONSTRAINT IF EXISTS lms_lesson_access_student_id_lesson_id_key;
ALTER TABLE lms_lesson_access ADD CONSTRAINT lms_lesson_access_student_id_lesson_id_key UNIQUE (student_id, lesson_id);

-- Also fix lms_watch_progress table
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'lms_watch_progress' AND column_name = 'user_id'
    ) THEN
        ALTER TABLE lms_watch_progress RENAME COLUMN user_id TO student_id;
    END IF;
    
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'lms_watch_progress_user_id_fkey' 
        AND table_name = 'lms_watch_progress'
    ) THEN
        ALTER TABLE lms_watch_progress DROP CONSTRAINT lms_watch_progress_user_id_fkey;
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'lms_watch_progress_student_id_fkey' 
        AND table_name = 'lms_watch_progress'
    ) THEN
        ALTER TABLE lms_watch_progress 
        ADD CONSTRAINT lms_watch_progress_student_id_fkey 
        FOREIGN KEY (student_id) REFERENCES lms_students(id) ON DELETE CASCADE;
    END IF;
END $$;

DROP INDEX IF EXISTS idx_lms_watch_progress_user_id;
CREATE INDEX IF NOT EXISTS idx_lms_watch_progress_student_id ON lms_watch_progress(student_id);

ALTER TABLE lms_watch_progress DROP CONSTRAINT IF EXISTS lms_watch_progress_user_id_lesson_id_key;
ALTER TABLE lms_watch_progress DROP CONSTRAINT IF EXISTS lms_watch_progress_student_id_lesson_id_key;
ALTER TABLE lms_watch_progress ADD CONSTRAINT lms_watch_progress_student_id_lesson_id_key UNIQUE (student_id, lesson_id);

-- Drop and recreate helper function (parameter name changed from p_user_id to p_student_id)
DROP FUNCTION IF EXISTS is_lms_subscription_active(UUID, UUID);

CREATE FUNCTION is_lms_subscription_active(p_student_id UUID, p_topic_id UUID)
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
