import { NextResponse } from 'next/server';
import { logout, SESSION_COOKIE } from '@/services/auth';
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

    // Clear all auth-related cookies
    const cookieStore = await cookies();
    const allCookies = cookieStore.getAll();

    const response = NextResponse.json({ success: true });

    // Clear our session tracking cookie
    response.cookies.delete(SESSION_COOKIE);

    // Clear legacy session_token cookie if it exists
    response.cookies.delete('session_token');

    // Clear all Supabase auth cookies
    allCookies.forEach(cookie => {
      if (cookie.name.startsWith('sb-') || cookie.name.includes('auth-token')) {
        response.cookies.delete(cookie.name);
      }
    });

    return response;
  } catch {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
