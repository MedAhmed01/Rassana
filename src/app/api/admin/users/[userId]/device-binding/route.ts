import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase';
import { isAdmin } from '@/services/auth';

// POST - Toggle device binding for a user
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const isAdminUser = await isAdmin();
    if (!isAdminUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { userId } = await params;
    const body = await request.json();
    const { enabled } = body;

    if (typeof enabled !== 'boolean') {
      return NextResponse.json({ error: 'enabled must be a boolean' }, { status: 400 });
    }

    const adminClient = createAdminClient();

    // If disabling, also clear the device binding
    const updateData: Record<string, unknown> = {
      device_binding_enabled: enabled,
    };

    if (!enabled) {
      updateData.device_id = null;
      updateData.device_bound_at = null;
    }

    const { error } = await adminClient
      .from('user_profiles')
      .update(updateData)
      .eq('user_id', userId);

    if (error) {
      console.error('Error toggling device binding:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      message: enabled ? 'Device binding enabled' : 'Device binding disabled and device cleared'
    });
  } catch (err) {
    console.error('Device binding toggle error:', err);
    return NextResponse.json({ error: 'Failed to toggle device binding' }, { status: 500 });
  }
}

// DELETE - Reset/clear the bound device (keep binding enabled)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const isAdminUser = await isAdmin();
    if (!isAdminUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { userId } = await params;
    const adminClient = createAdminClient();

    const { error } = await adminClient
      .from('user_profiles')
      .update({
        device_id: null,
        device_bound_at: null,
        session_token: null,
      })
      .eq('user_id', userId);

    if (error) {
      console.error('Error resetting device:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Also sign out all sessions
    try {
      await adminClient.auth.admin.signOut(userId, 'global');
    } catch (e) {
      console.log('Could not sign out via admin API:', e);
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Device reset successfully. Student can now login from a new device.'
    });
  } catch (err) {
    console.error('Device reset error:', err);
    return NextResponse.json({ error: 'Failed to reset device' }, { status: 500 });
  }
}
