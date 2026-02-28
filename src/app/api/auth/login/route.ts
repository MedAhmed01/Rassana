import { NextRequest, NextResponse } from 'next/server';
import { authenticateUser, SESSION_COOKIE } from '@/services/auth';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { username, password, deviceId, deviceInfo, forceDisconnect } = body;

    if (!username || !password) {
      return NextResponse.json(
        { error: 'Username and password are required' },
        { status: 400 }
      );
    }

    // Extract real IP from headers (works behind proxies/load balancers)
    const ip =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      request.headers.get('x-real-ip') ||
      'unknown';
    const userAgent = request.headers.get('user-agent') || '';

    const result = await authenticateUser(username, password, deviceId, {
      ...deviceInfo,
      ip,
      userAgent,
    }, forceDisconnect === true);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error, multiDeviceConflict: result.multiDeviceConflict ?? false },
        { status: 401 }
      );
    }

    const response = NextResponse.json({
      success: true,
      role: result.role,
    });

    // Set the tracked session cookie so we can validate it on every request
    if (result.sessionId) {
      response.cookies.set(SESSION_COOKIE, result.sessionId, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 60 * 60 * 24 * 30, // 30 days
      });
    }

    return response;
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
