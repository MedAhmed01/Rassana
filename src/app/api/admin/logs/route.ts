import { NextRequest, NextResponse } from 'next/server';
import { checkAdminAuth } from '@/middleware/auth';
import { getAccessLogsWithDetails } from '@/services/accessLogs';

export async function GET(request: NextRequest) {
  try {
    const auth = await checkAdminAuth();
    if (auth.error) return auth.error;
    
    const searchParams = request.nextUrl.searchParams;
    
    const filters = {
      userId: searchParams.get('userId') || undefined,
      cardId: searchParams.get('cardId') || undefined,
      startDate: searchParams.get('startDate') || undefined,
      endDate: searchParams.get('endDate') || undefined,
    };
    
    const logs = await getAccessLogsWithDetails(filters);
    
    return NextResponse.json({ logs });
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
