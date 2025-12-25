import { NextRequest, NextResponse } from 'next/server';
import { checkAuth } from '@/middleware/auth';
import { getCardById } from '@/services/cards';
import { logVideoAccess } from '@/services/accessLogs';
import { createServerSupabaseClient } from '@/lib/supabase';
import { validateSession } from '@/services/auth';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ cardId: string }> }
) {
  try {
    const auth = await checkAuth();
    if (auth.error) return auth.error;
    
    // Validate session token for single session enforcement
    const sessionToken = request.cookies.get('session_token')?.value;
    const validation = await validateSession(sessionToken);
    
    if (!validation.valid) {
      if (validation.reason === 'session_invalidated') {
        return NextResponse.json(
          { error: 'Session expired. Your account was logged in from another device.' },
          { status: 401 }
        );
      }
    }
    
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
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user?.id) {
      await logVideoAccess(session.user.id, cardId);
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
