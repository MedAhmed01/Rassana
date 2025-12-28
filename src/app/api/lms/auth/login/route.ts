import { NextRequest, NextResponse } from 'next/server';
import { authenticateStudent } from '@/services/lms/students';

/**
 * POST /api/lms/auth/login
 * Authenticate an LMS student
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password } = body;
    
    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }
    
    const result = await authenticateStudent({ email, password });
    
    if (!result.success || !result.student) {
      return NextResponse.json(
        { error: result.error || 'Authentication failed' },
        { status: 401 }
      );
    }
    
    // Create response with student info
    const response = NextResponse.json({
      success: true,
      student: {
        id: result.student.id,
        username: result.student.username,
        email: result.student.email,
      },
    });
    
    // Set a cookie for the student session
    // In production, use a proper JWT or session token
    response.cookies.set('lms_student_id', result.student.id, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: '/',
    });
    
    return response;
  } catch (error) {
    console.error('Error during LMS login:', error);
    return NextResponse.json(
      { error: 'Login failed' },
      { status: 500 }
    );
  }
}
