import { NextRequest, NextResponse } from 'next/server';
import { isAdmin } from '@/services/auth';
import { createAdminClient } from '@/lib/supabase';
import { createStudent } from '@/services/lms/students';

export async function GET(request: NextRequest) {
  try {
    // Start admin check and data fetch in parallel
    const supabase = createAdminClient();
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const topicId = searchParams.get('topicId');

    // Build query
    let query = supabase
      .from('lms_students')
      .select(`
        id,
        username,
        email,
        phone,
        class,
        is_active,
        packages:lms_student_packages (
          id,
          package_id,
          starts_at,
          expires_at,
          package:lms_packages (id, name)
        )
      `)
      .order('created_at', { ascending: false })
      .limit(100);

    // Add search filter if provided
    if (search) {
      query = query.or(`username.ilike.%${search}%,email.ilike.%${search}%,phone.ilike.%${search}%`);
    }

    // Run admin check and query in parallel
    const [adminCheck, { data: students, error }] = await Promise.all([
      isAdmin(),
      query
    ]);

    if (!adminCheck) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (error) {
      console.error('Students fetch error:', error);
      return NextResponse.json({ error: 'Failed to fetch students' }, { status: 500 });
    }

    const now = new Date();
    
    // Transform and filter data
    let transformedStudents = (students || []).map((student: any) => ({
      student_id: student.id,
      username: student.username,
      email: student.email,
      phone: student.phone,
      class: student.class,
      is_active: student.is_active,
      packages: (student.packages || []).map((pkg: any) => ({
        id: pkg.id,
        package_id: pkg.package_id,
        package_name: pkg.package?.name || 'Unknown',
        starts_at: pkg.starts_at,
        expires_at: pkg.expires_at,
        is_active: new Date(pkg.expires_at) > now,
      })),
    }));

    // Filter by package if specified (using topicId param for backwards compatibility)
    if (topicId) {
      transformedStudents = transformedStudents.filter((s: any) => 
        s.packages.some((pkg: any) => pkg.package_id === topicId)
      );
    }

    return NextResponse.json({ students: transformedStudents });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch students' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const adminCheck = await isAdmin();
    if (!adminCheck) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { username, email, phone, password } = body;
    const studentClass = body.class; // 'class' is a reserved word

    if (!username) {
      return NextResponse.json({ error: 'Username is required' }, { status: 400 });
    }

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    if (!password) {
      return NextResponse.json({ error: 'Password is required' }, { status: 400 });
    }

    const result = await createStudent({ 
      username, 
      email, 
      phone, 
      password,
      class: studentClass,
    });

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ student: result.data }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create student' }, { status: 500 });
  }
}
