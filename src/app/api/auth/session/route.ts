import { NextResponse } from 'next/server';
import { validateSession, getCurrentUserProfile } from '@/services/auth';

export async function GET() {
  try {
    const validation = await validateSession();
    
    if (!validation.valid) {
      return NextResponse.json(
        { error: 'Not authenticated', reason: validation.reason },
        { status: 401 }
      );
    }
    
    // Get full user profile for students
    const profile = await getCurrentUserProfile();
    
    return NextResponse.json({
      authenticated: true,
      role: validation.role,
      username: profile?.username,
      phone: profile?.phone,
      subscriptions: profile?.subscriptions || [],
      expires_at: profile?.expires_at,
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
