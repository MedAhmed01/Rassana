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
    
    return NextResponse.json({
      success: true,
      role: result.role,
    });
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
