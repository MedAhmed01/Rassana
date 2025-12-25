import { NextRequest, NextResponse } from 'next/server';
import { validateSession, isAdmin } from '@/services/auth';

/**
 * Middleware to check if user is authenticated
 * Redirects to login if not authenticated or credentials expired
 */
export async function requireAuth(request: NextRequest): Promise<NextResponse | null> {
  const validation = await validateSession();
  
  if (!validation.valid) {
    // Get the card ID from the URL if present (for redirect after login)
    const cardId = request.nextUrl.pathname.split('/').pop();
    const loginUrl = new URL('/login', request.url);
    
    if (cardId && validation.reason !== 'expired') {
      loginUrl.searchParams.set('redirect', `/access/${cardId}`);
    }
    
    if (validation.reason === 'expired') {
      loginUrl.searchParams.set('error', 'expired');
    }
    
    return NextResponse.redirect(loginUrl);
  }
  
  return null; // Continue to the route handler
}

/**
 * Middleware to check if user has admin role
 * Returns 403 if user is not an admin
 */
export async function requireAdmin(request: NextRequest): Promise<NextResponse | null> {
  const validation = await validateSession();
  
  if (!validation.valid) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }
  
  if (validation.role !== 'admin') {
    return NextResponse.json(
      { error: 'You do not have permission to access this resource' },
      { status: 403 }
    );
  }
  
  return null; // Continue to the route handler
}

/**
 * Check authentication status for API routes
 * Returns auth info or error response
 */
export async function checkAuth(): Promise<{
  authenticated: boolean;
  role?: 'admin' | 'student';
  error?: NextResponse;
}> {
  const validation = await validateSession();
  
  if (!validation.valid) {
    return {
      authenticated: false,
      error: NextResponse.json(
        { error: validation.reason === 'expired' 
          ? 'Your credentials have expired. Please contact an administrator.'
          : 'Unauthorized' 
        },
        { status: 401 }
      ),
    };
  }
  
  return {
    authenticated: true,
    role: validation.role,
  };
}

/**
 * Check if current user is admin for API routes
 */
export async function checkAdminAuth(): Promise<{
  authenticated: boolean;
  isAdmin: boolean;
  error?: NextResponse;
}> {
  const auth = await checkAuth();
  
  if (!auth.authenticated) {
    return { authenticated: false, isAdmin: false, error: auth.error };
  }
  
  if (auth.role !== 'admin') {
    return {
      authenticated: true,
      isAdmin: false,
      error: NextResponse.json(
        { error: 'You do not have permission to access this resource' },
        { status: 403 }
      ),
    };
  }
  
  return { authenticated: true, isAdmin: true };
}
