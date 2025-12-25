# Database Migration Instructions

## Apply the Force Logout Migration

To enable the improved force logout functionality, you need to apply the new migration to your Supabase database.

### Option 1: Using Supabase CLI (Recommended)

```bash
# Navigate to the project directory
cd card-video-access

# Apply the migration
supabase db push
```

### Option 2: Manual SQL Execution

1. Go to your Supabase Dashboard
2. Navigate to the SQL Editor
3. Copy and paste the contents of `supabase/migrations/006_force_logout_timestamp.sql`
4. Execute the SQL

### What This Migration Does

- Adds `force_logout_at` column to track when an admin force-logged out a user
- Adds `last_login_at` column to track when a user last logged in
- Creates an index for efficient force logout checks

### How Force Logout Works Now

1. **Admin clicks "Force Logout"**:
   - Sets `session_token` to NULL
   - Sets `force_logout_at` to current timestamp
   - Calls Supabase Admin API to invalidate all refresh tokens

2. **User makes any request**:
   - `validateSession()` checks if `session_token` is NULL → logout
   - Checks if `force_logout_at` > `last_login_at` → logout
   - Automatically calls `signOut()` to clear browser cookies

3. **Result**: User is immediately logged out on their next request, even if they have a valid JWT token in their browser.
