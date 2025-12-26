/**
 * Helper service to call Supabase Edge Functions
 * This provides an alternative to direct database access when RLS is enabled
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const EDGE_FUNCTION_URL = `${SUPABASE_URL}/functions/v1/admin-api`;

interface EdgeFunctionResponse<T = unknown> {
  data?: T;
  error?: string;
}

/**
 * Call the admin-api edge function
 */
export async function callAdminApi<T = unknown>(
  action: string,
  data?: Record<string, unknown>,
  accessToken?: string
): Promise<EdgeFunctionResponse<T>> {
  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (accessToken) {
      headers['Authorization'] = `Bearer ${accessToken}`;
    }

    const response = await fetch(EDGE_FUNCTION_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify({ action, data }),
    });

    const result = await response.json();

    if (!response.ok) {
      return { error: result.error || 'Request failed' };
    }

    return { data: result.data };
  } catch (error) {
    console.error('Edge function error:', error);
    return { error: 'Failed to call edge function' };
  }
}

// ============ USER OPERATIONS ============

export async function getUsersViaEdge(accessToken: string) {
  return callAdminApi('getUsers', undefined, accessToken);
}

export async function createUserViaEdge(
  accessToken: string,
  userData: {
    username: string;
    password: string;
    role: 'admin' | 'student';
    subscriptions?: string[];
    expires_at?: string;
  }
) {
  return callAdminApi('createUser', userData, accessToken);
}

export async function updateUserViaEdge(
  accessToken: string,
  userId: string,
  updates: {
    username?: string;
    password?: string;
    role?: string;
    subscriptions?: string[];
    expires_at?: string;
  }
) {
  return callAdminApi('updateUser', { userId, ...updates }, accessToken);
}

export async function deleteUserViaEdge(accessToken: string, userId: string) {
  return callAdminApi('deleteUser', { userId }, accessToken);
}

// ============ CARD OPERATIONS ============

export async function getCardsViaEdge(accessToken: string) {
  return callAdminApi('getCards', undefined, accessToken);
}

export async function createCardViaEdge(
  accessToken: string,
  cardData: {
    card_id: string;
    video_url: string;
    title?: string;
    subject?: string;
    required_subscriptions?: string[];
  }
) {
  return callAdminApi('createCard', cardData, accessToken);
}

export async function updateCardViaEdge(
  accessToken: string,
  id: string,
  updates: {
    video_url?: string;
    title?: string;
    subject?: string;
    required_subscriptions?: string[];
  }
) {
  return callAdminApi('updateCard', { id, ...updates }, accessToken);
}

export async function deleteCardViaEdge(accessToken: string, id: string) {
  return callAdminApi('deleteCard', { id }, accessToken);
}

// ============ ACCESS LOG OPERATIONS ============

export async function getAccessLogsViaEdge(
  accessToken: string,
  filters?: {
    userId?: string;
    cardId?: string;
    startDate?: string;
    endDate?: string;
  }
) {
  return callAdminApi('getAccessLogs', filters, accessToken);
}

export async function logAccessViaEdge(
  accessToken: string,
  userId: string,
  cardId: string
) {
  return callAdminApi('logAccess', { userId, cardId }, accessToken);
}
