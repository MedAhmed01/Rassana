import { NextRequest, NextResponse } from 'next/server';
import { isAdmin } from '@/services/auth';
import { createPackage, getAllPackagesWithTopics } from '@/services/lms/packages';

export async function GET() {
  try {
    // Run admin check and data fetch in parallel
    const [adminCheck, packages] = await Promise.all([
      isAdmin(),
      getAllPackagesWithTopics()
    ]);

    if (!adminCheck) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    return NextResponse.json({ packages });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch packages' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const adminCheck = await isAdmin();
    if (!adminCheck) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { name, description, price, duration_days, topic_ids } = body;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json({ error: 'Package name is required' }, { status: 400 });
    }

    if (!duration_days || duration_days < 1) {
      return NextResponse.json({ error: 'Duration must be at least 1 day' }, { status: 400 });
    }

    const result = await createPackage({ 
      name: name.trim(), 
      description, 
      price: price || 0,
      duration_days,
      topic_ids,
    });

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ package: result.data }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create package' }, { status: 500 });
  }
}
