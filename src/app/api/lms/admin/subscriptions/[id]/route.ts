import { NextRequest, NextResponse } from 'next/server';
import { isAdmin, getCurrentUserProfile } from '@/services/auth';
import { getSubscriptionById, extendSubscription, deleteSubscription } from '@/services/lms/subscriptions';
import { restoreLessonAccessAfterRenewal } from '@/services/lms/access';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const adminCheck = await isAdmin();
    if (!adminCheck) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const subscription = await getSubscriptionById(id);

    if (!subscription) {
      return NextResponse.json({ error: 'Subscription not found' }, { status: 404 });
    }

    return NextResponse.json({ subscription });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch subscription' }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const adminCheck = await isAdmin();
    if (!adminCheck) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const adminProfile = await getCurrentUserProfile();
    if (!adminProfile) {
      return NextResponse.json({ error: 'Admin profile not found' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { expires_at } = body;

    if (!expires_at) {
      return NextResponse.json({ error: 'Expiration date is required' }, { status: 400 });
    }

    // Get current subscription to check if it was expired
    const currentSub = await getSubscriptionById(id);
    if (!currentSub) {
      return NextResponse.json({ error: 'Subscription not found' }, { status: 404 });
    }

    const wasExpired = new Date(currentSub.expires_at) < new Date();

    const result = await extendSubscription(id, { expires_at });

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    // If subscription was expired and is now being renewed, restore lesson access
    if (wasExpired && new Date(expires_at) > new Date()) {
      await restoreLessonAccessAfterRenewal(
        currentSub.student_id, 
        currentSub.topic_id, 
        adminProfile.id
      );
    }

    return NextResponse.json({ subscription: result.data });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to extend subscription' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const adminCheck = await isAdmin();
    if (!adminCheck) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const result = await deleteSubscription(id);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to delete subscription' }, { status: 500 });
  }
}
