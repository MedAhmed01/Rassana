import { NextRequest, NextResponse } from 'next/server';
import { checkAdminAuth } from '@/middleware/auth';
import { insertCard, getAllCards } from '@/services/cards';

export async function GET() {
  try {
    const auth = await checkAdminAuth();
    if (auth.error) return auth.error;
    
    const cards = await getAllCards();
    return NextResponse.json({ cards });
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await checkAdminAuth();
    if (auth.error) return auth.error;
    
    const body = await request.json();
    const { card_id, video_url, title, subject } = body;
    
    if (!card_id || !video_url) {
      return NextResponse.json(
        { error: 'card_id and video_url are required' },
        { status: 400 }
      );
    }
    
    const result = await insertCard({
      card_id,
      video_url,
      title,
      subject,
    });
    
    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 400 }
      );
    }
    
    return NextResponse.json({
      success: true,
      card: result.card,
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
