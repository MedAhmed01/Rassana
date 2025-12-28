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

interface Topic {
  id: string;
  name: string;
}

interface Student {
  id: string;
  username: string;
  email: string;
  phone?: string;
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
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'expired'>('all');
  
  // Form states
  const [showForm, setShowForm] = useState(false);
  const [editingSubscription, setEditingSubscription] = useState<Subscription | null>(null);
  const [form, setForm] = useState({ student_id: '', topic_id: '', duration: 1 });
  const [customDate, setCustomDate] = useState('');
  const [useCustomDate, setUseCustomDate] = useState(false);

  useEffect(() => {
    loadSubscriptions();
    loadTopics();
    loadStudents();
  }, []);

  async function loadSubscriptions() {
    setLoading(true);
    try {
      const response = await fetch('/api/lms/admin/subscriptions');
      if (response.ok) {
        const data = await response.json();
        setSubscriptions(data.subscriptions || []);
      }
    } catch (err) {
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
    } catch (err) {
      console.error('Failed to load topics');
    }
  }

  async function loadStudents() {
    try {
      const response = await fetch('/api/lms/admin/students');
      if (response.ok) {
        const data = await response.json();
        setStudents((data.students || []).map((s: any) => ({
          id: s.student_id,
          username: s.username,
          email: s.email,
          phone: s.phone,
        })));
      }
    } catch (err) {
      console.error('Failed to load students');
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
        // For extending, add months from current expiry or now (whichever is later)
        const baseDate = new Date(editingSubscription.expires_at) > new Date() 
          ? editingSubscription.expires_at 
          : new Date().toISOString();
        expires_at = calculateExpiryDate(form.duration, baseDate);
      } else {
        expires_at = calculateExpiryDate(form.duration);
      }
      
      const url = editingSubscription 
        ? `/api/lms/admin/subscriptions/${editingSubscription.id}`
        : '/api/lms/admin/subscriptions';
      const method = editingSubscription ? 'PATCH' : 'POST';
      
      const body = editingSubscription 
        ? { expires_at }
        : { student_id: form.student_id, topic_id: form.topic_id, expires_at };
      
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      
      if (!response.ok) {
        const data = await response.json();
        onError(data.error || 'Failed to save subscription');
        return;
      }
      
      setShowForm(false);
      setEditingSubscription(null);
      setForm({ student_id: '', topic_id: '', duration: 1 });
      setCustomDate('');
      setUseCustomDate(false);
      loadSubscriptions();
    } catch (err) {
      onError('Failed to save subscription');
    }
  }

  function startEditSubscription(subscription: Subscription) {
    setEditingSubscription(subscription);
    setForm({ 
      student_id: subscription.student_id, 
      topic_id: subscription.topic_id, 
      duration: 1,
    });
    setCustomDate('');
    setUseCustomDate(false);
    setShowForm(true);
  }

  function openNewSubscriptionForm() {
    setShowForm(true);
    setEditingSubscription(null);
    setForm({ student_id: '', topic_id: '', duration: 1 });
    setCustomDate('');
    setUseCustomDate(false);
  }

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }

  function getDaysRemaining(expiresAt: string): number {
    const now = new Date();
    const expiry = new Date(expiresAt);
    const diff = expiry.getTime() - now.getTime();
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
      {/* Header with Filter and Add Button */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between">
        <div className="flex gap-2">
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

      {/* Subscription Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden">
            {/* Modal Header */}
            <div className="p-6 border-b border-slate-200">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-slate-900">
                  {editingSubscription ? 'Extend Subscription' : 'Create Subscription'}
                </h3>
                <button
                  onClick={() => setShowForm(false)}
                  className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                >
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

            {/* Modal Body */}
            <form onSubmit={handleSaveSubscription} className="p-6 space-y-4">
              {!editingSubscription && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Student <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={form.student_id}
                      onChange={(e) => setForm({ ...form, student_id: e.target.value })}
                      className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#ff8240]/50"
                      required
                    >
                      <option value="">Select a student</option>
                      {students.map(student => (
                        <option key={student.id} value={student.id}>
                          {student.username} ({student.email})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Topic <span className="text-red-500">*</span>
                    </label>
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
                </>
              )}

              {/* Duration Selection */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Duration
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {DURATION_OPTIONS.map(option => (
                    <button
                      key={option.months}
                      type="button"
                      onClick={() => {
                        setForm({ ...form, duration: option.months });
                        setUseCustomDate(false);
                      }}
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

              {/* Custom Date Option */}
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

              {/* Preview */}
              <div className="p-4 bg-slate-50 rounded-xl">
                <p className="text-sm text-slate-600">
                  {editingSubscription ? 'New expiry date:' : 'Subscription will expire on:'}
                </p>
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

              {/* Actions */}
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="flex-1 px-4 py-3 text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-3 bg-gradient-to-r from-[#ff8240] to-[#00f99d] text-white font-medium rounded-xl hover:opacity-90 transition-opacity"
                >
                  {editingSubscription ? 'Extend' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Subscriptions List */}
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
                        <div>
                          <p className="font-medium text-slate-900">{subscription.student?.username || 'Unknown'}</p>
                          {subscription.student?.email && <p className="text-sm text-slate-500">{subscription.student.email}</p>}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="px-3 py-1 bg-slate-100 text-slate-700 rounded-full text-sm">
                          {subscription.topic?.name || 'Unknown'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                          subscription.is_active 
                            ? isExpiringSoon
                              ? 'bg-amber-100 text-amber-700'
                              : 'bg-green-100 text-green-700'
                            : 'bg-red-100 text-red-700'
                        }`}>
                          {subscription.is_active 
                            ? isExpiringSoon 
                              ? `Expires in ${daysRemaining}d`
                              : 'Active'
                            : 'Expired'
                          }
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600">
                        {formatDate(subscription.expires_at)}
                      </td>
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
    </div>
  );
}
