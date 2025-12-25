/**
 * Script to create the initial admin user
 * Run with: npx ts-node scripts/create-admin.ts
 * 
 * Make sure SUPABASE_SERVICE_ROLE_KEY is set in .env.local
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://dsirymysoenvhagdrvjp.supabase.co';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!serviceRoleKey) {
  console.error('Error: SUPABASE_SERVICE_ROLE_KEY is not set');
  console.log('Get it from: Supabase Dashboard > Settings > API > service_role key');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function createAdminUser() {
  const username = 'Rassana';
  const password = 'Rassana2025';
  const email = `${username}@cardgame.local`;
  const role = 'admin';
  
  // Set expiration to 1 year from now
  const expiresAt = new Date();
  expiresAt.setFullYear(expiresAt.getFullYear() + 1);

  console.log('Creating admin user...');
  console.log(`Username: ${username}`);
  console.log(`Email: ${email}`);
  console.log(`Role: ${role}`);
  console.log(`Expires: ${expiresAt.toISOString()}`);

  // Create auth user
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { role },
  });

  if (authError) {
    console.error('Error creating auth user:', authError.message);
    process.exit(1);
  }

  console.log('Auth user created:', authData.user?.id);

  // Create user profile
  const { error: profileError } = await supabase
    .from('user_profiles')
    .insert({
      user_id: authData.user!.id,
      username,
      role,
      expires_at: expiresAt.toISOString(),
    });

  if (profileError) {
    console.error('Error creating profile:', profileError.message);
    // Rollback: delete auth user
    await supabase.auth.admin.deleteUser(authData.user!.id);
    process.exit(1);
  }

  console.log('✅ Admin user created successfully!');
  console.log(`\nYou can now login with:`);
  console.log(`  Username: ${username}`);
  console.log(`  Password: ${password}`);
}

createAdminUser();
