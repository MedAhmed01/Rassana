import { vi } from 'vitest';
import type { UserProfile, Card, AccessLog } from '@/types';

// In-memory storage for mock data
export const mockStorage = {
  users: new Map<string, { id: string; email: string; password: string }>(),
  profiles: new Map<string, UserProfile>(),
  cards: new Map<string, Card>(),
  accessLogs: [] as AccessLog[],
  currentSession: null as { user: { id: string; email: string }; access_token: string; refresh_token: string; expires_at: number } | null,
};

// Reset mock storage
export function resetMockStorage() {
  mockStorage.users.clear();
  mockStorage.profiles.clear();
  mockStorage.cards.clear();
  mockStorage.accessLogs = [];
  mockStorage.currentSession = null;
}

// Mock Supabase auth
export const mockAuth = {
  signInWithPassword: vi.fn(async ({ email, password }: { email: string; password: string }) => {
    const user = Array.from(mockStorage.users.values()).find(
      u => u.email === email && u.password === password
    );
    
    if (!user) {
      return { data: { session: null, user: null }, error: { message: 'Invalid credentials' } };
    }
    
    const session = {
      access_token: `token_${user.id}`,
      refresh_token: `refresh_${user.id}`,
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      user: { id: user.id, email: user.email },
    };
    
    mockStorage.currentSession = session;
    
    return { data: { session, user: { id: user.id, email: user.email } }, error: null };
  }),
  
  signOut: vi.fn(async () => {
    mockStorage.currentSession = null;
    return { error: null };
  }),
  
  getSession: vi.fn(async () => {
    return { data: { session: mockStorage.currentSession }, error: null };
  }),
  
  admin: {
    createUser: vi.fn(async ({ email, password, email_confirm, user_metadata }: any) => {
      // Check for duplicate email
      if (Array.from(mockStorage.users.values()).some(u => u.email === email)) {
        return { data: { user: null }, error: { message: 'User already exists' } };
      }
      
      const id = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const user = { id, email, password };
      mockStorage.users.set(id, user);
      
      return { data: { user: { id, email } }, error: null };
    }),
    
    deleteUser: vi.fn(async (userId: string) => {
      mockStorage.users.delete(userId);
      mockStorage.profiles.delete(userId);
      return { data: null, error: null };
    }),
  },
};

