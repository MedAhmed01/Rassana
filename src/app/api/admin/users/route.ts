import { NextRequest, NextResponse } from 'next/server';
import { checkAdminAuth } from '@/middleware/auth';
import { createUser, getAllUsers } from '@/services/users';

export async function GET() {
  try {
    const auth = await checkAdminAuth();
    if (auth.error) return auth.error;
    
    const users = await getAllUsers();
    return NextResponse.json({ users });
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await checkAdminAuth();
    if (auth.error) return auth.error;
    
    const body = await request.json();
    const { username, password, role, subscriptions, expires_at } = body;
    
    // For admins, expires_at is not required
    if (!username || !password || !role) {
      return NextResponse.json(
        { error: 'Username, password, and role are required' },
        { status: 400 }
      );
    }
    
    // For students, expires_at is required
    if (role === 'student' && !expires_at) {
      return NextResponse.json(
        { error: 'Expiration date is required for students' },
        { status: 400 }
      );
    }
    
    const result = await createUser({
      username,
      password,
      role,
      subscriptions: subscriptions || [],
      expires_at: expires_at ? new Date(expires_at).toISOString() : undefined,
    });
    
    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 400 }
      );
    }
    
    return NextResponse.json({
      success: true,
      userId: result.userId,
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
