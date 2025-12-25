'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface User {
  id: string;
  username: string;
  role: 'admin' | 'student';
  expires_at: string;
  created_at: string;
}

interface Card {
  id: string;
  card_id: string;
  video_url: string;
  title?: string;
  subject?: 'physics' | 'math';
}

interface AccessLog {
  id: string;
  user_id: string;
  card_id: string;
  accessed_at: string;
  username?: string;
  card_title?: string;
}

export default function AdminDashboard() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'users' | 'cards' | 'logs'>('users');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  const [users, setUsers] = useState<User[]>([]);
  const [newUser, setNewUser] = useState({ username: '', password: '', role: 'student', expires_at: '' });
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editForm, setEditForm] = useState({ username: '', password: '', role: 'student', expires_at: '' });
  
  const [cards, setCards] = useState<Card[]>([]);
  const [newCard, setNewCard] = useState({ card_id: '', video_url: '', title: '', subject: '' });
  const [editingCard, setEditingCard] = useState<Card | null>(null);
  const [editCardForm, setEditCardForm] = useState({ video_url: '', title: '', subject: '' });
  const [cardQrCodes, setCardQrCodes] = useState<Record<string, string>>({});
  const [loadingQr, setLoadingQr] = useState<Record<string, boolean>>({});
  
  const [logs, setLogs] = useState<AccessLog[]>([]);
  const [logFilters, setLogFilters] = useState({ userId: '', cardId: '', startDate: '', endDate: '' });
  
  useEffect(() => {
    checkAuth();
  }, []);
  
  useEffect(() => {
    // Load QR codes for all cards when cards are loaded
    if (cards.length > 0) {
      cards.forEach(card => {
        if (!cardQrCodes[card.card_id]) {
          loadQrCode(card.card_id);
        }
      });
    }
  }, [cards]);
  
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
  
  async function regenerateQrCode(cardId: string) {
    setLoadingQr(prev => ({ ...prev, [cardId]: true }));
    try {
      const response = await fetch(`/api/admin/cards/${cardId}/qr`);
      if (response.ok) {
        const data = await response.json();
        setCardQrCodes(prev => ({ ...prev, [cardId]: data.qrCode }));
      } else {
        setError('Failed to regenerate QR code');
      }
    } catch (err) {
      setError('Failed to regenerate QR code');
    } finally {
      setLoadingQr(prev => ({ ...prev, [cardId]: false }));
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
    
    setNewUser({ username: '', password: '', role: 'student', expires_at: '' });
    loadUsers();
  }
  
  async function handleUpdateUser(e: React.FormEvent) {
    e.preventDefault();
    if (!editingUser) return;
    
    setError('');
    
    const response = await fetch(`/api/admin/users/${editingUser.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editForm),
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      setError(data.error || 'Failed to update user');
      return;
    }
    
    setEditingUser(null);
    setEditForm({ username: '', password: '', role: 'student', expires_at: '' });
    loadUsers();
  }
  
  async function handleDeleteUser(userId: string, username: string) {
    if (!confirm(`Delete user "${username}"? This cannot be undone.`)) return;
    
    setError('');
    const response = await fetch(`/api/admin/users/${userId}`, { method: 'DELETE' });
    
    if (!response.ok) {
      const data = await response.json();
      setError(data.error || 'Failed to delete user');
      return;
    }
    
    loadUsers();
  }
  
  function startEditUser(user: User) {
    setEditingUser(user);
    setEditForm({
      username: user.username,
      password: '',
      role: user.role,
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
    
    setNewCard({ card_id: '', video_url: '', title: '', subject: '' });
    loadCards();
  }
  
  function startEditCard(card: Card) {
    setEditingCard(card);
    setEditCardForm({
      video_url: card.video_url,
      title: card.title || '',
      subject: card.subject || '',
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
    setEditCardForm({ video_url: '', title: '', subject: '' });
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
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
  }
  
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-gray-500 text-sm">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  const tabs = [
    { id: 'users' as const, label: 'Users', icon: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z' },
    { id: 'cards' as const, label: 'Cards', icon: 'M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10' },
    { id: 'logs' as const, label: 'Logs', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01' },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-gray-900 text-white sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <div>
                <h1 className="font-bold text-lg">Admin Dashboard</h1>
                <p className="text-gray-400 text-xs hidden sm:block">Manage users, cards, and access logs</p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="px-4 py-2 text-sm font-medium text-gray-300 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      {/* Tab Navigation */}
      <div className="bg-white border-b border-gray-200 sticky top-[72px] z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <nav className="flex gap-1 overflow-x-auto py-2 -mb-px">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg whitespace-nowrap transition-colors ${
                  activeTab === tab.id
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={tab.icon} />
                </svg>
                <span className="hidden sm:inline">{tab.label}</span>
              </button>
            ))}
          </nav>
        </div>
      </div>

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
            {/* Create User Form */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-4">Create New User</h2>
              <form onSubmit={handleCreateUser} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                <input
                  type="text"
                  placeholder="Username"
                  value={newUser.username}
                  onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
                  className="px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent focus:bg-white"
                  required
                />
                <input
                  type="password"
                  placeholder="Password"
                  value={newUser.password}
                  onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                  className="px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent focus:bg-white"
                  required
                />
                <select
                  value={newUser.role}
                  onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
                  className="px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent focus:bg-white"
                >
                  <option value="student">Student</option>
                  <option value="admin">Admin</option>
                </select>
                <input
                  type="date"
                  value={newUser.expires_at}
                  onChange={(e) => setNewUser({ ...newUser, expires_at: e.target.value })}
                  className="px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent focus:bg-white"
                  required
                />
                <button
                  type="submit"
                  className="py-3 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 shadow-lg shadow-blue-600/20"
                >
                  Create User
                </button>
              </form>
            </div>

            {/* Users Table */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Username</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Role</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider hidden sm:table-cell">Expires</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider hidden md:table-cell">Created</th>
                      <th className="px-6 py-4 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {users.map((user) => (
                      <tr key={user.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 font-medium text-gray-900">{user.username}</td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex px-2.5 py-1 text-xs font-semibold rounded-full ${
                            user.role === 'admin' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700'
                          }`}>
                            {user.role}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-500 hidden sm:table-cell">{new Date(user.expires_at).toLocaleDateString()}</td>
                        <td className="px-6 py-4 text-sm text-gray-500 hidden md:table-cell">{new Date(user.created_at).toLocaleDateString()}</td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={() => startEditUser(user)}
                              className="px-3 py-1.5 text-sm font-medium text-blue-600 hover:bg-blue-50 rounded-lg"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => handleDeleteUser(user.id, user.username)}
                              className="px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg"
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Cards Tab */}
        {activeTab === 'cards' && (
          <div className="space-y-6">
            {/* Create Card Form */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-4">Add New Card</h2>
              <form onSubmit={handleCreateCard} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                <input
                  type="text"
                  placeholder="Card ID (e.g., PHY-001)"
                  value={newCard.card_id}
                  onChange={(e) => setNewCard({ ...newCard, card_id: e.target.value })}
                  className="px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent focus:bg-white"
                  required
                />
                <input
                  type="url"
                  placeholder="YouTube URL"
                  value={newCard.video_url}
                  onChange={(e) => setNewCard({ ...newCard, video_url: e.target.value })}
                  className="px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent focus:bg-white"
                  required
                />
                <input
                  type="text"
                  placeholder="Title (optional)"
                  value={newCard.title}
                  onChange={(e) => setNewCard({ ...newCard, title: e.target.value })}
                  className="px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent focus:bg-white"
                />
                <select
                  value={newCard.subject}
                  onChange={(e) => setNewCard({ ...newCard, subject: e.target.value })}
                  className="px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent focus:bg-white"
                >
                  <option value="">Select Subject</option>
                  <option value="physics">Physics</option>
                  <option value="math">Math</option>
                </select>
                <button
                  type="submit"
                  className="py-3 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 shadow-lg shadow-blue-600/20"
                >
                  Add Card
                </button>
              </form>
            </div>

            {/* Cards Grid with QR Codes */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {cards.map((card) => (
                <div key={card.id} className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow">
                  {/* Card Header */}
                  <div className="p-5 border-b border-gray-100">
                    <div className="flex items-start justify-between mb-3">
                      <span className="inline-flex px-2.5 py-1 text-xs font-semibold rounded-full bg-gray-900 text-white">
                        {card.card_id}
                      </span>
                      {card.subject && (
                        <span className={`inline-flex px-2.5 py-1 text-xs font-semibold rounded-full ${
                          card.subject === 'physics' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700'
                        }`}>
                          {card.subject}
                        </span>
                      )}
                    </div>
                    <h3 className="font-semibold text-gray-900 mb-2">{card.title || 'Untitled'}</h3>
                    <div className="flex items-center justify-between">
                      <a
                        href={card.video_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 font-medium"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Watch
                      </a>
                      <div className="flex gap-1">
                        <button
                          onClick={() => startEditCard(card)}
                          className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg"
                          title="Edit card"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => handleDeleteCard(card)}
                          className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg"
                          title="Delete card"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>
                  
                  {/* QR Code Section */}
                  <div className="p-5 bg-gray-50">
                    <div className="text-center">
                      {loadingQr[card.card_id] ? (
                        <div className="flex flex-col items-center py-8">
                          <div className="w-8 h-8 border-3 border-orange-500 border-t-transparent rounded-full animate-spin mb-2"></div>
                          <p className="text-sm text-gray-500">Loading QR...</p>
                        </div>
                      ) : cardQrCodes[card.card_id] ? (
                        <>
                          <div className="inline-block p-3 bg-white rounded-xl shadow-sm border border-gray-200 mb-4">
                            <img 
                              src={cardQrCodes[card.card_id]} 
                              alt={`QR Code for ${card.card_id}`} 
                              className="w-32 h-32"
                            />
                          </div>
                          <div className="flex flex-col sm:flex-row gap-2 justify-center">
                            <a
                              href={cardQrCodes[card.card_id]}
                              download={`qr-${card.card_id}.png`}
                              className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800"
                            >
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                              </svg>
                              Download
                            </a>
                            <button
                              onClick={() => regenerateQrCode(card.card_id)}
                              className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-orange-500 text-white text-sm font-medium rounded-lg hover:bg-orange-600"
                            >
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                              </svg>
                              Regenerate
                            </button>
                          </div>
                        </>
                      ) : (
                        <button
                          onClick={() => loadQrCode(card.card_id)}
                          className="inline-flex items-center gap-2 px-4 py-2 bg-orange-500 text-white text-sm font-medium rounded-lg hover:bg-orange-600"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                          </svg>
                          Generate QR Code
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Logs Tab */}
        {activeTab === 'logs' && (
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
                  className="px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent focus:bg-white"
                />
                <input
                  type="text"
                  placeholder="Card ID"
                  value={logFilters.cardId}
                  onChange={(e) => setLogFilters({ ...logFilters, cardId: e.target.value })}
                  className="px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent focus:bg-white"
                />
                <input
                  type="date"
                  value={logFilters.startDate}
                  onChange={(e) => setLogFilters({ ...logFilters, startDate: e.target.value })}
                  className="px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent focus:bg-white"
                />
                <input
                  type="date"
                  value={logFilters.endDate}
                  onChange={(e) => setLogFilters({ ...logFilters, endDate: e.target.value })}
                  className="px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent focus:bg-white"
                />
                <button
                  onClick={loadLogs}
                  className="py-3 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 shadow-lg shadow-blue-600/20"
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
                        <td className="px-6 py-4 text-sm text-gray-900">{log.username || log.user_id.slice(0, 8) + '...'}</td>
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
        )}
      </main>

      {/* Edit User Modal */}
      {editingUser && (
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
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent focus:bg-white"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">New Password</label>
                <input
                  type="password"
                  value={editForm.password}
                  onChange={(e) => setEditForm({ ...editForm, password: e.target.value })}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent focus:bg-white"
                  placeholder="Leave empty to keep current"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Role</label>
                <select
                  value={editForm.role}
                  onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent focus:bg-white"
                >
                  <option value="student">Student</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Expiration Date</label>
                <input
                  type="date"
                  value={editForm.expires_at}
                  onChange={(e) => setEditForm({ ...editForm, expires_at: e.target.value })}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent focus:bg-white"
                  required
                />
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  className="flex-1 py-3 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700"
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
      )}

      {/* Edit Card Modal */}
      {editingCard && (
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
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent focus:bg-white"
                  placeholder="Card title (optional)"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Video URL</label>
                <input
                  type="url"
                  value={editCardForm.video_url}
                  onChange={(e) => setEditCardForm({ ...editCardForm, video_url: e.target.value })}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent focus:bg-white"
                  placeholder="YouTube URL"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Subject</label>
                <select
                  value={editCardForm.subject}
                  onChange={(e) => setEditCardForm({ ...editCardForm, subject: e.target.value })}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent focus:bg-white"
                >
                  <option value="">No subject</option>
                  <option value="physics">Physics</option>
                  <option value="math">Math</option>
                </select>
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  className="flex-1 py-3 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700"
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
      )}
    </div>
  );
}