// Mock query builder that returns a thenable object
function createQueryBuilder(table: string) {
  let filters: { column: string; value: any; op: string }[] = [];
  let selectColumns = '*';
  let isSingle = false;
  let orderColumn: string | null = null;
  let orderAsc = true;

  function executeQuery() {
    let results: any[] = [];
    
    if (table === 'user_profiles') {
      results = Array.from(mockStorage.profiles.values());
    } else if (table === 'cards') {
      results = Array.from(mockStorage.cards.values());
    } else if (table === 'access_logs') {
      results = [...mockStorage.accessLogs];
    }
    
    // Apply filters
    for (const filter of filters) {
      results = results.filter(item => {
        const value = item[filter.column];
        if (filter.op === 'eq') return value === filter.value;
        if (filter.op === 'gte') return value >= filter.value;
        if (filter.op === 'lte') return value <= filter.value;
        return true;
      });
    }
    
    // Apply ordering
    if (orderColumn) {
      results.sort((a, b) => {
        const aVal = a[orderColumn!];
        const bVal = b[orderColumn!];
        const cmp = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
        return orderAsc ? cmp : -cmp;
      });
    }
    
    if (isSingle) {
      if (results.length === 0) {
        return { data: null, error: { message: 'No rows found' } };
      } else {
        return { data: results[0], error: null };
      }
    } else {
      return { data: results, error: null };
    }
  }
  
  const builder: any = {
    select: (columns: string = '*') => {
      selectColumns = columns;
      return builder;
    },
    
    eq: (column: string, value: any) => {
      filters.push({ column, value, op: 'eq' });
      return builder;
    },
    
    gte: (column: string, value: any) => {
      filters.push({ column, value, op: 'gte' });
      return builder;
    },
    
    lte: (column: string, value: any) => {
      filters.push({ column, value, op: 'lte' });
      return builder;
    },
    
    single: () => {
      isSingle = true;
      return builder;
    },
    
    order: (column: string, options?: { ascending?: boolean }) => {
      orderColumn = column;
      orderAsc = options?.ascending ?? true;
      return builder;
    },
    
    insert: (data: any) => {
      let insertedData: any = null;
      
      const insertBuilder: any = {
        select: () => insertBuilder,
        single: () => insertBuilder,
        then: async (resolve: (result: any) => void, reject?: (error: any) => void) => {
          try {
            if (table === 'user_profiles') {
              const profile = { id: `profile_${Date.now()}`, ...data, created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
              
              // Check for duplicate username
              const existingByUsername = Array.from(mockStorage.profiles.values()).find(p => p.username === data.username);
              if (existingByUsername) {
                resolve({ data: null, error: { message: 'duplicate key value violates unique constraint', code: '23505' } });
                return;
              }
              
              mockStorage.profiles.set(data.user_id, profile);
              resolve({ data: profile, error: null });
              return;
            }
            
            if (table === 'cards') {
              const card = { id: `card_${Date.now()}`, ...data, created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
              
              // Check for duplicate card_id
              const existingByCardId = Array.from(mockStorage.cards.values()).find(c => c.card_id === data.card_id);
              if (existingByCardId) {
                resolve({ data: null, error: { message: 'duplicate key value violates unique constraint', code: '23505' } });
                return;
              }
              
              mockStorage.cards.set(data.card_id, card);
              resolve({ data: card, error: null });
              return;
            }
            
            if (table === 'access_logs') {
              const log = { id: `log_${Date.now()}`, ...data, accessed_at: data.accessed_at || new Date().toISOString() };
              mockStorage.accessLogs.push(log);
              resolve({ data: log, error: null });
              return;
            }
            
            resolve({ data: null, error: { message: 'Unknown table' } });
          } catch (error) {
            if (reject) reject(error);
          }
        },
      };
      
      return insertBuilder;
    },
    
    update: (data: any) => {
      const updateBuilder: any = {
        eq: (column: string, value: any) => {
          filters.push({ column, value, op: 'eq' });
          return updateBuilder;
        },
        select: () => updateBuilder,
        single: () => updateBuilder,
        then: async (resolve: (result: any) => void, reject?: (error: any) => void) => {
          try {
            if (table === 'cards') {
              const cardIdFilter = filters.find(f => f.column === 'card_id');
              if (cardIdFilter) {
                const card = mockStorage.cards.get(cardIdFilter.value);
                if (card) {
                  const updated = { ...card, ...data, updated_at: new Date().toISOString() };
                  mockStorage.cards.set(cardIdFilter.value, updated);
                  resolve({ data: updated, error: null });
                  return;
                }
              }
            }
            
            if (table === 'user_profiles') {
              const userIdFilter = filters.find(f => f.column === 'user_id');
              if (userIdFilter) {
                const profile = mockStorage.profiles.get(userIdFilter.value);
                if (profile) {
                  const updated = { ...profile, ...data, updated_at: new Date().toISOString() };
                  mockStorage.profiles.set(userIdFilter.value, updated);
                  resolve({ data: updated, error: null });
                  return;
                }
              }
            }
            
            resolve({ data: null, error: { message: 'Not found' } });
          } catch (error) {
            if (reject) reject(error);
          }
        },
      };
      
      return updateBuilder;
    },
    
    delete: () => {
      const deleteBuilder: any = {
        eq: (column: string, value: any) => {
          filters.push({ column, value, op: 'eq' });
          return deleteBuilder;
        },
        then: async (resolve: (result: any) => void, reject?: (error: any) => void) => {
          try {
            if (table === 'cards') {
              const cardIdFilter = filters.find(f => f.column === 'card_id');
              if (cardIdFilter) {
                mockStorage.cards.delete(cardIdFilter.value);
              }
            }
            resolve({ data: null, error: null });
          } catch (error) {
            if (reject) reject(error);
          }
        },
      };
      
      return deleteBuilder;
    },
    
    // Make the builder thenable so it works with await
    then: (resolve: (result: any) => void, reject?: (error: any) => void) => {
      try {
        const result = executeQuery();
        resolve(result);
      } catch (error) {
        if (reject) reject(error);
      }
    },
  };
  
  return builder;
}

// Mock Supabase client
export const mockSupabase = {
  auth: mockAuth,
  from: (table: string) => createQueryBuilder(table),
};

// Setup mock for the supabase module
export function setupSupabaseMock() {
  vi.mock('@/lib/supabase', () => ({
    supabase: mockSupabase,
    createAdminClient: () => mockSupabase,
  }));
}
