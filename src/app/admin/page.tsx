'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { RassaLMSTab } from './components/RassaLMSTab';
import type { SubscriptionCategory } from '@/types';

interface User {
  id: string;
  user_id: string;
  username: string;
  phone?: string;
  role: 'admin' | 'student';
  subscriptions?: string[];
  expires_at: string;
  created_at: string;
  device_id?: string;
  device_bound_at?: string;
  device_binding_enabled?: boolean;
}

interface Card {
  id: string;
  card_id: string;
  video_url: string;
  title?: string;
  subject?: string;
  required_subscriptions?: string[];
}

interface ActiveSession {
  id: string;
  user_id: string;
  username: string;
  phone?: string;
  device_id?: string;
  device_binding_enabled?: boolean;
  device_info?: { browser?: string; os?: string; screen?: string; platform?: string };
  ip_address?: string;
  user_agent?: string;
  created_at: string;
  last_seen_at: string;
}

interface AccessLog {
  id: string;
  user_id: string;
  card_id: string;
  accessed_at: string;
  username?: string;
  card_title?: string;
}

function AdminDashboardContent() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'users' | 'cards' | 'logs' | 'lms' | 'settings' | 'devices'>('users');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [users, setUsers] = useState<User[]>([]);
  const [newUser, setNewUser] = useState({ username: '', password: '', phone: '', role: 'student', subscriptions: [] as string[], expires_at: '' });
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editForm, setEditForm] = useState({ username: '', password: '', phone: '', role: 'student', subscriptions: [] as string[], expires_at: '' });

  const [cards, setCards] = useState<Card[]>([]);
  const [newCard, setNewCard] = useState({ card_id: '', video_url: '', title: '', subject: '', required_subscriptions: [] as string[] });
  const [editingCard, setEditingCard] = useState<Card | null>(null);
  const [editCardForm, setEditCardForm] = useState({ video_url: '', title: '', subject: '', required_subscriptions: [] as string[] });
  const [cardQrCodes, setCardQrCodes] = useState<Record<string, string>>({});
  const [loadingQr, setLoadingQr] = useState<Record<string, boolean>>({});
  const [copiedCardId, setCopiedCardId] = useState<string | null>(null);
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [isCreateUserOpen, setIsCreateUserOpen] = useState(true);
  const [isUsersListOpen, setIsUsersListOpen] = useState(true);
  const [cardSearchQuery, setCardSearchQuery] = useState('');
  const [cardCategoryFilter, setCardCategoryFilter] = useState<string>('all');
  const [isCreateCardOpen, setIsCreateCardOpen] = useState(false);

  const USERS_PER_PAGE = 20;
  const [userCurrentPage, setUserCurrentPage] = useState(1);

  const [logs, setLogs] = useState<AccessLog[]>([]);
  const [logFilters, setLogFilters] = useState({ userId: '', cardId: '', startDate: '', endDate: '' });

  const [categories, setCategories] = useState<SubscriptionCategory[]>([]);
  const [newCategory, setNewCategory] = useState({ label: '', color: 'slate' });
  const [confirmDeleteCategory, setConfirmDeleteCategory] = useState<string | null>(null);

  // Devices tab state
  const [activeSessions, setActiveSessions] = useState<ActiveSession[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [devicesInitialLoading, setDevicesInitialLoading] = useState(true);
  const [globalBindingMode, setGlobalBindingMode] = useState<'off' | 'per_user' | 'all'>('per_user');
  const [bindingModeLoading, setBindingModeLoading] = useState(false);
  const [deviceFilter, setDeviceFilter] = useState<'all' | 'multi'>('all');

  const availableSubscriptions = categories.filter(c => !c.hidden).map(c => c.id);
  const subscriptionLabels: Record<string, string> = Object.fromEntries(
    categories.map(c => [c.id, c.label])
  );

  const COLOR_MAP: Record<string, { gradient: string; ring: string; active: string; inactive: string; tagBg: string; tagText: string; tagRing: string; swatch: string }> = {
    orange: { gradient: 'from-[#ff8240] to-[#ff8240]', ring: 'ring-[#ff8240]/30', active: 'bg-[#ff8240] text-white shadow-lg shadow-[#ff8240]/25', inactive: 'bg-[#fff5f0] text-[#ff8240] hover:bg-[#ffe8d9]', tagBg: 'bg-[#fff5f0]', tagText: 'text-[#e06620]', tagRing: 'ring-[#ffd4b8]', swatch: 'bg-[#ff8240]' },
    teal:   { gradient: 'from-[#00f99d] to-pink-500', ring: 'ring-[#00f99d]/30', active: 'bg-[#00f99d] text-white shadow-lg shadow-[#00f99d]/25', inactive: 'bg-[#e6fff5] text-[#00c97d] hover:bg-[#ccfff0]', tagBg: 'bg-[#e6fff5]', tagText: 'text-[#00c97d]', tagRing: 'ring-[#b3ffdb]', swatch: 'bg-[#00f99d]' },
    green:  { gradient: 'from-green-500 to-emerald-500', ring: 'ring-green-500/30', active: 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/25', inactive: 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100', tagBg: 'bg-green-50', tagText: 'text-green-700', tagRing: 'ring-green-200', swatch: 'bg-green-500' },
    blue:   { gradient: 'from-blue-500 to-indigo-600', ring: 'ring-blue-500/30', active: 'bg-blue-500 text-white shadow-lg shadow-blue-500/25', inactive: 'bg-blue-50 text-blue-600 hover:bg-blue-100', tagBg: 'bg-blue-50', tagText: 'text-blue-700', tagRing: 'ring-blue-200', swatch: 'bg-blue-500' },
    purple: { gradient: 'from-purple-500 to-violet-600', ring: 'ring-purple-500/30', active: 'bg-purple-500 text-white shadow-lg shadow-purple-500/25', inactive: 'bg-purple-50 text-purple-600 hover:bg-purple-100', tagBg: 'bg-purple-50', tagText: 'text-purple-700', tagRing: 'ring-purple-200', swatch: 'bg-purple-500' },
    cyan:   { gradient: 'from-cyan-500 to-blue-500', ring: 'ring-cyan-500/30', active: 'bg-cyan-500 text-white shadow-lg shadow-cyan-500/25', inactive: 'bg-cyan-50 text-cyan-600 hover:bg-cyan-100', tagBg: 'bg-cyan-50', tagText: 'text-cyan-700', tagRing: 'ring-cyan-200', swatch: 'bg-cyan-500' },
    rose:   { gradient: 'from-rose-500 to-red-600', ring: 'ring-rose-500/30', active: 'bg-rose-500 text-white shadow-lg shadow-rose-500/25', inactive: 'bg-rose-50 text-rose-600 hover:bg-rose-100', tagBg: 'bg-rose-50', tagText: 'text-rose-700', tagRing: 'ring-rose-200', swatch: 'bg-rose-500' },
    amber:  { gradient: 'from-amber-500 to-orange-600', ring: 'ring-amber-500/30', active: 'bg-amber-500 text-white shadow-lg shadow-amber-500/25', inactive: 'bg-amber-50 text-amber-600 hover:bg-amber-100', tagBg: 'bg-amber-50', tagText: 'text-amber-700', tagRing: 'ring-amber-200', swatch: 'bg-amber-500' },
    indigo: { gradient: 'from-indigo-500 to-violet-600', ring: 'ring-indigo-500/30', active: 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/25', inactive: 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100', tagBg: 'bg-indigo-50', tagText: 'text-indigo-700', tagRing: 'ring-indigo-200', swatch: 'bg-indigo-500' },
    pink:   { gradient: 'from-pink-500 to-rose-500', ring: 'ring-pink-500/30', active: 'bg-pink-500 text-white shadow-lg shadow-pink-500/25', inactive: 'bg-pink-50 text-pink-600 hover:bg-pink-100', tagBg: 'bg-pink-50', tagText: 'text-pink-700', tagRing: 'ring-pink-200', swatch: 'bg-pink-500' },
    slate:  { gradient: 'from-slate-500 to-slate-600', ring: 'ring-slate-500/30', active: 'bg-slate-500 text-white shadow-lg shadow-slate-500/25', inactive: 'bg-slate-50 text-slate-600 hover:bg-slate-100', tagBg: 'bg-slate-50', tagText: 'text-slate-700', tagRing: 'ring-slate-200', swatch: 'bg-slate-500' },
  };

  function getCategoryColors(colorKey: string) {
    return COLOR_MAP[colorKey] || COLOR_MAP.slate;
  }

  useEffect(() => {
    setUserCurrentPage(1);
  }, [userSearchQuery]);

  function toggleSubscription(current: string[], subscription: string): string[] {
    if (current.includes(subscription)) {
      return current.filter(s => s !== subscription);
    }
    return [...current, subscription];
  }

  useEffect(() => {
    checkAuth();
  }, []);

  // Lazy-load QR codes only when the Cards tab is active.
  // Avoids flooding the network with 25+ requests on initial mount
  // when the user may be on a different tab (e.g. Devices).
  useEffect(() => {
    if (activeTab !== 'cards') return;
    cards.forEach(card => {
      if (!cardQrCodes[card.card_id] && !loadingQr[card.card_id]) {
        loadQrCode(card.card_id);
      }
    });
  }, [cards, activeTab]);

  // Load devices data when switching to devices tab
  useEffect(() => {
    if (activeTab === 'devices') {
      setDevicesInitialLoading(true);
      loadDevicesTab(true);
    }
  }, [activeTab]);

  async function checkAuth() {
    try {
      const response = await fetch('/api/auth/session');
      const data = await response.json();

      if (!response.ok || data.role !== 'admin') {
        router.push('/login');
        return;
      }

      setLoading(false);
      loadUsers();
      loadCards();
      loadLogs();
      loadCategories();
    } catch (err) {
      router.push('/login');
    }
  }

  async function loadUsers() {
    const response = await fetch('/api/admin/users');
    if (response.ok) {
      const data = await response.json();
      setUsers(data.users || []);
    }
  }

  async function loadCards() {
    const response = await fetch('/api/admin/cards');
    if (response.ok) {
      const data = await response.json();
      setCards(data.cards || []);
    }
  }

  async function loadCategories() {
    const response = await fetch('/api/admin/categories');
    if (response.ok) {
      const data = await response.json();
      setCategories(data.categories || []);
    }
  }

  async function loadDevicesTab(isInitial = false) {
    setSessionsLoading(true);
    try {
      const response = await fetch('/api/admin/sessions');
      if (response.ok) {
        const data = await response.json();
        setActiveSessions(data.sessions || []);
        if (data.bindingMode) setGlobalBindingMode(data.bindingMode);
      }
    } finally {
      setSessionsLoading(false);
      if (isInitial) setDevicesInitialLoading(false);
    }
  }

  async function handleSetGlobalBindingMode(mode: 'off' | 'per_user' | 'all') {
    setBindingModeLoading(true);
    try {
      const response = await fetch('/api/admin/settings/device-binding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode }),
      });
      if (response.ok) {
        const data = await response.json();
        setGlobalBindingMode(mode);
        // If switching to 'all', refresh the session list so terminated
        // multi-device sessions disappear immediately from the UI.
        if (mode === 'all' && data.terminatedCount > 0) {
          loadDevicesTab();
        }
      }
    } finally {
      setBindingModeLoading(false);
    }
  }

  async function handleTerminateSession(sessionId: string) {
    if (!confirm('Disconnect this session? The user will be logged out on their next action.')) return;
    try {
      const response = await fetch(`/api/admin/sessions/${sessionId}`, { method: 'DELETE' });
      if (response.ok) {
        loadDevicesTab();
      }
    } catch { /* ignore */ }
  }

  async function loadLogs() {
    const params = new URLSearchParams();
    if (logFilters.userId) params.set('userId', logFilters.userId);
    if (logFilters.cardId) params.set('cardId', logFilters.cardId);
    if (logFilters.startDate) params.set('startDate', logFilters.startDate);
    if (logFilters.endDate) params.set('endDate', logFilters.endDate);

    const response = await fetch(`/api/admin/logs?${params}`);
    if (response.ok) {
      const data = await response.json();
      setLogs(data.logs || []);
    }
  }

  async function loadQrCode(cardId: string) {
    setLoadingQr(prev => ({ ...prev, [cardId]: true }));
    try {
      const response = await fetch(`/api/admin/cards/${cardId}/qr`);
      if (response.ok) {
        const data = await response.json();
        setCardQrCodes(prev => ({ ...prev, [cardId]: data.qrCode }));
      }
    } catch (err) {
      console.error('Failed to load QR code for', cardId);
    } finally {
      setLoadingQr(prev => ({ ...prev, [cardId]: false }));
    }
  }

  function getAccessUrl(cardId: string): string {
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
    return `${baseUrl}/access/${encodeURIComponent(cardId)}`;
  }

  async function copyAccessLink(cardId: string) {
    const url = getAccessUrl(cardId);
    try {
      await navigator.clipboard.writeText(url);
      setCopiedCardId(cardId);
      setTimeout(() => setCopiedCardId(null), 2000);
    } catch (err) {
      setError('Failed to copy link');
    }
  }

  async function handleCreateUser(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    const response = await fetch('/api/admin/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newUser),
    });

    const data = await response.json();

    if (!response.ok) {
      setError(data.error || 'Failed to create user');
      return;
    }

    setNewUser({ username: '', password: '', phone: '', role: 'student', subscriptions: [], expires_at: '' });
    loadUsers();
  }

  async function handleUpdateUser(e: React.FormEvent) {
    e.preventDefault();
    if (!editingUser) return;

    setError('');

    console.log('Updating user with data:', editForm);

    const response = await fetch(`/api/admin/users/${editingUser.user_id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editForm),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Update error:', data);
      setError(data.error || 'Failed to update user');
      return;
    }

    console.log('Update successful');
    setEditingUser(null);
    setEditForm({ username: '', password: '', phone: '', role: 'student', subscriptions: [], expires_at: '' });
    loadUsers();
  }

  async function handleDeleteUser(userId: string, username: string) {
    if (!confirm(`Delete user "${username}"? This cannot be undone.`)) return;

    setError('');
    try {
      console.log('Deleting user:', userId);
      const response = await fetch(`/api/admin/users/${userId}`, { method: 'DELETE' });
      const data = await response.json();
      console.log('Delete response:', data);

      if (!response.ok) {
        setError(data.error || 'Failed to delete user');
        console.error('Delete user error:', data);
        return;
      }

      // Remove user from local state immediately
      setUsers(prev => prev.filter(u => u.user_id !== userId));
      console.log('User deleted successfully');
    } catch (err) {
      console.error('Delete user error:', err);
      setError('Network error while deleting user');
    }
  }

  async function handleForceLogout(userId: string, username: string) {
    if (!confirm(`Force logout "${username}"? This will end their current session.`)) return;

    setError('');
    try {
      const response = await fetch(`/api/admin/users/${userId}/force-logout`, { method: 'POST' });
      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Failed to force logout user');
        return;
      }

      alert(`${username} has been logged out successfully.`);
    } catch (err) {
      console.error('Force logout error:', err);
      setError('Network error while forcing logout');
    }
  }

  async function handleToggleDeviceBinding(userId: string, username: string, currentEnabled: boolean) {
    const action = currentEnabled ? 'disable' : 'enable';
    if (!confirm(`${action === 'enable' ? 'Enable' : 'Disable'} device binding for "${username}"?${action === 'disable' ? ' This will also clear their bound device.' : ''}`)) return;

    setError('');
    try {
      const response = await fetch(`/api/admin/users/${userId}/device-binding`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !currentEnabled }),
      });
      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Failed to toggle device binding');
        return;
      }

      loadUsers();
      alert(data.message);
    } catch (err) {
      console.error('Device binding toggle error:', err);
      setError('Network error while toggling device binding');
    }
  }

  async function handleResetDevice(userId: string, username: string) {
    if (!confirm(`Reset device for "${username}"? This will allow them to login from a new device.`)) return;

    setError('');
    try {
      const response = await fetch(`/api/admin/users/${userId}/device-binding`, { method: 'DELETE' });
      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Failed to reset device');
        return;
      }

      loadUsers();
      alert(data.message);
    } catch (err) {
      console.error('Device reset error:', err);
      setError('Network error while resetting device');
    }
  }

  function startEditUser(user: User) {
    setEditingUser(user);
    setEditForm({
      username: user.username,
      password: '',
      phone: user.phone || '',
      role: user.role,
      subscriptions: user.subscriptions || [],
      expires_at: new Date(user.expires_at).toISOString().split('T')[0],
    });
  }

  async function handleCreateCard(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    const response = await fetch('/api/admin/cards', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newCard),
    });

    const data = await response.json();

    if (!response.ok) {
      setError(data.error || 'Failed to create card');
      return;
    }

    setNewCard({ card_id: '', video_url: '', title: '', subject: '', required_subscriptions: [] });
    loadCards();
  }

  function startEditCard(card: Card) {
    setEditingCard(card);
    setEditCardForm({
      video_url: card.video_url,
      title: card.title || '',
      subject: card.subject || '',
      required_subscriptions: card.required_subscriptions || [],
    });
  }

  async function handleUpdateCard(e: React.FormEvent) {
    e.preventDefault();
    if (!editingCard) return;

    setError('');

    const response = await fetch(`/api/admin/cards/${editingCard.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editCardForm),
    });

    const data = await response.json();

    if (!response.ok) {
      setError(data.error || 'Failed to update card');
      return;
    }

    setEditingCard(null);
    setEditCardForm({ video_url: '', title: '', subject: '', required_subscriptions: [] });
    loadCards();
  }

  async function handleDeleteCard(card: Card) {
    if (!confirm(`Delete card "${card.card_id}"? This cannot be undone.`)) return;

    setError('');
    const response = await fetch(`/api/admin/cards/${card.id}`, { method: 'DELETE' });

    if (!response.ok) {
      const data = await response.json();
      setError(data.error || 'Failed to delete card');
      return;
    }

    // Remove QR code from cache
    setCardQrCodes(prev => {
      const updated = { ...prev };
      delete updated[card.card_id];
      return updated;
    });

    loadCards();
  }

  async function handleLogout() {
    try {
      const response = await fetch('/api/auth/logout', { method: 'POST' });
      if (response.ok) {
        // Force a hard redirect to clear all client state
        window.location.href = '/login';
      } else {
        setError('Failed to logout');
      }
    } catch (err) {
      setError('Logout failed');
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-[#ff8240] border-t-transparent rounded-full animate-spin"></div>
          <p className="text-gray-500 text-sm">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  const tabs = [
    { id: 'users' as const, label: 'Users', icon: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z' },
    { id: 'cards' as const, label: 'Cards', icon: 'M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10' },
    { id: 'logs' as const, label: 'Logs', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01' },
    { id: 'lms' as const, label: 'Rassa LMS', icon: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253' },
    { id: 'devices' as const, label: 'Devices', icon: 'M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z' },
    { id: 'settings' as const, label: 'Settings', icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z' },
  ];

  const filteredUsers = users.filter(user => {
    const query = userSearchQuery.toLowerCase();
    return user.username.toLowerCase().includes(query) ||
      (user.phone && user.phone.toLowerCase().includes(query));
  });

  const totalPages = Math.ceil(filteredUsers.length / USERS_PER_PAGE);
  const paginatedUsers = filteredUsers.slice(
    (userCurrentPage - 1) * USERS_PER_PAGE,
    userCurrentPage * USERS_PER_PAGE
  );


  return (
    <div className="min-h-screen bg-slate-50">
      {/* Modern Header */}
      <header className="sticky top-0 z-40 bg-slate-50">
        {/* Content Container - Same max-width as main content */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
          {/* Header Card */}
          <div className="relative overflow-hidden bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 rounded-2xl border border-slate-700/50 p-4 sm:p-5">
            {/* Decorative elements */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-[#ff8240]/20 via-[#00f99d]/10 to-transparent rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
            <div className="absolute bottom-0 left-0 w-48 h-48 bg-gradient-to-tr from-[#ff8240]/10 via-[#ff8240]/5 to-transparent rounded-full blur-2xl translate-y-1/2 -translate-x-1/2"></div>

            {/* Main Header Content */}
            <div className="relative flex items-center justify-between mb-4">
              {/* Logo & Title */}
              <div className="flex items-center gap-3 sm:gap-4">
                {/* Animated Logo */}
                <div className="relative group">
                  <div className="absolute -inset-1 bg-gradient-to-r from-[#ff8240] via-[#00f99d] to-[#ff8240] rounded-2xl blur opacity-40 group-hover:opacity-60 transition-opacity duration-300"></div>
                  <div className="relative w-11 h-11 sm:w-12 sm:h-12 bg-gradient-to-br from-[#ff8240] via-[#ff8240] to-[#00f99d] rounded-xl sm:rounded-2xl flex items-center justify-center shadow-lg transform group-hover:scale-105 transition-transform duration-300">
                    <svg className="w-6 h-6 sm:w-7 sm:h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                  </div>
                </div>

                {/* Title */}
                <div>
                  <h1 className="text-lg sm:text-xl font-bold text-white tracking-tight">
                    Admin Dashboard
                  </h1>
                  <p className="text-slate-400 text-xs sm:text-sm hidden sm:flex items-center gap-1.5 mt-0.5">
                    <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse"></span>
                    Manage users, cards & access logs
                  </p>
                </div>
              </div>

              {/* Right Side Actions */}
              <div className="flex items-center gap-2 sm:gap-3">
                {/* Status Badge - Hidden on mobile */}
                <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-slate-700/50 backdrop-blur-sm rounded-full border border-slate-600/50">
                  <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></span>
                  <span className="text-xs font-medium text-slate-300">System Online</span>
                </div>

                {/* Sign Out Button */}
                <button
                  onClick={handleLogout}
                  className="group relative flex items-center gap-2 px-3 sm:px-4 py-2 sm:py-2.5 bg-slate-700/50 hover:bg-red-500/20 backdrop-blur-sm border border-slate-600/50 hover:border-red-500/50 rounded-xl text-slate-300 hover:text-red-400 transition-all duration-300"
                >
                  <svg className="w-4 h-4 sm:w-5 sm:h-5 transition-transform group-hover:-translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                  <span className="text-sm font-medium hidden sm:inline">Sign out</span>
                </button>
              </div>
            </div>

            {/* Tab Navigation - Centered */}
            <nav className="relative flex justify-center gap-1 sm:gap-2 overflow-x-auto scrollbar-hide -mx-2 px-2">
              {tabs.map((tab) => {
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`relative flex items-center gap-2 px-4 sm:px-5 py-2.5 sm:py-3 text-sm font-medium rounded-xl whitespace-nowrap transition-all duration-300 ${isActive
                      ? 'text-white'
                      : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
                      }`}
                  >
                    {/* Active Background */}
                    {isActive && (
                      <div className="absolute inset-0 bg-gradient-to-r from-[#ff8240] to-[#00f99d] rounded-xl shadow-lg shadow-[#ff8240]/25"></div>
                    )}

                    {/* Content */}
                    <div className="relative flex items-center gap-2">
                      <svg className={`w-5 h-5 transition-transform ${isActive ? 'scale-110' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={isActive ? 2.5 : 2} d={tab.icon} />
                      </svg>
                      <span className="hidden sm:inline">{tab.label}</span>

                      {/* Badge for counts */}
                      {tab.id === 'users' && users.length > 0 && (
                        <span className={`hidden sm:inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 text-xs font-bold rounded-full ${isActive ? 'bg-white/20 text-white' : 'bg-slate-600 text-slate-300'
                          }`}>
                          {users.length}
                        </span>
                      )}
                      {tab.id === 'cards' && cards.length > 0 && (
                        <span className={`hidden sm:inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 text-xs font-bold rounded-full ${isActive ? 'bg-white/20 text-white' : 'bg-slate-600 text-slate-300'
                          }`}>
                          {cards.length}
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </nav>
          </div>
        </div>
      </header>

      {/* Error Alert */}
      {error && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 mt-4">
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
            <svg className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            <p className="text-sm text-red-700">{error}</p>
            <button onClick={() => setError('')} className="ml-auto text-red-500 hover:text-red-700">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        {/* Users Tab */}
        {activeTab === 'users' && (
          <div className="space-y-6">
            {/* Create User Form - Modern Redesign */}
            <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-1">
              {/* Animated gradient border */}
              <div className="absolute inset-0 bg-gradient-to-r from-[#ff8240] via-[#00f99d] to-pink-500 opacity-20 blur-xl"></div>

              <div className="relative bg-slate-900/90 backdrop-blur-xl rounded-[22px]">
                {/* Collapsible Header */}
                <button
                  onClick={() => setIsCreateUserOpen(!isCreateUserOpen)}
                  className="w-full flex items-center justify-between p-6 sm:p-8 cursor-pointer group"
                >
                  <div className="flex items-center gap-4">
                    <div className="relative">
                      <div className="absolute inset-0 bg-gradient-to-r from-[#ff8240] to-[#00f99d] rounded-2xl blur-lg opacity-50"></div>
                      <div className="relative w-14 h-14 bg-gradient-to-br from-[#ff8240] to-[#00f99d] rounded-2xl flex items-center justify-center shadow-lg">
                        <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                        </svg>
                      </div>
                    </div>
                    <div className="text-left">
                      <h2 className="text-xl sm:text-2xl font-bold text-white">Create New User</h2>
                      <p className="text-slate-400 text-sm mt-0.5">Add a new student or admin to the system</p>
                    </div>
                  </div>
                  <div className={`w-10 h-10 rounded-xl bg-slate-800/50 flex items-center justify-center transition-transform duration-300 ${isCreateUserOpen ? 'rotate-180' : ''}`}>
                    <svg className="w-5 h-5 text-slate-400 group-hover:text-white transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </button>

                {/* Collapsible Content */}
                <div className={`overflow-hidden transition-all duration-300 ease-in-out ${isCreateUserOpen ? 'max-h-[1000px] opacity-100' : 'max-h-0 opacity-0'}`}>
                  <div className="px-6 sm:px-8 pb-6 sm:pb-8">
                    <form onSubmit={handleCreateUser} className="space-y-6">
                      {/* Input Fields Grid */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
                        {/* Username Field */}
                        <div className="group">
                          <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 ml-1">
                            Username
                          </label>
                          <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                              <svg className="w-5 h-5 text-slate-500 group-focus-within:text-[#e9b48e] transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                              </svg>
                            </div>
                            <input
                              type="text"
                              placeholder="Enter username"
                              value={newUser.username}
                              onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
                              className="w-full pl-12 pr-4 py-3.5 bg-slate-800/50 border border-slate-700/50 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#ff8240]/50 focus:border-[#ff8240]/50 focus:bg-slate-800 transition-all duration-200"
                              required
                            />
                          </div>
                        </div>

                        {/* Password Field */}
                        <div className="group">
                          <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 ml-1">
                            Password
                          </label>
                          <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                              <svg className="w-5 h-5 text-slate-500 group-focus-within:text-[#e9b48e] transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                              </svg>
                            </div>
                            <input
                              type="password"
                              placeholder="Enter password"
                              value={newUser.password}
                              onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                              className="w-full pl-12 pr-4 py-3.5 bg-slate-800/50 border border-slate-700/50 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#ff8240]/50 focus:border-[#ff8240]/50 focus:bg-slate-800 transition-all duration-200"
                              required
                            />
                          </div>
                        </div>

                        {/* Phone Field (Optional) */}
                        <div className="group">
                          <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 ml-1">
                            Phone <span className="text-slate-600">(Optional)</span>
                          </label>
                          <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                              <svg className="w-5 h-5 text-slate-500 group-focus-within:text-[#e9b48e] transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                              </svg>
                            </div>
                            <input
                              type="tel"
                              placeholder="e.g. 0612345678"
                              value={newUser.phone}
                              onChange={(e) => setNewUser({ ...newUser, phone: e.target.value })}
                              className="w-full pl-12 pr-4 py-3.5 bg-slate-800/50 border border-slate-700/50 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#ff8240]/50 focus:border-[#ff8240]/50 focus:bg-slate-800 transition-all duration-200"
                            />
                          </div>
                        </div>

                        {/* Role Field */}
                        <div className="group">
                          <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 ml-1">
                            Role
                          </label>
                          <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                              <svg className="w-5 h-5 text-slate-500 group-focus-within:text-[#e9b48e] transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                              </svg>
                            </div>
                            <select
                              value={newUser.role}
                              onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
                              className="w-full pl-12 pr-10 py-3.5 bg-slate-800/50 border border-slate-700/50 rounded-xl text-white appearance-none focus:outline-none focus:ring-2 focus:ring-[#ff8240]/50 focus:border-[#ff8240]/50 focus:bg-slate-800 transition-all duration-200 cursor-pointer"
                            >
                              <option value="student">Student</option>
                              <option value="admin">Admin</option>
                            </select>
                            <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none">
                              <svg className="w-5 h-5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                              </svg>
                            </div>
                          </div>
                        </div>

                        {/* Expiration Date Field - Only for students */}
                        {newUser.role === 'student' && (
                          <div className="group">
                            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 ml-1">
                              Expires On
                            </label>
                            <div className="relative">
                              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                <svg className="w-5 h-5 text-slate-500 group-focus-within:text-[#e9b48e] transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                              </div>
                              <input
                                type="date"
                                value={newUser.expires_at}
                                onChange={(e) => setNewUser({ ...newUser, expires_at: e.target.value })}
                                className="w-full pl-12 pr-4 py-3.5 bg-slate-800/50 border border-slate-700/50 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-[#ff8240]/50 focus:border-[#ff8240]/50 focus:bg-slate-800 transition-all duration-200 [color-scheme:dark]"
                                required
                              />
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Subscriptions Section */}
                      {newUser.role === 'student' && (
                        <div className="pt-2">
                          <div className="flex items-center gap-2 mb-4">
                            <svg className="w-5 h-5 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                            </svg>
                            <label className="text-sm font-semibold text-white">Subscriptions</label>
                            <span className="text-xs text-slate-500 ml-auto">Select access levels</span>
                          </div>
                          <div className="flex flex-wrap gap-3">
                            {availableSubscriptions.map((sub) => {
                              const isSelected = newUser.subscriptions.includes(sub);
                              const catColor = categories.find(c => c.id === sub)?.color || 'slate';
                              const color = getCategoryColors(catColor);

                              return (
                                <button
                                  key={sub}
                                  type="button"
                                  onClick={() => setNewUser({ ...newUser, subscriptions: toggleSubscription(newUser.subscriptions, sub) })}
                                  className={`relative group flex items-center gap-2.5 px-5 py-3 rounded-xl font-medium text-sm transition-all duration-300 ${isSelected
                                    ? `bg-gradient-to-r ${color.gradient} text-white shadow-lg scale-[1.02]`
                                    : `bg-slate-800/50 text-slate-400 hover:text-white hover:bg-slate-700/50 ring-1 ring-slate-700/50 hover:ring-slate-600`
                                    }`}
                                >
                                  <span className={`w-2 h-2 rounded-full ${isSelected ? 'bg-white/80' : color.swatch}`}></span>
                                  <span>{subscriptionLabels[sub] || sub.charAt(0).toUpperCase() + sub.slice(1)}</span>
                                  {isSelected && (
                                    <svg className="w-4 h-4 ml-1" fill="currentColor" viewBox="0 0 20 20">
                                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                    </svg>
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Submit Button */}
                      <div className="pt-4">
                        <button
                          type="submit"
                          className="group relative w-full overflow-hidden rounded-xl bg-gradient-to-r from-[#ff8240] via-[#ff8240] to-[#00f99d] p-[2px] transition-all duration-300 hover:shadow-lg hover:shadow-[#ff8240]/25"
                        >
                          <div className="relative flex items-center justify-center gap-2 rounded-[10px] bg-gradient-to-r from-[#ff8240] via-[#ff8240] to-[#00f99d] px-6 py-4 transition-all group-hover:bg-opacity-0">
                            <svg className="w-5 h-5 text-white transition-transform group-hover:rotate-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                            </svg>
                            <span className="font-semibold text-white text-base">Create User</span>
                          </div>
                          {/* Shine effect */}
                          <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 bg-gradient-to-r from-transparent via-white/20 to-transparent"></div>
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              </div>
            </div>

            {/* Users List - Modern Card Design */}
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
              {/* Collapsible Header */}
              <button
                onClick={() => setIsUsersListOpen(!isUsersListOpen)}
                className="w-full flex items-center justify-between p-5 cursor-pointer group hover:bg-slate-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-slate-100 to-slate-200 rounded-xl flex items-center justify-center">
                    <svg className="w-5 h-5 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                  </div>
                  <div className="text-left">
                    <h3 className="text-lg font-bold text-slate-900">All Users</h3>
                    <p className="text-sm text-slate-500">
                      {filteredUsers.length > 0 ? (
                        <>
                          Showing {Math.min((userCurrentPage - 1) * USERS_PER_PAGE + 1, filteredUsers.length)} - {Math.min(userCurrentPage * USERS_PER_PAGE, filteredUsers.length)} of {filteredUsers.length} user{filteredUsers.length !== 1 ? 's' : ''}
                        </>
                      ) : (
                        <>0 users registered</>
                      )}
                    </p>
                  </div>
                </div>
                <div className={`w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center transition-transform duration-300 ${isUsersListOpen ? 'rotate-180' : ''}`}>
                  <svg className="w-4 h-4 text-slate-500 group-hover:text-slate-700 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </button>

              {/* Collapsible Content */}
              <div className={`overflow-hidden transition-all duration-300 ease-in-out ${isUsersListOpen ? 'max-h-[5000px] opacity-100' : 'max-h-0 opacity-0'}`}>
                <div className="border-t border-slate-100 p-5 space-y-4">
                  {/* Search Input */}
                  <div className="relative w-full sm:w-72">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <svg className="w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                    </div>
                    <input
                      type="text"
                      placeholder="Search by username or phone..."
                      value={userSearchQuery}
                      onChange={(e) => setUserSearchQuery(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#ff8240]/20 focus:border-[#ff8240] focus:bg-white transition-all"
                    />
                    {userSearchQuery && (
                      <button
                        onClick={() => setUserSearchQuery('')}
                        className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    )}
                  </div>

                  {/* Users Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {paginatedUsers
                      .map((user) => {
                        const isExpired = new Date(user.expires_at) < new Date();
                        const isExpiringSoon = !isExpired && new Date(user.expires_at) < new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

                        return (
                          <div
                            key={user.user_id}
                            className="group relative bg-white rounded-2xl border border-slate-200 hover:border-slate-300 hover:shadow-lg hover:shadow-slate-200/50 transition-all duration-300 overflow-hidden"
                          >
                            {/* Card Header with gradient */}
                            <div className={`relative h-20 ${user.role === 'admin'
                              ? 'bg-gradient-to-br from-violet-500 via-[#00f99d] to-indigo-600'
                              : 'bg-gradient-to-br from-slate-600 via-slate-700 to-slate-800'
                              }`}>
                              {/* Pattern overlay */}
                              <div className="absolute inset-0 opacity-10">
                                <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                                  <defs>
                                    <pattern id={`grid-${user.user_id}`} width="10" height="10" patternUnits="userSpaceOnUse">
                                      <circle cx="1" cy="1" r="1" fill="white" />
                                    </pattern>
                                  </defs>
                                  <rect width="100" height="100" fill={`url(#grid-${user.user_id})`} />
                                </svg>
                              </div>

                              {/* Role Badge */}
                              <div className="absolute top-3 right-3">
                                <span className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold rounded-full backdrop-blur-sm ${user.role === 'admin'
                                  ? 'bg-white/20 text-white'
                                  : 'bg-white/20 text-white'
                                  }`}>
                                  {user.role === 'admin' ? (
                                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                      <path fillRule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                    </svg>
                                  ) : (
                                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                      <path d="M10.394 2.08a1 1 0 00-.788 0l-7 3a1 1 0 000 1.84L5.25 8.051a.999.999 0 01.356-.257l4-1.714a1 1 0 11.788 1.838L7.667 9.088l1.94.831a1 1 0 00.787 0l7-3a1 1 0 000-1.838l-7-3zM3.31 9.397L5 10.12v4.102a8.969 8.969 0 00-1.05-.174 1 1 0 01-.89-.89 11.115 11.115 0 01.25-3.762zM9.3 16.573A9.026 9.026 0 007 14.935v-3.957l1.818.78a3 3 0 002.364 0l5.508-2.361a11.026 11.026 0 01.25 3.762 1 1 0 01-.89.89 8.968 8.968 0 00-5.35 2.524 1 1 0 01-1.4 0z" />
                                    </svg>
                                  )}
                                  {user.role}
                                </span>
                              </div>

                              {/* Avatar */}
                              <div className="absolute -bottom-8 left-5">
                                <div className="relative">
                                  <div className={`w-16 h-16 rounded-2xl flex items-center justify-center text-xl font-bold shadow-lg border-4 border-white ${user.role === 'admin'
                                    ? 'bg-gradient-to-br from-violet-400 to-[#00f99d] text-white'
                                    : 'bg-gradient-to-br from-slate-100 to-slate-200 text-slate-600'
                                    }`}>
                                    {user.username.charAt(0).toUpperCase()}
                                  </div>
                                  {/* Online indicator */}
                                  <div className={`absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full border-2 border-white ${isExpired ? 'bg-red-400' : isExpiringSoon ? 'bg-amber-400' : 'bg-emerald-400'
                                    }`}></div>
                                </div>
                              </div>
                            </div>

                            {/* Card Body */}
                            <div className="pt-10 pb-4 px-5">
                              {/* Username */}
                              <h4 className="text-lg font-bold text-slate-900 mb-0.5">{user.username}</h4>

                              {/* Phone */}
                              {user.phone && (
                                <p className="text-sm text-slate-500 mb-3 flex items-center gap-1.5">
                                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                                  </svg>
                                  {user.phone}
                                </p>
                              )}

                              {/* Subscriptions */}
                              {user.role === 'student' && (
                                <div className="mb-4">
                                  {user.subscriptions && user.subscriptions.length > 0 ? (
                                    <div className="flex flex-wrap gap-1.5">
                                      {user.subscriptions.map((sub) => {
                                        const catColor = categories.find(c => c.id === sub)?.color || 'slate';
                                        const colors = getCategoryColors(catColor);
                                        return (
                                          <span
                                            key={sub}
                                            className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold rounded-md ring-1 ${colors.tagBg} ${colors.tagText} ${colors.tagRing}`}
                                          >
                                            {subscriptionLabels[sub] || sub.charAt(0).toUpperCase() + sub.slice(1)}
                                          </span>
                                        );
                                      })}
                                    </div>
                                  ) : (
                                    <span className="text-sm text-slate-400 italic">No subscriptions</span>
                                  )}
                                </div>
                              )}
                              {user.role === 'admin' && (
                                <p className="text-sm text-slate-500 mb-4">Full system access</p>
                              )}

                              {/* Stats Row */}
                              <div className="flex items-center gap-4 py-3 border-t border-slate-100">
                                <div className="flex-1">
                                  <p className="text-xs text-slate-400 uppercase tracking-wide">Expires</p>
                                  <p className={`text-sm font-semibold ${isExpired ? 'text-red-600' : isExpiringSoon ? 'text-amber-600' : 'text-slate-700'
                                    }`}>
                                    {new Date(user.expires_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                  </p>
                                </div>
                                <div className="flex-1">
                                  <p className="text-xs text-slate-400 uppercase tracking-wide">Created</p>
                                  <p className="text-sm font-semibold text-slate-700">
                                    {new Date(user.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                  </p>
                                </div>
                              </div>

                              {/* Action Buttons */}
                              <div className="flex gap-2 pt-3">
                                <button
                                  onClick={() => startEditUser(user)}
                                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium text-sm rounded-xl transition-colors"
                                >
                                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                  </svg>
                                  Edit
                                </button>
                                {user.role === 'student' && (
                                  <button
                                    onClick={() => handleForceLogout(user.user_id, user.username)}
                                    className="flex items-center justify-center gap-2 px-4 py-2.5 bg-amber-50 hover:bg-amber-100 text-amber-600 font-medium text-sm rounded-xl transition-colors"
                                    title="Force logout this user"
                                  >
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                                    </svg>
                                  </button>
                                )}
                                <button
                                  onClick={() => handleDeleteUser(user.user_id, user.username)}
                                  className="flex items-center justify-center gap-2 px-4 py-2.5 bg-red-50 hover:bg-red-100 text-red-600 font-medium text-sm rounded-xl transition-colors"
                                >
                                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                  </svg>
                                </button>
                              </div>

                              {/* Device Binding Controls - Students Only */}
                              {user.role === 'student' && (
                                <div className="flex gap-2 pt-2 border-t border-slate-100 mt-2">
                                  <button
                                    onClick={() => handleToggleDeviceBinding(user.user_id, user.username, user.device_binding_enabled || false)}
                                    className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 font-medium text-xs rounded-xl transition-colors ${user.device_binding_enabled
                                      ? 'bg-emerald-50 hover:bg-emerald-100 text-emerald-600'
                                      : 'bg-slate-100 hover:bg-slate-200 text-slate-500'
                                      }`}
                                    title={user.device_binding_enabled ? 'Device binding is ON - Click to disable' : 'Device binding is OFF - Click to enable'}
                                  >
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                                    </svg>
                                    {user.device_binding_enabled ? 'Device Lock ON' : 'Device Lock OFF'}
                                  </button>
                                  {user.device_binding_enabled && user.device_id && (
                                    <button
                                      onClick={() => handleResetDevice(user.user_id, user.username)}
                                      className="flex items-center justify-center gap-2 px-3 py-2 bg-purple-50 hover:bg-purple-100 text-purple-600 font-medium text-xs rounded-xl transition-colors"
                                      title="Reset device - Allow login from new device"
                                    >
                                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                      </svg>
                                      Reset
                                    </button>
                                  )}
                                </div>
                              )}
                            </div>

                            {/* Expired/Expiring Soon Banner */}
                            {isExpired && (
                              <div className="absolute top-0 left-0 right-0 bg-red-500 text-white text-xs font-bold text-center py-1">
                                EXPIRED
                              </div>
                            )}
                            {isExpiringSoon && !isExpired && (
                              <div className="absolute top-0 left-0 right-0 bg-amber-500 text-white text-xs font-bold text-center py-1">
                                EXPIRING SOON
                              </div>
                            )}
                          </div>
                        );
                      })}
                  </div>

                  {/* Empty State */}
                  {users.length === 0 && (
                    <div className="col-span-full bg-white rounded-2xl border border-slate-200 p-12 text-center">
                      <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                        <svg className="w-8 h-8 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                        </svg>
                      </div>
                      <h3 className="text-lg font-semibold text-slate-900 mb-1">No users yet</h3>
                      <p className="text-slate-500">Create your first user using the form above</p>
                    </div>
                  )}

                  {/* No Search Results */}
                  {users.length > 0 && filteredUsers.length === 0 && (
                    <div className="col-span-full bg-white rounded-2xl border border-slate-200 p-12 text-center">
                      <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                        <svg className="w-8 h-8 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                      </div>
                      <h3 className="text-lg font-semibold text-slate-900 mb-1">No users found</h3>
                      <p className="text-slate-500">No users match "{userSearchQuery}"</p>
                      <button
                        onClick={() => setUserSearchQuery('')}
                        className="mt-4 px-4 py-2 text-sm font-medium text-[#ff8240] hover:text-[#e06620] hover:bg-[#fff5f0] rounded-lg transition-colors"
                      >
                        Clear search
                      </button>
                    </div>
                  )}

                  {/* Pagination Controls */}
                  {totalPages > 1 && (
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-6 border-t border-slate-100">
                      <div className="text-sm text-slate-500 order-2 sm:order-1">
                        Page {userCurrentPage} of {totalPages}
                      </div>
                      <div className="flex items-center gap-2 order-1 sm:order-2">
                        <button
                          onClick={() => setUserCurrentPage(Math.max(1, userCurrentPage - 1))}
                          disabled={userCurrentPage === 1}
                          className="px-4 py-2 text-sm font-medium bg-white border border-slate-200 rounded-xl text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                        >
                          Previous
                        </button>

                        <div className="hidden sm:flex items-center gap-1">
                          {Array.from({ length: totalPages }, (_, i) => i + 1)
                            .filter(page => {
                              // Show first page, last page, and pages around current page
                              return page === 1 ||
                                page === totalPages ||
                                (page >= userCurrentPage - 1 && page <= userCurrentPage + 1);
                            })
                            .map((page, index, array) => {
                              const lastPage = array[index - 1];
                              const showEllipsis = lastPage && page - lastPage > 1;

                              return (
                                <div key={page} className="flex items-center gap-1">
                                  {showEllipsis && <span className="px-2 text-slate-400">...</span>}
                                  <button
                                    onClick={() => setUserCurrentPage(page)}
                                    className={`w-9 h-9 flex items-center justify-center text-sm font-medium rounded-xl transition-all ${userCurrentPage === page
                                      ? 'bg-[#ff8240] text-white shadow-lg shadow-[#ff8240]/25'
                                      : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
                                      }`}
                                  >
                                    {page}
                                  </button>
                                </div>
                              );
                            })}
                        </div>

                        <button
                          onClick={() => setUserCurrentPage(Math.min(totalPages, userCurrentPage + 1))}
                          disabled={userCurrentPage === totalPages}
                          className="px-4 py-2 text-sm font-medium bg-white border border-slate-200 rounded-xl text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                        >
                          Next
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Cards Tab */}
        {
          activeTab === 'cards' && (
            <div className="space-y-6">
              {/* Background Container */}
              <div className="relative -mx-4 sm:-mx-6 px-4 sm:px-6 py-8 rounded-3xl bg-gradient-to-br from-slate-50 via-[#fff5f0]/30 to-[#e6fff5]/30 overflow-hidden">
                {/* Decorative Elements */}
                <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-br from-[#ffd4b8]/20 to-[#b3ffdb]/20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
                <div className="absolute bottom-0 left-0 w-80 h-80 bg-gradient-to-tr from-orange-200/20 to-pink-200/20 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2"></div>
                <div className="absolute top-1/2 left-1/2 w-64 h-64 bg-gradient-to-r from-[#ffe8d9]/10 to-[#ffd4b8]/10 rounded-full blur-2xl -translate-x-1/2 -translate-y-1/2"></div>

                {/* Content */}
                <div className="relative space-y-6">
                  {/* Search & Filter Bar */}
                  <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-white/50 shadow-sm p-4 sm:p-5">
                    <div className="flex flex-col sm:flex-row gap-4">
                      {/* Search Input */}
                      <div className="relative flex-1">
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                          <svg className="w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                          </svg>
                        </div>
                        <input
                          type="text"
                          placeholder="Search cards by title or ID..."
                          value={cardSearchQuery}
                          onChange={(e) => setCardSearchQuery(e.target.value)}
                          className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 focus:bg-white transition-all"
                        />
                        {cardSearchQuery && (
                          <button
                            onClick={() => setCardSearchQuery('')}
                            className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-400 hover:text-slate-600"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        )}
                      </div>

                      {/* Category Filter */}
                      <div className="flex flex-wrap gap-2">
                        <button
                          onClick={() => setCardCategoryFilter('all')}
                          className={`px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${cardCategoryFilter === 'all'
                            ? 'bg-slate-900 text-white shadow-lg'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                            }`}
                        >
                          All
                        </button>
                        {availableSubscriptions.map((sub) => {
                          const catColor = categories.find(c => c.id === sub)?.color || 'slate';
                          const color = getCategoryColors(catColor);
                          return (
                            <button
                              key={sub}
                              onClick={() => setCardCategoryFilter(sub)}
                              className={`px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${cardCategoryFilter === sub ? color.active : color.inactive}`}
                            >
                              {subscriptionLabels[sub] || sub.charAt(0).toUpperCase() + sub.slice(1)}
                            </button>
                          );
                        })}
                      </div>

                      {/* Add Card Button */}
                      <button
                        onClick={() => setIsCreateCardOpen(true)}
                        className="flex items-center justify-center gap-2 px-5 py-2.5 bg-gradient-to-r from-orange-500 to-pink-500 text-white font-medium rounded-xl hover:shadow-lg hover:shadow-orange-500/25 transition-all"
                      >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                        <span className="hidden sm:inline">Add Card</span>
                      </button>
                    </div>

                    {/* Results count */}
                    <div className="mt-4 flex items-center gap-2 text-sm text-slate-500">
                      <span className="w-2 h-2 bg-orange-400 rounded-full"></span>
                      {cards.filter(card => {
                        const matchesSearch = card.card_id.toLowerCase().includes(cardSearchQuery.toLowerCase()) ||
                          (card.title || '').toLowerCase().includes(cardSearchQuery.toLowerCase());
                        const matchesCategory = cardCategoryFilter === 'all' ||
                          (card.required_subscriptions && card.required_subscriptions.includes(cardCategoryFilter));
                        return matchesSearch && matchesCategory;
                      }).length} cards found
                    </div>
                  </div>

                  {/* Cards Grid - Modern Design */}
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                    {cards.filter(card => {
                      const matchesSearch = card.card_id.toLowerCase().includes(cardSearchQuery.toLowerCase()) ||
                        (card.title || '').toLowerCase().includes(cardSearchQuery.toLowerCase());
                      const matchesCategory = cardCategoryFilter === 'all' ||
                        (card.required_subscriptions && card.required_subscriptions.includes(cardCategoryFilter));
                      return matchesSearch && matchesCategory;
                    }).map((card) => {
                      const primarySub = card.required_subscriptions?.[0];
                      const primaryCatColor = primarySub ? (categories.find(c => c.id === primarySub)?.color || 'slate') : 'orange';
                      const gradientColor = getCategoryColors(primaryCatColor).gradient;

                      return (
                        <div key={card.id} className="group relative bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-xl hover:shadow-gray-200/50 transition-all duration-300 hover:-translate-y-1">
                          {/* Gradient Top Bar */}
                          <div className={`h-1.5 bg-gradient-to-r ${gradientColor}`}></div>

                          {/* Card Header */}
                          <div className="p-5">
                            <div className="flex items-start justify-between gap-3 mb-3">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className={`inline-flex px-2.5 py-1 text-xs font-bold rounded-lg bg-gradient-to-r ${gradientColor} text-white shadow-sm`}>
                                    {card.card_id}
                                  </span>
                                </div>
                                <h3 className="font-semibold text-gray-900 text-lg truncate">{card.title || 'Untitled'}</h3>
                              </div>

                              {/* Action Buttons - Always visible */}
                              <div className="flex items-center gap-1">
                                <a
                                  href={card.video_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="p-2 text-[#ff8240] hover:text-[#ff8240] hover:bg-[#fff5f0] rounded-lg transition-colors"
                                  title="Watch video"
                                >
                                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                  </svg>
                                </a>
                                <button
                                  onClick={() => startEditCard(card)}
                                  className="p-2 text-amber-500 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                                  title="Edit"
                                >
                                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                  </svg>
                                </button>
                                <button
                                  onClick={() => handleDeleteCard(card)}
                                  className="p-2 text-red-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                  title="Delete"
                                >
                                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                  </svg>
                                </button>
                              </div>
                            </div>

                            {/* Subscription Tags */}
                            {card.required_subscriptions && card.required_subscriptions.length > 0 && (
                              <div className="flex flex-wrap gap-1.5">
                                {card.required_subscriptions.map((sub) => {
                                  const catColor = categories.find(c => c.id === sub)?.color || 'slate';
                                  const tc = getCategoryColors(catColor);
                                  return (
                                    <span key={sub} className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ring-1 ${tc.tagBg} ${tc.tagText} ${tc.tagRing}`}>
                                      {subscriptionLabels[sub] || sub.charAt(0).toUpperCase() + sub.slice(1)}
                                    </span>
                                  );
                                })}
                              </div>
                            )}
                          </div>

                          {/* QR Section */}
                          <div className="px-5 pb-5">
                            {loadingQr[card.card_id] ? (
                              <div className="flex items-center justify-center py-12 bg-gray-50 rounded-xl">
                                <div className="w-8 h-8 border-3 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
                              </div>
                            ) : cardQrCodes[card.card_id] ? (
                              <div className="space-y-4">
                                {/* QR Code Display */}
                                <div id={`qr-print-${card.card_id}`} className="bg-gradient-to-br from-gray-50 to-white rounded-xl p-4 border border-gray-100">
                                  <div className="bg-white rounded-lg p-3 shadow-sm mx-auto w-fit">
                                    <img
                                      src={cardQrCodes[card.card_id]}
                                      alt={`QR ${card.card_id}`}
                                      className="w-36 h-36"
                                    />
                                  </div>
                                  <p className="text-[11px] text-gray-400 text-center mt-3 font-mono truncate px-2">{getAccessUrl(card.card_id)}</p>
                                </div>

                                {/* Action Buttons */}
                                <div className="grid grid-cols-4 gap-2">
                                  <button
                                    onClick={() => {
                                      const printContent = document.getElementById(`qr-print-${card.card_id}`);
                                      const originalContents = document.body.innerHTML;
                                      if (printContent) {
                                        document.body.innerHTML = printContent.outerHTML;
                                        window.print();
                                        document.body.innerHTML = originalContents;
                                        window.location.reload();
                                      }
                                    }}
                                    className="flex flex-col items-center justify-center gap-1 py-2.5 bg-[#fff5f0] text-[#ff8240] text-xs font-medium rounded-xl hover:bg-[#ffe8d9] transition-colors"
                                    title="Print QR"
                                  >
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                                    </svg>
                                    <span>Print</span>
                                  </button>
                                  <a
                                    href={cardQrCodes[card.card_id]}
                                    download={`qr-${card.card_id}.png`}
                                    className="flex flex-col items-center justify-center gap-1 py-2.5 bg-gray-100 text-gray-700 text-xs font-medium rounded-xl hover:bg-gray-200 transition-colors"
                                    title="Download"
                                  >
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                    </svg>
                                    <span>Save</span>
                                  </a>
                                  <button
                                    onClick={() => copyAccessLink(card.card_id)}
                                    className={`flex flex-col items-center justify-center gap-1 py-2.5 text-xs font-medium rounded-xl transition-all ${copiedCardId === card.card_id
                                      ? 'bg-green-500 text-white'
                                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                      }`}
                                    title="Copy link"
                                  >
                                    {copiedCardId === card.card_id ? (
                                      <>
                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                        </svg>
                                        <span>Copied!</span>
                                      </>
                                    ) : (
                                      <>
                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                        </svg>
                                        <span>Copy</span>
                                      </>
                                    )}
                                  </button>
                                  <button
                                    onClick={() => startEditCard(card)}
                                    className="flex flex-col items-center justify-center gap-1 py-2.5 bg-blue-50 text-blue-600 text-xs font-medium rounded-xl hover:bg-blue-100 transition-colors"
                                    title="Edit"
                                  >
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                    </svg>
                                    <span>Edit</span>
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <button
                                onClick={() => loadQrCode(card.card_id)}
                                className={`w-full flex items-center justify-center gap-2 px-4 py-4 bg-gradient-to-r ${gradientColor} text-white font-medium rounded-xl hover:shadow-lg hover:shadow-orange-500/25 transition-all`}
                              >
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                                </svg>
                                Generate QR Code
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Empty State */}
                  {cards.filter(card => {
                    const matchesSearch = card.card_id.toLowerCase().includes(cardSearchQuery.toLowerCase()) ||
                      (card.title || '').toLowerCase().includes(cardSearchQuery.toLowerCase());
                    const matchesCategory = cardCategoryFilter === 'all' ||
                      (card.required_subscriptions && card.required_subscriptions.includes(cardCategoryFilter));
                    return matchesSearch && matchesCategory;
                  }).length === 0 && (
                      <div className="text-center py-16">
                        <div className="w-20 h-20 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
                          <svg className="w-10 h-10 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                          </svg>
                        </div>
                        <h3 className="text-lg font-semibold text-gray-900 mb-1">No cards found</h3>
                        <p className="text-gray-500">Try adjusting your search or filter criteria</p>
                      </div>
                    )}
                </div>
              </div>
            </div>
          )
        }

        {/* Logs Tab */}
        {
          activeTab === 'logs' && (
            <div className="space-y-6">
              {/* Filter Form */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
                <h2 className="text-lg font-bold text-gray-900 mb-4">Filter Logs</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                  <input
                    type="text"
                    placeholder="User ID"
                    value={logFilters.userId}
                    onChange={(e) => setLogFilters({ ...logFilters, userId: e.target.value })}
                    className="px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#ff8240] focus:border-transparent focus:bg-white"
                  />
                  <input
                    type="text"
                    placeholder="Card ID"
                    value={logFilters.cardId}
                    onChange={(e) => setLogFilters({ ...logFilters, cardId: e.target.value })}
                    className="px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#ff8240] focus:border-transparent focus:bg-white"
                  />
                  <input
                    type="date"
                    value={logFilters.startDate}
                    onChange={(e) => setLogFilters({ ...logFilters, startDate: e.target.value })}
                    className="px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#ff8240] focus:border-transparent focus:bg-white"
                  />
                  <input
                    type="date"
                    value={logFilters.endDate}
                    onChange={(e) => setLogFilters({ ...logFilters, endDate: e.target.value })}
                    className="px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#ff8240] focus:border-transparent focus:bg-white"
                  />
                  <button
                    onClick={loadLogs}
                    className="py-3 bg-[#ff8240] text-white font-semibold rounded-xl hover:bg-[#e06620] shadow-lg shadow-[#ff8240]/20"
                  >
                    Apply Filters
                  </button>
                </div>
              </div>

              {/* Logs Table */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">User</th>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Card</th>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Accessed At</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {logs.map((log) => (
                        <tr key={log.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 text-sm text-gray-900">{log.username || 'Unknown User'}</td>
                          <td className="px-6 py-4 text-sm text-gray-900">{log.card_title || log.card_id}</td>
                          <td className="px-6 py-4 text-sm text-gray-500">{new Date(log.accessed_at).toLocaleString()}</td>
                        </tr>
                      ))}
                      {logs.length === 0 && (
                        <tr>
                          <td colSpan={3} className="px-6 py-12 text-center text-gray-500">
                            No access logs found
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )
        }

        {/* Rassa LMS Tab */}
        {activeTab === 'lms' && <RassaLMSTab />}

        {/* Devices Tab */}
        {activeTab === 'devices' && (() => {
          // Compute stats
          const userSessionCount: Record<string, number> = {};
          activeSessions.forEach(s => {
            userSessionCount[s.user_id] = (userSessionCount[s.user_id] || 0) + 1;
          });
          const multiDeviceUserIds = new Set(
            Object.entries(userSessionCount)
              .filter(([, count]) => count > 1)
              .map(([uid]) => uid)
          );
          const displaySessions = deviceFilter === 'multi'
            ? activeSessions.filter(s => multiDeviceUserIds.has(s.user_id))
            : activeSessions;

          return (
            <div className="space-y-6">
              {/* Header */}
              <div>
                <h2 className="text-2xl font-bold text-slate-900">Devices & Sessions</h2>
                <p className="text-slate-500 text-sm mt-1">Monitor active sessions and control device binding globally</p>
              </div>

              {/* Stats row */}
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
                  <p className="text-sm text-slate-500">Active Sessions</p>
                  <p className="text-3xl font-bold text-slate-900 mt-1">{activeSessions.length}</p>
                </div>
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
                  <p className="text-sm text-slate-500">Users Online</p>
                  <p className="text-3xl font-bold text-slate-900 mt-1">{Object.keys(userSessionCount).length}</p>
                </div>
                <div className={`rounded-2xl border shadow-sm p-5 ${multiDeviceUserIds.size > 0 ? 'bg-red-50 border-red-200' : 'bg-white border-slate-200'}`}>
                  <p className="text-sm text-slate-500">Multi-Device Users</p>
                  <p className={`text-3xl font-bold mt-1 ${multiDeviceUserIds.size > 0 ? 'text-red-600' : 'text-slate-900'}`}>
                    {multiDeviceUserIds.size}
                  </p>
                </div>
              </div>

              {/* Global Device Binding */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="px-6 py-5 border-b border-slate-100">
                  <h3 className="text-lg font-semibold text-slate-900">Global Device Binding Mode</h3>
                  <p className="text-sm text-slate-500 mt-0.5">Override device binding setting for all students at once</p>
                </div>
                <div className="px-6 py-5">
                  {devicesInitialLoading ? (
                    <div className="flex gap-3">
                      {[1, 2, 3].map(i => (
                        <div key={i} className="flex-1 h-16 rounded-xl bg-slate-100 animate-pulse" />
                      ))}
                    </div>
                  ) : (
                    <>
                      <div className="flex gap-3">
                        {([
                          { mode: 'off' as const, label: 'Off', desc: 'Disabled for everyone', color: 'slate' },
                          { mode: 'per_user' as const, label: 'Per User', desc: "Use each user's setting", color: 'blue' },
                          { mode: 'all' as const, label: 'All Students', desc: 'Enabled for all students', color: 'emerald' },
                        ] as const).map(({ mode, label, desc, color }) => {
                          const isActive = globalBindingMode === mode;
                          const colorMap = {
                            slate: { active: 'bg-slate-700 text-white border-slate-700', inactive: 'bg-white text-slate-600 border-slate-200 hover:border-slate-400' },
                            blue: { active: 'bg-blue-600 text-white border-blue-600', inactive: 'bg-white text-slate-600 border-slate-200 hover:border-blue-400' },
                            emerald: { active: 'bg-emerald-600 text-white border-emerald-600', inactive: 'bg-white text-slate-600 border-slate-200 hover:border-emerald-400' },
                          };
                          return (
                            <button
                              key={mode}
                              disabled={bindingModeLoading}
                              onClick={() => handleSetGlobalBindingMode(mode)}
                              className={`flex-1 rounded-xl border-2 px-4 py-3 text-sm font-medium transition-all ${isActive ? colorMap[color].active : colorMap[color].inactive} disabled:opacity-50`}
                            >
                              <div className="font-semibold">{label}</div>
                              <div className={`text-xs mt-0.5 ${isActive ? 'opacity-80' : 'text-slate-400'}`}>{desc}</div>
                            </button>
                          );
                        })}
                      </div>
                      {globalBindingMode === 'all' && (
                        <p className="mt-3 text-xs text-emerald-700 bg-emerald-50 rounded-lg px-3 py-2">
                          All students are restricted to one device. Existing duplicate sessions were terminated immediately. New logins will also enforce single-device.
                        </p>
                      )}
                      {globalBindingMode === 'off' && (
                        <p className="mt-3 text-xs text-slate-600 bg-slate-50 rounded-lg px-3 py-2">
                          Device binding is completely disabled. Students can log in from any number of devices simultaneously.
                        </p>
                      )}
                    </>
                  )}
                </div>
              </div>

              {/* Active Sessions List */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between gap-4">
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900">Active Sessions</h3>
                    <p className="text-sm text-slate-500 mt-0.5">All currently connected users</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex bg-slate-100 rounded-lg p-1 gap-1">
                      {([
                        { key: 'all' as const, label: 'All' },
                        { key: 'multi' as const, label: 'Multi-Device' },
                      ] as const).map(({ key, label }) => (
                        <button
                          key={key}
                          onClick={() => setDeviceFilter(key)}
                          className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${deviceFilter === key ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                          {label}
                          {key === 'multi' && multiDeviceUserIds.size > 0 && (
                            <span className="ml-1.5 bg-red-500 text-white text-xs rounded-full px-1.5 py-0.5">{multiDeviceUserIds.size}</span>
                          )}
                        </button>
                      ))}
                    </div>
                    <button
                      onClick={() => loadDevicesTab()}
                      disabled={sessionsLoading}
                      className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-medium rounded-lg transition-colors disabled:opacity-50"
                    >
                      <svg className={`w-3.5 h-3.5 ${sessionsLoading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      Refresh
                    </button>
                  </div>
                </div>

                {sessionsLoading && activeSessions.length === 0 ? (
                  <div className="divide-y divide-slate-100">
                    {[1, 2, 3].map(i => (
                      <div key={i} className="px-6 py-4 flex items-center gap-4 animate-pulse">
                        <div className="w-9 h-9 rounded-xl bg-slate-100 flex-shrink-0" />
                        <div className="flex-1 space-y-2">
                          <div className="h-3.5 bg-slate-100 rounded w-32" />
                          <div className="h-3 bg-slate-100 rounded w-48" />
                          <div className="h-3 bg-slate-100 rounded w-40" />
                        </div>
                        <div className="w-20 h-7 bg-slate-100 rounded-lg flex-shrink-0" />
                      </div>
                    ))}
                  </div>
                ) : displaySessions.length === 0 ? (
                  <div className="px-6 py-12 text-center text-slate-400 text-sm">
                    {deviceFilter === 'multi' ? 'No users connected from multiple devices.' : 'No active sessions found.'}
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {displaySessions.map(session => {
                      const isMulti = multiDeviceUserIds.has(session.user_id);
                      const lastSeen = new Date(session.last_seen_at);
                      const now = new Date();
                      const diffMin = Math.floor((now.getTime() - lastSeen.getTime()) / 60000);
                      const lastSeenLabel = diffMin < 1 ? 'Just now' : diffMin < 60 ? `${diffMin}m ago` : `${Math.floor(diffMin / 60)}h ago`;
                      const createdAt = new Date(session.created_at).toLocaleString();

                      return (
                        <div key={session.id} className={`px-6 py-4 flex items-start gap-4 ${isMulti ? 'bg-red-50/50' : ''}`}>
                          {/* User avatar / multi-device indicator */}
                          <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 text-sm font-bold ${isMulti ? 'bg-red-100 text-red-600' : 'bg-slate-100 text-slate-600'}`}>
                            {session.username?.[0]?.toUpperCase() || '?'}
                          </div>

                          <div className="flex-1 min-w-0">
                            {/* Row 1: username + badges */}
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-semibold text-slate-900 text-sm">{session.username}</span>
                              {session.phone && (
                                <span className="text-xs text-slate-400">{session.phone}</span>
                              )}
                              {isMulti && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-100 text-red-700 text-xs font-medium rounded-full">
                                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                  </svg>
                                  Multi-device ({userSessionCount[session.user_id]})
                                </span>
                              )}
                              {session.device_binding_enabled && (
                                <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 text-xs font-medium rounded-full">Device Locked</span>
                              )}
                            </div>

                            {/* Row 2: device info */}
                            <div className="flex items-center gap-3 mt-1.5 flex-wrap text-xs text-slate-500">
                              {(session.device_info?.browser || session.device_info?.os) && (
                                <span className="flex items-center gap-1">
                                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                  </svg>
                                  {[session.device_info?.browser, session.device_info?.os].filter(Boolean).join(' / ')}
                                </span>
                              )}
                              {session.device_info?.screen && (
                                <span>{session.device_info.screen}</span>
                              )}
                              {session.ip_address && session.ip_address !== 'unknown' && (
                                <span className="flex items-center gap-1">
                                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                                  </svg>
                                  {session.ip_address}
                                </span>
                              )}
                              {session.device_id && (
                                <span className="font-mono text-slate-400" title="Device fingerprint">{session.device_id}</span>
                              )}
                            </div>

                            {/* Row 3: timing */}
                            <div className="flex items-center gap-3 mt-1 text-xs text-slate-400">
                              <span>Logged in: {createdAt}</span>
                              <span>Last seen: {lastSeenLabel}</span>
                            </div>
                          </div>

                          {/* Actions */}
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <button
                              onClick={() => handleTerminateSession(session.id)}
                              className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 text-xs font-medium rounded-lg transition-colors"
                              title="Disconnect this session"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                              </svg>
                              Disconnect
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          );
        })()}

        {/* Settings Tab */}
        {activeTab === 'settings' && (
          <div className="space-y-6">
            {/* Header */}
            <div>
              <h2 className="text-2xl font-bold text-slate-900">Settings</h2>
              <p className="text-slate-500 text-sm mt-1">Manage subscription categories and system configuration</p>
            </div>

            {/* Subscription Categories Section */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-6 py-5 border-b border-slate-100">
                <h3 className="text-lg font-semibold text-slate-900">Subscription Categories</h3>
                <p className="text-sm text-slate-500 mt-0.5">Control which categories appear in user and card selectors</p>
              </div>

              {/* Category List */}
              <div className="divide-y divide-slate-100">
                {categories.length === 0 ? (
                  <div className="px-6 py-8 text-center text-slate-400 text-sm">No categories found. Add one below.</div>
                ) : (
                  categories.map((cat) => {
                    const colors = getCategoryColors(cat.color);
                    return (
                      <div key={cat.id} className="flex items-center gap-4 px-6 py-4 hover:bg-slate-50 transition-colors">
                        {/* Color swatch */}
                        <span className={`w-3 h-3 rounded-full flex-shrink-0 ${colors.swatch}`}></span>

                        {/* Label & ID */}
                        <div className="flex-1 min-w-0">
                          <span className="font-medium text-slate-900">{cat.label}</span>
                          <span className="ml-2 inline-flex items-center px-1.5 py-0.5 text-xs font-mono bg-slate-100 text-slate-500 rounded">{cat.id}</span>
                          {cat.hidden && (
                            <span className="ml-2 inline-flex items-center px-2 py-0.5 text-xs font-medium bg-amber-50 text-amber-700 ring-1 ring-amber-200 rounded-full">Hidden</span>
                          )}
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {/* Eye toggle */}
                          <button
                            onClick={async () => {
                              await fetch(`/api/admin/categories/${cat.id}`, {
                                method: 'PATCH',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ hidden: !cat.hidden }),
                              });
                              loadCategories();
                            }}
                            title={cat.hidden ? 'Show category' : 'Hide category'}
                            className={`p-2 rounded-lg transition-colors ${cat.hidden
                              ? 'text-amber-500 hover:bg-amber-50'
                              : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'
                              }`}
                          >
                            {cat.hidden ? (
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                              </svg>
                            ) : (
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                              </svg>
                            )}
                          </button>

                          {/* Delete button with inline confirmation */}
                          {confirmDeleteCategory === cat.id ? (
                            <div className="flex items-center gap-1">
                              <span className="text-xs text-red-600 font-medium">Confirm?</span>
                              <button
                                onClick={async () => {
                                  await fetch(`/api/admin/categories/${cat.id}`, { method: 'DELETE' });
                                  setConfirmDeleteCategory(null);
                                  loadCategories();
                                }}
                                className="px-2 py-1 text-xs font-semibold bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
                              >
                                Delete
                              </button>
                              <button
                                onClick={() => setConfirmDeleteCategory(null)}
                                className="px-2 py-1 text-xs font-semibold bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 transition-colors"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setConfirmDeleteCategory(cat.id)}
                              title="Delete category"
                              className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                            >
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Add Category */}
              <div className="px-6 py-5 bg-slate-50 border-t border-slate-100">
                <p className="text-sm font-medium text-slate-700 mb-3">Add Category</p>
                <div className="flex flex-wrap gap-3 items-end">
                  {/* Label input */}
                  <div className="flex-1 min-w-[160px]">
                    <label className="block text-xs text-slate-500 mb-1">Label</label>
                    <input
                      type="text"
                      placeholder="e.g. Chemistry"
                      value={newCategory.label}
                      onChange={(e) => setNewCategory({ ...newCategory, label: e.target.value })}
                      className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#ff8240]/40 focus:border-[#ff8240]/50"
                    />
                    {newCategory.label && (
                      <p className="text-xs text-slate-400 mt-1">ID: <span className="font-mono">{newCategory.label.toLowerCase().replace(/\s+/g, '').replace(/[^a-z0-9]/g, '')}</span></p>
                    )}
                  </div>

                  {/* Color picker */}
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">Color</label>
                    <div className="flex flex-wrap gap-1.5">
                      {Object.entries(COLOR_MAP).map(([key, val]) => (
                        <button
                          key={key}
                          type="button"
                          onClick={() => setNewCategory({ ...newCategory, color: key })}
                          title={key}
                          className={`w-6 h-6 rounded-full ${val.swatch} transition-all ${newCategory.color === key ? 'ring-2 ring-offset-1 ring-slate-400 scale-110' : 'opacity-70 hover:opacity-100'}`}
                        />
                      ))}
                    </div>
                  </div>

                  {/* Add button */}
                  <button
                    type="button"
                    onClick={async () => {
                      if (!newCategory.label.trim()) return;
                      const id = newCategory.label.toLowerCase().replace(/\s+/g, '').replace(/[^a-z0-9]/g, '');
                      if (!id) return;
                      await fetch('/api/admin/categories', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ id, label: newCategory.label.trim(), color: newCategory.color }),
                      });
                      setNewCategory({ label: '', color: 'slate' });
                      loadCategories();
                    }}
                    disabled={!newCategory.label.trim()}
                    className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-[#ff8240] to-[#00f99d] text-white text-sm font-semibold rounded-xl hover:shadow-lg hover:shadow-[#ff8240]/25 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Add
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </main >

      {/* Edit User Modal */}
      {
        editingUser && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-bold text-gray-900">Edit User</h3>
                <button onClick={() => setEditingUser(null)} className="text-gray-400 hover:text-gray-600">
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <form onSubmit={handleUpdateUser} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Username</label>
                  <input
                    type="text"
                    value={editForm.username}
                    onChange={(e) => setEditForm({ ...editForm, username: e.target.value })}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#ff8240] focus:border-transparent focus:bg-white"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">New Password</label>
                  <input
                    type="password"
                    value={editForm.password}
                    onChange={(e) => setEditForm({ ...editForm, password: e.target.value })}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#ff8240] focus:border-transparent focus:bg-white"
                    placeholder="Leave empty to keep current"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Phone <span className="text-gray-400">(Optional)</span></label>
                  <input
                    type="tel"
                    value={editForm.phone}
                    onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#ff8240] focus:border-transparent focus:bg-white"
                    placeholder="e.g. 0612345678"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Role</label>
                  <select
                    value={editForm.role}
                    onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#ff8240] focus:border-transparent focus:bg-white"
                  >
                    <option value="student">Student</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
                {editForm.role === 'student' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Expiration Date</label>
                    <input
                      type="date"
                      value={editForm.expires_at}
                      onChange={(e) => setEditForm({ ...editForm, expires_at: e.target.value })}
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#ff8240] focus:border-transparent focus:bg-white"
                      required
                    />
                  </div>
                )}
                {editForm.role === 'student' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Subscriptions</label>
                    <div className="flex flex-wrap gap-2">
                      {availableSubscriptions.map((sub) => {
                        const isSelected = editForm.subscriptions.includes(sub);
                        const catColor = categories.find(c => c.id === sub)?.color || 'slate';
                        const color = getCategoryColors(catColor);
                        return (
                          <button
                            key={sub}
                            type="button"
                            onClick={() => setEditForm({ ...editForm, subscriptions: toggleSubscription(editForm.subscriptions, sub) })}
                            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${isSelected
                              ? `bg-gradient-to-r ${color.gradient} text-white`
                              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                              }`}
                          >
                            <span className={`w-2 h-2 rounded-full ${isSelected ? 'bg-white/80' : color.swatch}`}></span>
                            {subscriptionLabels[sub] || sub.charAt(0).toUpperCase() + sub.slice(1)}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
                <div className="flex gap-3 pt-4">
                  <button
                    type="submit"
                    className="flex-1 py-3 bg-[#ff8240] text-white font-semibold rounded-xl hover:bg-[#e06620]"
                  >
                    Save Changes
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingUser(null)}
                    className="flex-1 py-3 bg-gray-100 text-gray-700 font-semibold rounded-xl hover:bg-gray-200"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        )
      }

      {/* Create Card Modal */}
      {
        isCreateCardOpen && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
            <div className="relative w-full max-w-2xl animate-in zoom-in-95 duration-200">
              {/* Gradient glow effect */}
              <div className="absolute -inset-1 bg-gradient-to-r from-orange-500 via-pink-500 to-[#00f99d] rounded-3xl blur-lg opacity-30"></div>

              <div className="relative bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-2xl shadow-2xl overflow-hidden">
                {/* Header */}
                <div className="relative p-6 pb-0">
                  {/* Decorative gradient */}
                  <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-br from-orange-500/20 via-pink-500/10 to-transparent"></div>

                  <div className="relative flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="relative">
                        <div className="absolute inset-0 bg-gradient-to-r from-orange-500 to-pink-500 rounded-xl blur-lg opacity-50"></div>
                        <div className="relative w-12 h-12 bg-gradient-to-br from-orange-500 to-pink-600 rounded-xl flex items-center justify-center shadow-lg">
                          <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                          </svg>
                        </div>
                      </div>
                      <div>
                        <h2 className="text-xl font-bold text-white">Create New Card</h2>
                        <p className="text-slate-400 text-sm">Add a new QR card with video content</p>
                      </div>
                    </div>
                    <button
                      onClick={() => setIsCreateCardOpen(false)}
                      className="w-10 h-10 rounded-xl bg-slate-800/50 flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
                    >
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>

                {/* Form Content */}
                <div className="p-6">
                  <form onSubmit={handleCreateCard} className="space-y-5">
                    {/* Card ID & Title Row */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="group">
                        <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                          Card ID
                        </label>
                        <div className="relative">
                          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <svg className="w-5 h-5 text-slate-500 group-focus-within:text-orange-400 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                            </svg>
                          </div>
                          <input
                            type="text"
                            placeholder="e.g., PHY-001"
                            value={newCard.card_id}
                            onChange={(e) => setNewCard({ ...newCard, card_id: e.target.value })}
                            className="w-full pl-10 pr-4 py-3 bg-slate-800/50 border border-slate-700/50 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500/50 transition-all"
                            required
                          />
                        </div>
                      </div>

                      <div className="group">
                        <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                          Title (Optional)
                        </label>
                        <div className="relative">
                          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <svg className="w-5 h-5 text-slate-500 group-focus-within:text-orange-400 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </div>
                          <input
                            type="text"
                            placeholder="Card title"
                            value={newCard.title}
                            onChange={(e) => setNewCard({ ...newCard, title: e.target.value })}
                            className="w-full pl-10 pr-4 py-3 bg-slate-800/50 border border-slate-700/50 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500/50 transition-all"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Video URL */}
                    <div className="group">
                      <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                        YouTube URL
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <svg className="w-5 h-5 text-slate-500 group-focus-within:text-orange-400 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </div>
                        <input
                          type="url"
                          placeholder="https://youtube.com/watch?v=..."
                          value={newCard.video_url}
                          onChange={(e) => setNewCard({ ...newCard, video_url: e.target.value })}
                          className="w-full pl-10 pr-4 py-3 bg-slate-800/50 border border-slate-700/50 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500/50 transition-all"
                          required
                        />
                      </div>
                    </div>

                    {/* Subscriptions */}
                    <div>
                      <div className="flex items-center gap-2 mb-3">
                        <svg className="w-4 h-4 text-pink-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                        </svg>
                        <label className="text-sm font-semibold text-white">Required Subscriptions</label>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {availableSubscriptions.map((sub) => {
                          const isSelected = newCard.required_subscriptions.includes(sub);
                          const catColor = categories.find(c => c.id === sub)?.color || 'slate';
                          const color = getCategoryColors(catColor);

                          return (
                            <button
                              key={sub}
                              type="button"
                              onClick={() => setNewCard({ ...newCard, required_subscriptions: toggleSubscription(newCard.required_subscriptions, sub) })}
                              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium text-sm transition-all duration-200 ${isSelected
                                ? `bg-gradient-to-r ${color.gradient} text-white shadow-lg`
                                : `bg-slate-800/50 text-slate-400 hover:text-white hover:bg-slate-700/50 ring-1 ring-slate-700/50`
                                }`}
                            >
                              <span className={`w-2 h-2 rounded-full ${isSelected ? 'bg-white/80' : color.swatch}`}></span>
                              <span>{subscriptionLabels[sub] || sub.charAt(0).toUpperCase() + sub.slice(1)}</span>
                              {isSelected && (
                                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                </svg>
                              )}
                            </button>
                          );
                        })}
                      </div>
                      <p className="text-xs text-slate-500 mt-2">Leave empty to allow all students</p>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-3 pt-2">
                      <button
                        type="button"
                        onClick={() => setIsCreateCardOpen(false)}
                        className="flex-1 px-4 py-3 bg-slate-800 text-slate-300 font-medium rounded-xl hover:bg-slate-700 transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-orange-500 to-pink-500 text-white font-semibold rounded-xl hover:shadow-lg hover:shadow-orange-500/25 transition-all"
                      >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                        Create Card
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            </div>
          </div>
        )
      }

      {/* Edit Card Modal */}
      {
        editingCard && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-lg font-bold text-gray-900">Edit Card</h3>
                  <p className="text-sm text-gray-500">{editingCard.card_id}</p>
                </div>
                <button onClick={() => setEditingCard(null)} className="text-gray-400 hover:text-gray-600">
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <form onSubmit={handleUpdateCard} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Title</label>
                  <input
                    type="text"
                    value={editCardForm.title}
                    onChange={(e) => setEditCardForm({ ...editCardForm, title: e.target.value })}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#ff8240] focus:border-transparent focus:bg-white"
                    placeholder="Card title (optional)"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Video URL</label>
                  <input
                    type="url"
                    value={editCardForm.video_url}
                    onChange={(e) => setEditCardForm({ ...editCardForm, video_url: e.target.value })}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#ff8240] focus:border-transparent focus:bg-white"
                    placeholder="YouTube URL"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Subject (optional)</label>
                  <input
                    type="text"
                    value={editCardForm.subject}
                    onChange={(e) => setEditCardForm({ ...editCardForm, subject: e.target.value })}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#ff8240] focus:border-transparent focus:bg-white"
                    placeholder="e.g., Physics, Math"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Required Subscriptions</label>
                  <div className="flex flex-wrap gap-2">
                    {availableSubscriptions.map((sub) => {
                      const isSelected = editCardForm.required_subscriptions.includes(sub);
                      const catColor = categories.find(c => c.id === sub)?.color || 'slate';
                      const color = getCategoryColors(catColor);
                      return (
                        <button
                          key={sub}
                          type="button"
                          onClick={() => setEditCardForm({ ...editCardForm, required_subscriptions: toggleSubscription(editCardForm.required_subscriptions, sub) })}
                          className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${isSelected
                            ? `bg-gradient-to-r ${color.gradient} text-white`
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                            }`}
                        >
                          <span className={`w-2 h-2 rounded-full ${isSelected ? 'bg-white/80' : color.swatch}`}></span>
                          {subscriptionLabels[sub] || sub.charAt(0).toUpperCase() + sub.slice(1)}
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-xs text-gray-500 mt-2">Leave empty to allow all students</p>
                </div>
                <div className="flex gap-3 pt-4">
                  <button
                    type="submit"
                    className="flex-1 py-3 bg-[#ff8240] text-white font-semibold rounded-xl hover:bg-[#e06620]"
                  >
                    Save Changes
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingCard(null)}
                    className="flex-1 py-3 bg-gray-100 text-gray-700 font-semibold rounded-xl hover:bg-gray-200"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        )
      }
    </div >
  );
}

export default function AdminDashboard() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-[#ff8240] border-t-transparent rounded-full animate-spin"></div>
          <p className="text-gray-500 text-sm">Loading dashboard...</p>
        </div>
      </div>
    }>
      <AdminDashboardContent />
    </Suspense>
  );
}
