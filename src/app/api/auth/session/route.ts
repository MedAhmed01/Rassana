import { NextResponse } from 'next/server';
import { validateSession } from '@/services/auth';

export async function GET() {
  try {
    const validation = await validateSession();
    
    if (!validation.valid) {
      return NextResponse.json(
        { error: 'Not authenticated', reason: validation.reason },
        { status: 401 }
      );
    }
    
    return NextResponse.json({
      authenticated: true,
      role: validation.role,
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
