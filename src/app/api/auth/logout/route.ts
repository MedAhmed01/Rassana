import { NextResponse } from 'next/server';
import { logout } from '@/services/auth';
import { cookies } from 'next/headers';

export async function POST() {
  try {
    const result = await logout();
    
    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 500 }
      );
    }
    
    // Clear all Supabase-related cookies
    const cookieStore = await cookies();
    const allCookies = cookieStore.getAll();
    
    const response = NextResponse.json({ success: true });
    
    // Delete session token cookie
    response.cookies.delete('session_token');
    
    // Delete all Supabase auth cookies
    allCookies.forEach(cookie => {
      if (cookie.name.startsWith('sb-') || cookie.name.includes('auth-token')) {
        response.cookies.delete(cookie.name);
      }
    });
    
    return response;
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
