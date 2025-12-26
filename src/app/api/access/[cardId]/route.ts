import { NextRequest, NextResponse } from 'next/server';
import { checkAuth } from '@/middleware/auth';
import { getCardById } from '@/services/cards';
import { logVideoAccess } from '@/services/accessLogs';
import { createServerSupabaseClient, createAdminClient } from '@/lib/supabase';

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
    
    // Check subscription access for students
    if (auth.role === 'student') {
      // Get user's subscriptions using admin client to bypass RLS
      const supabase = await createServerSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        return NextResponse.json(
          { error: 'User not found' },
          { status: 401 }
        );
      }
      
      // Use admin client to read profile (bypasses RLS)
      const adminClient = createAdminClient();
      const { data: profile, error: profileError } = await adminClient
        .from('user_profiles')
        .select('subscriptions')
        .eq('user_id', user.id)
        .single();
      
      console.log('Access check - User ID:', user.id);
      console.log('Access check - Profile:', profile);
      console.log('Access check - Profile error:', profileError);
      
      const userSubscriptions = profile?.subscriptions || [];
      const requiredSubscriptions = card.required_subscriptions || [];
      
      console.log('Access check - User subscriptions:', userSubscriptions);
      console.log('Access check - Required subscriptions:', requiredSubscriptions);
      
      // If card has required subscriptions, check if user has at least one
      // Use case-insensitive comparison
      if (requiredSubscriptions.length > 0) {
        const normalizedUserSubs = userSubscriptions.map((s: string) => s.toLowerCase());
        const hasAccess = requiredSubscriptions.some(required => 
          normalizedUserSubs.includes(required.toLowerCase())
        );
        
        console.log('Access check - Normalized user subs:', normalizedUserSubs);
        console.log('Access check - Has access:', hasAccess);
        
        if (!hasAccess) {
          return NextResponse.json(
            { 
              error: 'Access denied',
              message: `This card requires one of the following subscriptions: ${requiredSubscriptions.join(', ')}`,
              requiredSubscriptions,
              userSubscriptions
            },
            { status: 403 }
          );
        }
      }
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
    console.error('Access error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
