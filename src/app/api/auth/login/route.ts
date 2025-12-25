import { NextRequest, NextResponse } from 'next/server';
import { authenticateUser } from '@/services/auth';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { username, password } = body;
    
    console.log('Login attempt for username:', username);
    
    if (!username || !password) {
      return NextResponse.json(
        { error: 'Username and password are required' },
        { status: 400 }
      );
    }
    
    const result = await authenticateUser(username, password);
    
    console.log('Auth result:', JSON.stringify(result, null, 2));
    
    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 401 }
      );
    }
    
    // Create response with session token cookie
    const response = NextResponse.json({
      success: true,
      role: result.role,
    });
    
    // Set session token in cookie for single session enforcement
    if (result.sessionToken) {
      response.cookies.set('session_token', result.sessionToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 30, // 30 days
        path: '/',
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
