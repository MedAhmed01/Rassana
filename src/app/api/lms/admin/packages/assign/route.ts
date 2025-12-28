import { NextRequest, NextResponse } from 'next/server';
import { isAdmin } from '@/services/auth';
import { assignPackageToStudent, getAllStudentPackages, extendStudentPackage } from '@/services/lms/packages';

export async function GET() {
  try {
    const adminCheck = await isAdmin();
    if (!adminCheck) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const studentPackages = await getAllStudentPackages();
    return NextResponse.json({ assignments: studentPackages });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch student packages' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const adminCheck = await isAdmin();
    if (!adminCheck) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { student_id, package_id, duration_days } = body;

    if (!student_id) {
      return NextResponse.json({ error: 'Student ID is required' }, { status: 400 });
    }

    if (!package_id) {
      return NextResponse.json({ error: 'Package ID is required' }, { status: 400 });
    }

    const result = await assignPackageToStudent({ 
      student_id, 
      package_id, 
      duration_days,
    });

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ studentPackage: result.data }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to assign package' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const adminCheck = await isAdmin();
    if (!adminCheck) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { id, additional_days } = body;

    if (!id) {
      return NextResponse.json({ error: 'Subscription ID is required' }, { status: 400 });
    }

    if (!additional_days || additional_days < 1) {
      return NextResponse.json({ error: 'Additional days must be at least 1' }, { status: 400 });
    }

    const result = await extendStudentPackage(id, additional_days);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ studentPackage: result.data });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to extend subscription' }, { status: 500 });
  }
}
