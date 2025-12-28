// LMS Types for Rassa LMS Feature (Separate from card system)

// LMS Student - separate from card system users
export interface LMSStudent {
  id: string;
  username: string;
  email: string;
  phone?: string;
  class?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface LMSTopic {
  id: string;
  name: string;
  description?: string;
  is_free: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
}

// Package types
export interface LMSPackage {
  id: string;
  name: string;
  description?: string;
  price: number;
  duration_days: number;
  is_active: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
}

export interface LMSPackageTopic {
  id: string;
  package_id: string;
  topic_id: string;
  created_at: string;
}

export interface LMSStudentPackage {
  id: string;
  student_id: string;
  package_id: string;
  starts_at: string;
  expires_at: string;
  created_at: string;
  updated_at: string;
  package?: LMSPackage;
  student?: LMSStudent;
}

export interface PackageWithTopics extends LMSPackage {
  topics: LMSTopic[];
}

export interface StudentPackageWithDetails extends LMSStudentPackage {
  package: LMSPackage;
  student: LMSStudent;
  is_active: boolean;
}

export interface LMSChapter {
  id: string;
  topic_id: string;
  name: string;
  description?: string;
  display_order: number;
  created_at: string;
  updated_at: string;
  lessons?: LMSLesson[];
}

export interface LMSLesson {
  id: string;
  chapter_id: string;
  title: string;
  description?: string;
  youtube_url: string;
  duration_seconds?: number;
  display_order: number;
  created_at: string;
  updated_at: string;
}

export interface LMSSubscription {
  id: string;
  student_id: string;
  topic_id: string;
  starts_at: string;
  expires_at: string;
  created_at: string;
  updated_at: string;
  topic?: LMSTopic;
  student?: LMSStudent;
}

export interface LMSLessonAccess {
  id: string;
  student_id: string;
  lesson_id: string;
  is_unlocked: boolean;
  unlocked_at?: string;
  unlocked_by?: string;
  was_unlocked_before_expiry?: boolean;
  created_at: string;
  updated_at: string;
}


export interface LMSWatchProgress {
  id: string;
  student_id: string;
  lesson_id: string;
  watched_seconds: number;
  total_seconds: number;
  last_position_seconds: number;
  max_percentage_watched: number;
  updated_at: string;
}

// Extended types with relationships
export interface LessonWithAccess extends LMSLesson {
  is_unlocked: boolean;
  progress?: LMSWatchProgress;
}

export interface ChapterWithLessons extends LMSChapter {
  lessons: LessonWithAccess[];
}

export interface TopicWithChapters extends LMSTopic {
  chapters: ChapterWithLessons[];
  subscription?: LMSSubscription;
}

export interface LMSStudentProgress {
  student_id: string;
  username: string;
  email: string;
  phone?: string;
  topic_id: string;
  topic_name: string;
  total_lessons: number;
  unlocked_lessons: number;
  completed_lessons: number;
  overall_percentage: number;
}

// Request/Response types
export interface CreateStudentRequest {
  username: string;
  email: string;
  phone?: string;
  class?: string;
  password: string;
}

export interface UpdateStudentRequest {
  username?: string;
  email?: string;
  phone?: string;
  class?: string;
  password?: string;
  is_active?: boolean;
}

export interface CreateTopicRequest {
  name: string;
  description?: string;
  is_free?: boolean;
}

export interface UpdateTopicRequest {
  name?: string;
  description?: string;
  display_order?: number;
  is_free?: boolean;
}

// Package request types
export interface CreatePackageRequest {
  name: string;
  description?: string;
  price?: number;
  duration_days: number;
  topic_ids?: string[];
}

export interface UpdatePackageRequest {
  name?: string;
  description?: string;
  price?: number;
  duration_days?: number;
  is_active?: boolean;
  display_order?: number;
  topic_ids?: string[];
}

export interface AssignPackageRequest {
  student_id: string;
  package_id: string;
  duration_days?: number; // Override package default duration
}

export interface CreateChapterRequest {
  topic_id: string;
  name: string;
  description?: string;
}

export interface UpdateChapterRequest {
  name?: string;
  description?: string;
  display_order?: number;
}

export interface CreateLessonRequest {
  chapter_id: string;
  title: string;
  youtube_url: string;
  description?: string;
  duration_seconds?: number;
}

export interface UpdateLessonRequest {
  title?: string;
  youtube_url?: string;
  description?: string;
  duration_seconds?: number;
  display_order?: number;
}

export interface CreateSubscriptionRequest {
  student_id: string;
  topic_id: string;
  expires_at: string;
  starts_at?: string;
}

export interface ExtendSubscriptionRequest {
  expires_at: string;
}

export interface UpdateProgressRequest {
  lesson_id: string;
  watched_seconds: number;
  total_seconds: number;
  last_position_seconds: number;
}

export interface LockUnlockRequest {
  student_id: string;
  lesson_ids: string[];
}

// Result types
export interface LMSResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface TopicWithStats extends LMSTopic {
  chapter_count: number;
  lesson_count: number;
}

export interface SubscriptionWithDetails extends LMSSubscription {
  topic: LMSTopic;
  student: LMSStudent;
  is_active: boolean;
}

// Auth types for LMS students
export interface LMSLoginRequest {
  email: string;
  password: string;
}

export interface LMSLoginResponse {
  success: boolean;
  student?: LMSStudent;
  token?: string;
  error?: string;
}
