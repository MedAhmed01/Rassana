# Supabase Setup Guide

## RLS Policies

Run the migration file to set up Row Level Security policies:

```bash
# Using Supabase CLI
supabase db push

# Or run the SQL directly in Supabase Dashboard > SQL Editor
```

The migration file `migrations/20241226_rls_policies.sql` creates policies for:

### user_profiles table
- Service role has full access (for admin operations)
- Users can read their own profile
- Admins can manage all profiles

### cards table
- Service role has full access
- All authenticated users can read cards
- Admins can manage all cards

### access_logs table
- Service role has full access
- Users can insert and read their own logs
- Admins can read and delete all logs

## Edge Function

The `admin-api` edge function provides a secure way to perform admin operations.

### Deploy the Edge Function

```bash
# Login to Supabase
supabase login

# Link your project
supabase link --project-ref YOUR_PROJECT_REF

# Deploy the function
supabase functions deploy admin-api
```

### Set Environment Variables

In Supabase Dashboard > Edge Functions > admin-api > Settings:

- `SUPABASE_URL` - Your Supabase project URL
- `SUPABASE_ANON_KEY` - Your anon/public key
- `SUPABASE_SERVICE_ROLE_KEY` - Your service role key

### Available Actions

The edge function accepts POST requests with:

```json
{
  "action": "actionName",
  "data": { ... }
}
```

#### User Operations
- `getUsers` - Get all users
- `createUser` - Create a new user
- `updateUser` - Update user details
- `deleteUser` - Delete a user

#### Card Operations
- `getCards` - Get all cards
- `createCard` - Create a new card
- `updateCard` - Update card details
- `deleteCard` - Delete a card

#### Access Log Operations
- `getAccessLogs` - Get access logs with filters
- `logAccess` - Log a video access

## Current Implementation

The app currently uses the **service role key** directly in API routes, which bypasses RLS. This is simpler but requires the service role key to be kept secure on the server.

To switch to using the Edge Function instead:

1. Deploy the edge function
2. Update the services to use `edgeFunction.ts` helpers
3. Pass the user's access token to the edge function calls

## Security Notes

- The service role key should NEVER be exposed to the client
- All admin operations are protected by checking the user's role
- RLS policies provide an additional layer of security
- The edge function verifies authentication before performing operations
