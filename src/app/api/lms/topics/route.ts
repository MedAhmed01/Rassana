import { NextRequest, NextResponse } from 'next/server';
import { getSubscriptionsByStudent } from '@/services/lms/subscriptions';
import { getStudentProgressSummary } from '@/services/lms/progress';
import { getStudentById } from '@/services/lms/students';

// Helper to get student ID from cookie or header
function getStudentIdFromRequest(request: NextRequest): string | null {
  return request.cookies.get('lms_student_id')?.value 
    || request.headers.get('x-lms-student-id');
}

export async function GET(request: NextRequest) {
  try {
    // Get student_id from cookie or header
    const studentId = getStudentIdFromRequest(request);
    
    if (!studentId) {
      return NextResponse.json({ error: 'Unauthorized - LMS student login required' }, { status: 401 });
    }

    // Verify student exists
    const student = await getStudentById(studentId);
    if (!student || !student.is_active) {
      return NextResponse.json({ error: 'Student not found or inactive' }, { status: 401 });
    }

    // Get all subscriptions (including expired) with topic info
    const subscriptions = await getSubscriptionsByStudent(studentId);

    // Get progress summary for each topic
    const progressSummary = await getStudentProgressSummary(studentId);

    // Combine subscription and progress data
    const topics = subscriptions.map((sub: any) => {
      const progress = progressSummary.find(p => p.topic_id === sub.topic_id);
      const isActive = new Date(sub.expires_at) > new Date();
      return {
        id: sub.topic_id,
        name: sub.topic?.name || 'Unknown',
        description: sub.topic?.description,
        overall_percentage: progress?.overall_percentage || 0,
        total_lessons: progress?.total_lessons || 0,
        completed_lessons: progress?.completed_lessons || 0,
        is_active: isActive,
      };
    });

    return NextResponse.json({ topics });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch topics' }, { status: 500 });
  }
}
