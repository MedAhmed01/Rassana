import { NextRequest, NextResponse } from 'next/server';
import { checkAuth } from '@/middleware/auth';
import { createServerSupabaseClient } from '@/lib/supabase';
import { saveWatchProgress, getLastWatchedVideo } from '@/services/watchProgress';

// GET - Get last watched video for continue watching
export async function GET(_request: NextRequest) {
  try {
    const auth = await checkAuth();
    if (auth.error) return auth.error;
    
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    console.log('Fetching watch progress for user:', user.id);
    const lastWatched = await getLastWatchedVideo(user.id);
    console.log('Last watched result:', lastWatched);
    
    // Return with no-cache headers to ensure fresh data
    return NextResponse.json({ 
      success: true,
      data: lastWatched 
    }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        'Pragma': 'no-cache',
      }
    });
  } catch (error) {
    console.error('Get watch progress error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST - Save watch progress
export async function POST(request: NextRequest) {
  try {
    const auth = await checkAuth();
    if (auth.error) return auth.error;
    
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const body = await request.json();
    const { cardId, progressSeconds, durationSeconds } = body;
    
    console.log('Saving watch progress:', { userId: user.id, cardId, progressSeconds, durationSeconds });
    
    if (!cardId || progressSeconds === undefined || durationSeconds === undefined) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }
    
    const result = await saveWatchProgress(
      user.id,
      cardId,
      progressSeconds,
      durationSeconds
    );
    
    console.log('Save result:', result);
    
    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 500 }
      );
    }
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Save watch progress error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
