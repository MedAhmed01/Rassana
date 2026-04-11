'use client';

import { useState, useEffect } from 'react';

interface Subscription {
  id: string;
  student_id: string;
  topic_id: string;
  starts_at: string;
  expires_at: string;
  is_active: boolean;
  student?: { id: string; username: string; email: string; phone?: string };
  topic?: { name: string };
}

interface Student {
  id: string;
  username: string;
  email: string;
  phone?: string;
}

interface Topic {
  id: string;
  name: string;
}

interface Package {
  id: string;
  name: string;
  duration_days: number;
}

interface OnlinePacket {
  id: string;
  title: string;
  thumbnail_url?: string;
  card_count: number;
  subscriber_count: number;
}

interface Props {
  onError: (error: string) => void;
}

const DURATION_OPTIONS = [
  { label: '1 Month', months: 1 },
  { label: '3 Months', months: 3 },
  { label: '6 Months', months: 6 },
];

export function LMSSubscriptionsSubTab({ onError }: Props) {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [packages, setPackages] = useState<Package[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'expired'>('all');
  const [activeSection, setActiveSection] = useState<'subscriptions' | 'packets'>('subscriptions');

  // Online packets state
  const [onlinePackets, setOnlinePackets] = useState<OnlinePacket[]>([]);
  const [packetsLoading, setPacketsLoading] = useState(false);
  const [showPacketSubscribeForm, setShowPacketSubscribeForm] = useState(false);
  const [selectedPacket, setSelectedPacket] = useState<OnlinePacket | null>(null);
  const [packetSubscribeUserId, setPacketSubscribeUserId] = useState('');
  const [packetSubscribeLoading, setPacketSubscribeLoading] = useState(false);
  const [allUsers, setAllUsers] = useState<{ user_id: string; username: string; phone?: string }[]>([]);

  // Form states
  const [showForm, setShowForm] = useState(false);
  const [editingSubscription, setEditingSubscription] = useState<Subscription | null>(null);
  const [subscriptionType, setSubscriptionType] = useState<'topic' | 'package'>('topic');
  const [form, setForm] = useState({ student_id: '', topic_id: '', package_id: '', duration: 1 });
  const [customDate, setCustomDate] = useState('');
  const [useCustomDate, setUseCustomDate] = useState(false);

  useEffect(() => {
    loadSubscriptions();
    loadTopics();
    loadStudents();
    loadPackages();
    loadOnlinePackets();
    loadAllUsers();
  }, []);

  async function loadSubscriptions() {
    setLoading(true);
    try {
      const response = await fetch('/api/lms/admin/subscriptions');
      if (response.ok) {
        const data = await response.json();
        setSubscriptions(data.subscriptions || []);
      }
    } catch {
      onError('Failed to load subscriptions');
    } finally {
      setLoading(false);
    }
  }

  async function loadTopics() {
    try {
      const response = await fetch('/api/lms/admin/topics');
      if (response.ok) {
        const data = await response.json();
        setTopics(data.topics || []);
      }
    } catch {
      console.error('Failed to load topics');
    }
  }

  async function loadStudents() {
    try {
      const response = await fetch('/api/lms/admin/students');
      if (response.ok) {
        const data = await response.json();
        setStudents(data.students || []);
      }
    } catch {
      console.error('Failed to load students');
    }
  }

  async function loadPackages() {
    try {
      const response = await fetch('/api/lms/admin/packages');
      if (response.ok) {
        const data = await response.json();
        setPackages(data.packages || []);
      }
    } catch {
      console.error('Failed to load packages');
    }
  }

  async function loadOnlinePackets() {
    setPacketsLoading(true);
    try {
      const response = await fetch('/api/admin/online/packets');
      if (response.ok) {
        const data = await response.json();
        setOnlinePackets(data.packets || []);
      }
    } catch {
      console.error('Failed to load online packets');
    } finally {
      setPacketsLoading(false);
    }
  }

  async function loadAllUsers() {
    try {
      const response = await fetch('/api/admin/users');
      if (response.ok) {
        const data = await response.json();
        setAllUsers(data.users || []);
      }
    } catch {
      console.error('Failed to load users');
    }
  }

  async function handleSubscribeToPacket(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedPacket || !packetSubscribeUserId) return;
    setPacketSubscribeLoading(true);
    try {
      const response = await fetch(`/api/admin/online/packets/${selectedPacket.id}/subscribers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: packetSubscribeUserId }),
      });
      const data = await response.json();
      if (!response.ok) {
        onError(data.error || 'Failed to subscribe user');
        return;
      }
      setShowPacketSubscribeForm(false);
      setSelectedPacket(null);
      setPacketSubscribeUserId('');
      loadOnlinePackets();
    } catch {
      onError('Failed to subscribe user to packet');
    } finally {
      setPacketSubscribeLoading(false);
    }
  }

  function calculateExpiryDate(months: number, fromDate?: string): string {
    const date = fromDate ? new Date(fromDate) : new Date();
    date.setMonth(date.getMonth() + months);
    return date.toISOString();
  }

  async function handleSaveSubscription(e: React.FormEvent) {
    e.preventDefault();
    try {
      let expires_at: string;
      if (useCustomDate && customDate) {
        expires_at = new Date(customDate).toISOString();
      } else if (editingSubscription) {
        const baseDate = new Date(editingSubscription.expires_at) > new Date()
          ? editingSubscription.expires_at
          : new Date().toISOString();
        expires_at = calculateExpiryDate(form.duration, baseDate);
      } else {
        expires_at = calculateExpiryDate(form.duration);
      }

      let url: string;
      let method: string;
      let body: Record<string, unknown>;

      if (subscriptionType === 'package' && !editingSubscription) {
        url = '/api/lms/admin/packages/assign';
        method = 'POST';
        body = { student_id: form.student_id, package_id: form.package_id };
      } else {
        url = editingSubscription
          ? `/api/lms/admin/subscriptions/${editingSubscription.id}`
          : '/api/lms/admin/subscriptions';
        method = editingSubscription ? 'PATCH' : 'POST';
        body = editingSubscription
          ? { expires_at }
          : { student_id: form.student_id, topic_id: form.topic_id, expires_at };
      }

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const data = await response.json();
        onError(data.error || `Failed to ${editingSubscription ? 'update' : 'create'} subscription`);
        return;
      }

      setShowForm(false);
      setEditingSubscription(null);
      setForm({ student_id: '', topic_id: '', package_id: '', duration: 1 });
      setCustomDate('');
      setUseCustomDate(false);
      loadSubscriptions();
    } catch {
      onError('Failed to save subscription');
    }
  }

  function startEditSubscription(subscription: Subscription) {
    setEditingSubscription(subscription);
    setForm({ student_id: subscription.student_id, topic_id: subscription.topic_id, package_id: '', duration: 1 });
    setCustomDate('');
    setUseCustomDate(false);
    setShowForm(true);
  }

  function openNewSubscriptionForm() {
    setShowForm(true);
    setEditingSubscription(null);
    setSubscriptionType('topic');
    setForm({ student_id: '', topic_id: '', package_id: '', duration: 1 });
    setCustomDate('');
    setUseCustomDate(false);
  }

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  }

  function getDaysRemaining(expiresAt: string): number {
    const diff = new Date(expiresAt).getTime() - Date.now();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  }

  const filteredSubscriptions = subscriptions.filter(sub => {
    if (statusFilter === 'active') return sub.is_active;
    if (statusFilter === 'expired') return !sub.is_active;
    return true;
  });

  if (loading) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center">
        <div className="w-8 h-8 border-4 border-[#ff8240] border-t-transparent rounded-full animate-spin mx-auto"></div>
        <p className="text-slate-500 mt-2">Loading subscriptions...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Section Tabs */}
      <div className="flex gap-2 border-b border-slate-200 pb-0">
        <button
          onClick={() => setActiveSection('subscriptions')}
          className={`px-5 py-2.5 text-sm font-medium rounded-t-lg transition-colors border-b-2 -mb-px ${
            activeSection === 'subscriptions'
              ? 'border-[#ff8240] text-[#ff8240]'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          Topic Subscriptions
        </button>
        <button
          onClick={() => setActiveSection('packets')}
          className={`px-5 py-2.5 text-sm font-medium rounded-t-lg transition-colors border-b-2 -mb-px ${
            activeSection === 'packets'
              ? 'border-[#ff8240] text-[#ff8240]'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          Packets
        </button>
      </div>

      {/* ── PACKETS SECTION ── */}
      {activeSection === 'packets' && (
        <div className="space-y-4">
          {packetsLoading ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center">
              <div className="w-8 h-8 border-4 border-[#ff8240] border-t-transparent rounded-full animate-spin mx-auto"></div>
              <p className="text-slate-500 mt-2">Loading packets...</p>
            </div>
          ) : onlinePackets.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-slate-500">
              No packets found.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {onlinePackets.map(packet => (
                <div key={packet.id} className="bg-white rounded-2xl border border-slate-200 overflow-hidden hover:shadow-md transition-shadow">
                  {packet.thumbnail_url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={packet.thumbnail_url} alt={packet.title} className="w-full h-32 object-cover" />
                  )}
                  <div className="p-4">
                    <h4 className="font-semibold text-slate-900 truncate">{packet.title}</h4>
                    <div className="flex gap-4 mt-2 text-sm text-slate-500">
                      <span>{packet.card_count} cards</span>
                      <span>{packet.subscriber_count} subscribers</span>
                    </div>
                    <button
                      onClick={() => { setSelectedPacket(packet); setPacketSubscribeUserId(''); setShowPacketSubscribeForm(true); }}
                      className="mt-3 w-full px-4 py-2 bg-gradient-to-r from-[#ff8240] to-[#00f99d] text-white text-sm font-medium rounded-xl hover:opacity-90 transition-opacity"
                    >
                      Subscribe User
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── SUBSCRIPTIONS SECTION ── */}
      {activeSection === 'subscriptions' && (
        <>
          {/* Header with Filter and Add Button */}
          <div className="flex flex-col sm:flex-row gap-4 justify-between">
            <div className="flex gap-2 flex-wrap">
              {(['all', 'active', 'expired'] as const).map(status => (
                <button
                  key={status}
                  onClick={() => setStatusFilter(status)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    statusFilter === status
                      ? 'bg-[#ff8240] text-white'
                      : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {status.charAt(0).toUpperCase() + status.slice(1)}
                </button>
              ))}
            </div>
            <button
              onClick={openNewSubscriptionForm}
              className="px-4 py-2 bg-gradient-to-r from-[#ff8240] to-[#00f99d] text-white font-medium rounded-lg hover:opacity-90 transition-opacity flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add Subscription
            </button>
          </div>

          {filteredSubscriptions.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-slate-500">
              No subscriptions found. Click "Add Subscription" to create one.
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase">Student</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase">Topic</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase">Status</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase">Expires</th>
                      <th className="px-6 py-4 text-right text-xs font-semibold text-slate-600 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredSubscriptions.map(subscription => {
                      const daysRemaining = getDaysRemaining(subscription.expires_at);
                      const isExpiringSoon = subscription.is_active && daysRemaining <= 7;
                      return (
                        <tr key={subscription.id} className="hover:bg-slate-50">
                          <td className="px-6 py-4">
                            <p className="font-medium text-slate-900">{subscription.student?.username || 'Unknown'}</p>
                            {subscription.student?.email && <p className="text-sm text-slate-500">{subscription.student.email}</p>}
                          </td>
                          <td className="px-6 py-4">
                            <span className="px-3 py-1 bg-slate-100 text-slate-700 rounded-full text-sm">
                              {subscription.topic?.name || 'Unknown'}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                              subscription.is_active
                                ? isExpiringSoon ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'
                                : 'bg-red-100 text-red-700'
                            }`}>
                              {subscription.is_active ? (isExpiringSoon ? `Expires in ${daysRemaining}d` : 'Active') : 'Expired'}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-sm text-slate-600">{formatDate(subscription.expires_at)}</td>
                          <td className="px-6 py-4 text-right">
                            <button
                              onClick={() => startEditSubscription(subscription)}
                              className="px-4 py-2 bg-gradient-to-r from-[#ff8240] to-[#00f99d] text-white text-sm font-medium rounded-lg hover:opacity-90 transition-opacity"
                            >
                              {subscription.is_active ? 'Extend' : 'Renew'}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* ── PACKET SUBSCRIBE MODAL ── */}
      {showPacketSubscribeForm && selectedPacket && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden">
            <div className="p-6 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">Subscribe User</h3>
                <p className="text-sm text-slate-500 mt-0.5 truncate max-w-[220px]">{selectedPacket.title}</p>
              </div>
              <button onClick={() => setShowPacketSubscribeForm(false)} className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
                <svg className="w-5 h-5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <form onSubmit={handleSubscribeToPacket} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  User <span className="text-red-500">*</span>
                </label>
                <select
                  value={packetSubscribeUserId}
                  onChange={(e) => setPacketSubscribeUserId(e.target.value)}
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#ff8240]/50"
                  required
                >
                  <option value="">Select a user</option>
                  {allUsers.map(u => (
                    <option key={u.user_id} value={u.user_id}>
                      {u.username}{u.phone ? ` (${u.phone})` : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowPacketSubscribeForm(false)}
                  className="flex-1 px-4 py-3 text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={packetSubscribeLoading}
                  className="flex-1 px-4 py-3 bg-gradient-to-r from-[#ff8240] to-[#00f99d] text-white font-medium rounded-xl hover:opacity-90 transition-opacity disabled:opacity-60"
                >
                  {packetSubscribeLoading ? 'Subscribing...' : 'Subscribe'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── SUBSCRIPTION FORM MODAL ── */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden">
            <div className="p-6 border-b border-slate-200">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-slate-900">
                  {editingSubscription ? 'Extend Subscription' : 'Create Subscription'}
                </h3>
                <button onClick={() => setShowForm(false)} className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
                  <svg className="w-5 h-5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              {editingSubscription && (
                <p className="text-sm text-slate-500 mt-1">
                  {editingSubscription.student?.username} - {editingSubscription.topic?.name}
                </p>
              )}
            </div>
            <form onSubmit={handleSaveSubscription} className="p-6 space-y-4">
              {!editingSubscription && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Subscription Type</label>
                    <div className="grid grid-cols-2 gap-2 mb-4">
                      {(['topic', 'package'] as const).map(type => (
                        <button
                          key={type}
                          type="button"
                          onClick={() => setSubscriptionType(type)}
                          className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                            subscriptionType === type ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                          }`}
                        >
                          {type === 'topic' ? 'Single Topic' : 'Packet (Package)'}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Student <span className="text-red-500">*</span></label>
                    <select
                      value={form.student_id}
                      onChange={(e) => setForm({ ...form, student_id: e.target.value })}
                      className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#ff8240]/50"
                      required
                    >
                      <option value="">Select a student</option>
                      {students.map(student => (
                        <option key={student.id} value={student.id}>{student.username} ({student.email})</option>
                      ))}
                    </select>
                  </div>
                  {subscriptionType === 'topic' ? (
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Topic <span className="text-red-500">*</span></label>
                      <select
                        value={form.topic_id}
                        onChange={(e) => setForm({ ...form, topic_id: e.target.value })}
                        className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#ff8240]/50"
                        required
                      >
                        <option value="">Select a topic</option>
                        {topics.map(topic => (
                          <option key={topic.id} value={topic.id}>{topic.name}</option>
                        ))}
                      </select>
                    </div>
                  ) : (
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Packet <span className="text-red-500">*</span></label>
                      <select
                        value={form.package_id}
                        onChange={(e) => setForm({ ...form, package_id: e.target.value })}
                        className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#ff8240]/50"
                        required
                      >
                        <option value="">Select a packet</option>
                        {packages.map(pkg => (
                          <option key={pkg.id} value={pkg.id}>{pkg.name} ({pkg.duration_days} days)</option>
                        ))}
                      </select>
                    </div>
                  )}
                </>
              )}
              {(subscriptionType === 'topic' || editingSubscription) && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Duration</label>
                    <div className="grid grid-cols-3 gap-2">
                      {DURATION_OPTIONS.map(option => (
                        <button
                          key={option.months}
                          type="button"
                          onClick={() => { setForm({ ...form, duration: option.months }); setUseCustomDate(false); }}
                          className={`px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                            !useCustomDate && form.duration === option.months
                              ? 'bg-gradient-to-r from-[#ff8240] to-[#00f99d] text-white'
                              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                          }`}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={useCustomDate}
                        onChange={(e) => setUseCustomDate(e.target.checked)}
                        className="w-4 h-4 rounded border-slate-300 text-[#ff8240] focus:ring-[#ff8240]"
                      />
                      <span className="text-sm text-slate-600">Use custom expiry date</span>
                    </label>
                    {useCustomDate && (
                      <input
                        type="date"
                        value={customDate}
                        onChange={(e) => setCustomDate(e.target.value)}
                        min={new Date().toISOString().split('T')[0]}
                        className="w-full mt-2 px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#ff8240]/50"
                        required={useCustomDate}
                      />
                    )}
                  </div>
                  <div className="p-4 bg-slate-50 rounded-xl">
                    <p className="text-sm text-slate-600">{editingSubscription ? 'New expiry date:' : 'Subscription will expire on:'}</p>
                    <p className="text-lg font-semibold text-slate-900 mt-1">
                      {useCustomDate && customDate
                        ? formatDate(customDate)
                        : formatDate(calculateExpiryDate(
                            form.duration,
                            editingSubscription && new Date(editingSubscription.expires_at) > new Date()
                              ? editingSubscription.expires_at
                              : undefined
                          ))
                      }
                    </p>
                  </div>
                </>
              )}
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowForm(false)} className="flex-1 px-4 py-3 text-slate-600 hover:bg-slate-100 rounded-xl transition-colors">
                  Cancel
                </button>
                <button type="submit" className="flex-1 px-4 py-3 bg-gradient-to-r from-[#ff8240] to-[#00f99d] text-white font-medium rounded-xl hover:opacity-90 transition-opacity">
                  {editingSubscription ? 'Extend' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
