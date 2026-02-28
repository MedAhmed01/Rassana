// Subscription types — now dynamic, backed by subscription_categories table
export type Subscription = string;

export interface SubscriptionCategory {
  id: string;
  label: string;
  color: string;
  hidden: boolean;
  sort_order: number;
  created_at: string;
}

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
  phone?: string;
  role: 'admin' | 'student';
  subscriptions?: Subscription[];
  expires_at: string;
  created_at: string;
  updated_at: string;
  device_id?: string;
  device_bound_at?: string;
  device_binding_enabled?: boolean;
}

// Credentials for creating a new user
export interface UserCredentials {
  username: string;
  password: string;
  phone?: string;
  role: 'admin' | 'student';
  subscriptions?: Subscription[];
  expires_at?: string;
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
  /** UUID of the user_sessions record created on login */
  sessionId?: string;
  /**
   * True when login was blocked because the account is already active on
   * another device. The client should offer a self-service disconnect option.
   */
  multiDeviceConflict?: boolean;
}

// Active session record from user_sessions table
export interface UserSession {
  id: string;
  user_id: string;
  username?: string;
  phone?: string;
  device_id?: string;
  device_info?: {
    browser?: string;
    os?: string;
    screen?: string;
    platform?: string;
  };
  ip_address?: string;
  user_agent?: string;
  created_at: string;
  last_seen_at: string;
  terminated_at?: string | null;
  terminated_by?: string | null;
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
