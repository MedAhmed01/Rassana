import { NextRequest, NextResponse } from 'next/server';
import { checkAdminAuth } from '@/middleware/auth';
import { generateQRCodeDataUrl } from '@/services/qrcode';
import { getCardById } from '@/services/cards';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ cardId: string }> }
) {
  try {
    const auth = await checkAdminAuth();
    if (auth.error) return auth.error;
    
    const { cardId } = await params;
    
    // Verify card exists
    const card = await getCardById(cardId);
    if (!card) {
      return NextResponse.json(
        { error: 'Card not found' },
        { status: 404 }
      );
    }
    
    const qrCode = await generateQRCodeDataUrl(cardId);
    
    return NextResponse.json({
      cardId,
      qrCode,
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
