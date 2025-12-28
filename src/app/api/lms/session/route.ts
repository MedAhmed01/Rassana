import { NextRequest, NextResponse } from 'next/server';
import { getStudentById } from '@/services/lms/students';

/**
 * GET /api/lms/session
 * Get current LMS student session info
 */
export async function GET(request: NextRequest) {
  try {
    // Get student ID from cookie or header
    const studentId = request.cookies.get('lms_student_id')?.value 
      || request.headers.get('x-lms-student-id');
    
    if (!studentId) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }
    
    const student = await getStudentById(studentId);
    
    if (!student) {
      return NextResponse.json(
        { error: 'Student not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({
      student: {
        id: student.id,
        username: student.username,
        email: student.email,
      },
    });
  } catch (error) {
    console.error('Error getting LMS session:', error);
    return NextResponse.json(
      { error: 'Failed to get session' },
      { status: 500 }
    );
  }
}
