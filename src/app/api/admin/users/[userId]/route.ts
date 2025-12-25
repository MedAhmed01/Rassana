import { NextRequest, NextResponse } from 'next/server';
import { checkAdminAuth } from '@/middleware/auth';
import { createServerSupabaseClient, createAdminClient } from '@/lib/supabase';
import { forceLogoutUser } from '@/services/users';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const auth = await checkAdminAuth();
    if (auth.error) return auth.error;
    
    const { userId } = await params;
    const body = await request.json();
    const { username, password, role, subscriptions, expires_at } = body;
    
    const supabase = await createServerSupabaseClient();
    
    // Update user profile
    const updates: Record<string, any> = {};
    if (username) updates.username = username;
    if (role) updates.role = role;
    if (subscriptions !== undefined) updates.subscriptions = subscriptions;
    if (expires_at) updates.expires_at = new Date(expires_at).toISOString();
    
    const { error: profileError } = await supabase
      .from('user_profiles')
      .update(updates)
      .eq('user_id', userId);
    
    if (profileError) {
      return NextResponse.json(
        { error: 'Failed to update user profile' },
        { status: 400 }
      );
    }
    
    // Update password if provided using admin client
    if (password) {
      const adminClient = createAdminClient();
      const { error: passwordError } = await adminClient.auth.admin.updateUserById(
        userId,
        { password }
      );
      
      if (passwordError) {
        console.error('Error updating password:', passwordError);
      }
    }
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating user:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const auth = await checkAdminAuth();
    if (auth.error) return auth.error;
    
    const { userId } = await params;
    const adminClient = createAdminClient();
    
    // Delete from auth.users (cascade will handle profile)
    const { error: authError } = await adminClient.auth.admin.deleteUser(userId);
    
    if (authError) {
      console.error('Error deleting auth user:', authError);
      return NextResponse.json(
        { error: 'Failed to delete user' },
        { status: 400 }
      );
    }
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting user:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Force logout a user (clear their session token)
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const auth = await checkAdminAuth();
    if (auth.error) return auth.error;
    
    const { userId } = await params;
    const result = await forceLogoutUser(userId);
    
    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 400 }
      );
    }
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error forcing logout:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
