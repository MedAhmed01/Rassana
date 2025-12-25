import { NextRequest, NextResponse } from 'next/server';
import { checkAuth } from '@/middleware/auth';
import { getCardById } from '@/services/cards';
import { logVideoAccess } from '@/services/accessLogs';
import { createServerSupabaseClient } from '@/lib/supabase';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ cardId: string }> }
) {
  try {
    const auth = await checkAuth();
    if (auth.error) return auth.error;
    
    const { cardId } = await params;
    
    // Get card details
    const card = await getCardById(cardId);
    
    if (!card) {
      return NextResponse.json(
        { error: 'Card not found' },
        { status: 404 }
      );
    }
    
    // Log the access
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user?.id) {
      await logVideoAccess(user.id, cardId);
    }
    
    return NextResponse.json({ 
      videoUrl: card.video_url,
      title: card.title,
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
