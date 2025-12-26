import { NextRequest, NextResponse } from 'next/server';
import { checkAuth } from '@/middleware/auth';
import { createServerSupabaseClient } from '@/lib/supabase';
import { getWatchProgress } from '@/services/watchProgress';

// GET - Get watch progress for a specific card
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ cardId: string }> }
) {
  try {
    const auth = await checkAuth();
    if (auth.error) return auth.error;
    
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const { cardId } = await params;
    const progress = await getWatchProgress(user.id, cardId);
    
    return NextResponse.json({ 
      success: true,
      data: progress 
    });
  } catch (error) {
    console.error('Get card watch progress error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
