import { NextResponse } from 'next/server';
import { logout } from '@/services/auth';

export async function POST() {
  try {
    const result = await logout();
    
    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 500 }
      );
    }
    
    // Clear session token cookie
    const response = NextResponse.json({ success: true });
    response.cookies.delete('session_token');
    
    return response;
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
