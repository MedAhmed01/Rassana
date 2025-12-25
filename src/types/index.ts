// Subscription types
export type Subscription = 'math' | 'physics' | 'science';

// Card type - Maps card identifiers to YouTube video URLs
export interface Card {
  id: string;
  card_id: string;
  video_url: string;
  title?: string;
  subject?: string;
  required_subscriptions?: Subscription[];
  created_at: string;
  updated_at: string;
}

// User profile with role and expiration
export interface UserProfile {
  id: string;
  user_id: string;
  username: string;
  role: 'admin' | 'student';
  subscriptions?: Subscription[];
  expires_at: string;
  created_at: string;
  updated_at: string;
}

// Credentials for creating a new user
export interface UserCredentials {
  username: string;
  password: string;
  role: 'admin' | 'student';
  subscriptions?: Subscription[];
  expires_at: string;
}

// Supabase session type
export interface Session {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  user: {
    id: string;
    email: string;
  };
}

// Authentication result
export interface AuthResult {
  success: boolean;
  session?: Session;
  role?: 'admin' | 'student';
  error?: string;
  sessionToken?: string;
}

// Request to create a new card
export interface CardCreateRequest {
  card_id: string;
  video_url: string;
  title?: string;
  subject?: string;
  required_subscriptions?: Subscription[];
}

// Access log entry
export interface AccessLog {
  id: string;
  user_id: string;
  card_id: string;
  accessed_at: string;
  user_profiles?: { username: string };
  cards?: { title: string };
}

// Filters for querying access logs
export interface AccessLogFilters {
  userId?: string;
  cardId?: string;
  startDate?: string;
  endDate?: string;
}

// Result of user creation
export interface CreateUserResult {
  success: boolean;
  userId?: string;
  error?: string;
}

// Result of card operations
export interface CardResult {
  success: boolean;
  card?: Card;
  error?: string;
}

// Session validation result
export interface SessionValidation {
  valid: boolean;
  role?: 'admin' | 'student';
  reason?: string;
  sessionToken?: string;
}
