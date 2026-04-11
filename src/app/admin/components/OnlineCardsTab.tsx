'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

// ── Types ─────────────────────────────────────────────────────────────────────

interface OnlinePacket {
  id: string;
  title: string;
  thumbnail_url?: string;
  card_count: number;
  subscriber_count: number;
}

interface OnlineCard {
  id: string;
  packet_id: string;
  title: string;
  image_url?: string;
  youtube_url: string;
  sort_order: number;
}

interface Subscriber {
  user_id: string;
  username: string;
  phone?: string;
  subscribed_at: string;
}

interface AdminUser {
  user_id: string;
  username: string;
  phone?: string;
  role: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function uploadImage(file: File): Promise<string | null> {
  const fd = new FormData();
  fd.append('file', file);
  const res = await fetch('/api/admin/upload/thumbnail', { method: 'POST', body: fd });
  if (!res.ok) return null;
  const data = await res.json();
  return data.url as string;
}

// ── Reusable 9/16 image picker ────────────────────────────────────────────────

function ImagePicker({
  preview,
  placeholder,
  onChange,
}: {
  preview: string;
  placeholder: string;
  onChange: (file: File, dataUrl: string) => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div
      className="relative overflow-hidden rounded-2xl border-2 border-dashed border-slate-200 hover:border-[#ff8240]/60 transition-colors cursor-pointer bg-slate-50 group"
      style={{ aspectRatio: '9/16', width: '140px' }}
      onClick={() => ref.current?.click()}
    >
      {preview ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={preview} alt="preview" className="absolute inset-0 w-full h-full object-cover" />
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-3">
          <div className="w-9 h-9 rounded-xl bg-slate-200 group-hover:bg-[#ff8240]/10 transition-colors flex items-center justify-center">
            <svg className="w-5 h-5 text-slate-400 group-hover:text-[#ff8240] transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <span className="text-[11px] text-slate-400 group-hover:text-slate-500 text-center leading-tight">{placeholder}</span>
        </div>
      )}
      {preview && (
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
          <span className="text-white text-xs font-medium opacity-0 group-hover:opacity-100 transition-opacity">Change</span>
        </div>
      )}
      <input
        ref={ref}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="sr-only"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          const reader = new FileReader();
          reader.onload = (ev) => onChange(file, ev.target?.result as string);
          reader.readAsDataURL(file);
          e.target.value = '';
        }}
      />
    </div>
  );
}

// ── Modal shell ───────────────────────────────────────────────────────────────

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h3 className="font-bold text-slate-900 text-lg">{title}</h3>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

// ── Confirm delete dialog ─────────────────────────────────────────────────────

function ConfirmDelete({ message, onConfirm, onCancel }: { message: string; onConfirm: () => void; onCancel: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
        <p className="text-slate-800 font-medium mb-1">Are you sure?</p>
        <p className="text-slate-500 text-sm mb-5">{message}</p>
        <div className="flex gap-3">
          <button onClick={onCancel} className="flex-1 px-4 py-2 text-sm font-semibold bg-slate-100 text-slate-600 rounded-xl hover:bg-slate-200 transition-colors">Cancel</button>
          <button onClick={onConfirm} className="flex-1 px-4 py-2 text-sm font-semibold bg-red-500 text-white rounded-xl hover:bg-red-600 transition-colors">Delete</button>
        </div>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function OnlineCardsTab() {
  type View = 'list' | 'detail';
  type DetailSection = 'cards' | 'subscribers';

  const [view, setView] = useState<View>('list');
  const [detailSection, setDetailSection] = useState<DetailSection>('cards');

  // Packets list
  const [packets, setPackets] = useState<OnlinePacket[]>([]);
  const [packetsLoading, setPacketsLoading] = useState(true);

  // Selected packet + its data
  const [selectedPacket, setSelectedPacket] = useState<OnlinePacket | null>(null);
  const [packetCards, setPacketCards] = useState<OnlineCard[]>([]);
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);

  // All users (for subscriber picker)
  const [allUsers, setAllUsers] = useState<AdminUser[]>([]);
  const [userSearch, setUserSearch] = useState('');

  // Create packet modal
  const [showCreatePacket, setShowCreatePacket] = useState(false);
  const [cpTitle, setCpTitle] = useState('');
  const [cpFile, setCpFile] = useState<File | null>(null);
  const [cpPreview, setCpPreview] = useState('');
  const [cpSaving, setCpSaving] = useState(false);

  // Edit packet modal
  const [editingPacket, setEditingPacket] = useState<OnlinePacket | null>(null);
  const [epTitle, setEpTitle] = useState('');
  const [epFile, setEpFile] = useState<File | null>(null);
  const [epPreview, setEpPreview] = useState('');
  const [epSaving, setEpSaving] = useState(false);

  // Delete packet confirm
  const [confirmDeletePacket, setConfirmDeletePacket] = useState<OnlinePacket | null>(null);

  // Create card modal
  const [showCreateCard, setShowCreateCard] = useState(false);
  const [ccTitle, setCcTitle] = useState('');
  const [ccYoutube, setCcYoutube] = useState('');
  const [ccFile, setCcFile] = useState<File | null>(null);
  const [ccPreview, setCcPreview] = useState('');
  const [ccSaving, setCcSaving] = useState(false);

  // Edit card modal
  const [editingCard, setEditingCard] = useState<OnlineCard | null>(null);
  const [ecTitle, setEcTitle] = useState('');
  const [ecYoutube, setEcYoutube] = useState('');
  const [ecFile, setEcFile] = useState<File | null>(null);
  const [ecPreview, setEcPreview] = useState('');
  const [ecSaving, setEcSaving] = useState(false);

  // Delete card confirm
  const [confirmDeleteCard, setConfirmDeleteCard] = useState<OnlineCard | null>(null);

  // Error / toast
  const [error, setError] = useState('');

  // ── Data loaders ─────────────────────────────────────────────────────────

  const loadPackets = useCallback(async () => {
    setPacketsLoading(true);
    try {
      const res = await fetch('/api/admin/online/packets');
      if (res.ok) {
        const data = await res.json();
        setPackets(data.packets || []);
      }
    } finally {
      setPacketsLoading(false);
    }
  }, []);

  const loadPacketDetail = useCallback(async (packet: OnlinePacket) => {
    setDetailLoading(true);
    try {
      const [cardsRes, subsRes] = await Promise.all([
        fetch(`/api/admin/online/packets/${packet.id}/cards`),
        fetch(`/api/admin/online/packets/${packet.id}/subscribers`),
      ]);
      if (cardsRes.ok) setPacketCards((await cardsRes.json()).cards || []);
      if (subsRes.ok) setSubscribers((await subsRes.json()).subscribers || []);
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const loadAllUsers = useCallback(async () => {
    const res = await fetch('/api/admin/users');
    if (res.ok) {
      const data = await res.json();
      setAllUsers((data.users || []).filter((u: AdminUser) => u.role === 'student'));
    }
  }, []);

  useEffect(() => { loadPackets(); }, [loadPackets]);

  // ── Open packet detail ────────────────────────────────────────────────────

  function openPacket(packet: OnlinePacket) {
    setSelectedPacket(packet);
    setView('detail');
    setDetailSection('cards');
    loadPacketDetail(packet);
    loadAllUsers();
  }

  // ── Create packet ─────────────────────────────────────────────────────────

  async function handleCreatePacket() {
    if (!cpTitle.trim()) return;
    setCpSaving(true);
    try {
      let thumbnail_url: string | null = null;
      if (cpFile) {
        thumbnail_url = await uploadImage(cpFile);
      }
      const res = await fetch('/api/admin/online/packets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: cpTitle.trim(), thumbnail_url }),
      });
      if (!res.ok) {
        const d = await res.json();
        setError(d.error || 'Failed to create packet');
        return;
      }
      setCpTitle(''); setCpFile(null); setCpPreview('');
      setShowCreatePacket(false);
      loadPackets();
    } finally {
      setCpSaving(false);
    }
  }

  // ── Edit packet ───────────────────────────────────────────────────────────

  function openEditPacket(packet: OnlinePacket) {
    setEditingPacket(packet);
    setEpTitle(packet.title);
    setEpFile(null);
    setEpPreview(packet.thumbnail_url || '');
  }

  async function handleEditPacket() {
    if (!editingPacket || !epTitle.trim()) return;
    setEpSaving(true);
    try {
      let thumbnail_url = editingPacket.thumbnail_url || null;
      if (epFile) {
        const uploaded = await uploadImage(epFile);
        if (uploaded) thumbnail_url = uploaded;
      }
      const res = await fetch(`/api/admin/online/packets/${editingPacket.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: epTitle.trim(), thumbnail_url }),
      });
      if (!res.ok) {
        const d = await res.json();
        setError(d.error || 'Failed to update packet');
        return;
      }
      setEditingPacket(null);
      const updated = { ...selectedPacket!, title: epTitle.trim(), thumbnail_url: thumbnail_url || undefined };
      setSelectedPacket(updated);
      loadPackets();
    } finally {
      setEpSaving(false);
    }
  }

  // ── Delete packet ─────────────────────────────────────────────────────────

  async function handleDeletePacket(packet: OnlinePacket) {
    const res = await fetch(`/api/admin/online/packets/${packet.id}`, { method: 'DELETE' });
    if (!res.ok) { setError('Failed to delete packet'); return; }
    setConfirmDeletePacket(null);
    setView('list');
    setSelectedPacket(null);
    loadPackets();
  }

  // ── Create card ───────────────────────────────────────────────────────────

  async function handleCreateCard() {
    if (!selectedPacket || !ccTitle.trim() || !ccYoutube.trim()) return;
    setCcSaving(true);
    try {
      let image_url: string | null = null;
      if (ccFile) {
        image_url = await uploadImage(ccFile);
      }
      const res = await fetch(`/api/admin/online/packets/${selectedPacket.id}/cards`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: ccTitle.trim(), youtube_url: ccYoutube.trim(), image_url }),
      });
      if (!res.ok) {
        const d = await res.json();
        setError(d.error || 'Failed to create card');
        return;
      }
      setCcTitle(''); setCcYoutube(''); setCcFile(null); setCcPreview('');
      setShowCreateCard(false);
      loadPacketDetail(selectedPacket);
    } finally {
      setCcSaving(false);
    }
  }

  // ── Edit card ─────────────────────────────────────────────────────────────

  function openEditCard(card: OnlineCard) {
    setEditingCard(card);
    setEcTitle(card.title);
    setEcYoutube(card.youtube_url);
    setEcFile(null);
    setEcPreview(card.image_url || '');
  }

  async function handleEditCard() {
    if (!editingCard || !ecTitle.trim() || !ecYoutube.trim()) return;
    setEcSaving(true);
    try {
      let image_url = editingCard.image_url || null;
      if (ecFile) {
        const uploaded = await uploadImage(ecFile);
        if (uploaded) image_url = uploaded;
      }
      const res = await fetch(`/api/admin/online/cards/${editingCard.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: ecTitle.trim(), youtube_url: ecYoutube.trim(), image_url }),
      });
      if (!res.ok) {
        const d = await res.json();
        setError(d.error || 'Failed to update card');
        return;
      }
      setEditingCard(null);
      if (selectedPacket) loadPacketDetail(selectedPacket);
    } finally {
      setEcSaving(false);
    }
  }

  // ── Delete card ───────────────────────────────────────────────────────────

  async function handleDeleteCard(card: OnlineCard) {
    const res = await fetch(`/api/admin/online/cards/${card.id}`, { method: 'DELETE' });
    if (!res.ok) { setError('Failed to delete card'); return; }
    setConfirmDeleteCard(null);
    if (selectedPacket) loadPacketDetail(selectedPacket);
  }

  // ── Subscribers ───────────────────────────────────────────────────────────

  const subscriberIds = new Set(subscribers.map((s) => s.user_id));

  const filteredUsers = allUsers.filter((u) => {
    if (subscriberIds.has(u.user_id)) return false;
    const q = userSearch.toLowerCase();
    return u.username.toLowerCase().includes(q) || (u.phone || '').includes(q);
  });

  async function addSubscriber(user: AdminUser) {
    if (!selectedPacket) return;
    const res = await fetch(`/api/admin/online/packets/${selectedPacket.id}/subscribers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: user.user_id }),
    });
    if (!res.ok) { setError('Failed to add subscriber'); return; }
    if (selectedPacket) loadPacketDetail(selectedPacket);
    setUserSearch('');
  }

  async function removeSubscriber(sub: Subscriber) {
    if (!selectedPacket) return;
    const res = await fetch(`/api/admin/online/packets/${selectedPacket.id}/subscribers/${sub.user_id}`, { method: 'DELETE' });
    if (!res.ok) { setError('Failed to remove subscriber'); return; }
    if (selectedPacket) loadPacketDetail(selectedPacket);
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">

      {/* Error banner */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 flex items-center gap-3">
          <svg className="w-5 h-5 text-red-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
          </svg>
          <p className="text-sm text-red-700 flex-1">{error}</p>
          <button onClick={() => setError('')} className="text-red-400 hover:text-red-600">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
      )}

      {/* ── PACKETS LIST ── */}
      {view === 'list' && (
        <>
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">Online Cards</h2>
              <p className="text-slate-500 text-sm mt-0.5">Manage digital card packets and subscriptions</p>
            </div>
            <button
              onClick={() => { setCpTitle(''); setCpFile(null); setCpPreview(''); setShowCreatePacket(true); }}
              className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-[#ff8240] to-[#00f99d] text-white text-sm font-semibold rounded-xl hover:shadow-lg hover:shadow-[#ff8240]/25 transition-all"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              New Packet
            </button>
          </div>

          {/* Packets grid */}
          {packetsLoading ? (
            <div className="flex justify-center py-16">
              <div className="w-8 h-8 border-2 border-slate-200 border-t-[#ff8240] rounded-full animate-spin" />
            </div>
          ) : packets.length === 0 ? (
            <div className="text-center py-20 bg-white rounded-2xl border border-slate-200">
              <div className="w-16 h-16 mx-auto mb-4 bg-slate-100 rounded-2xl flex items-center justify-center">
                <svg className="w-8 h-8 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
              </div>
              <p className="text-slate-500 font-medium">No packets yet</p>
              <p className="text-slate-400 text-sm mt-1">Create your first packet to get started</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {packets.map((packet) => (
                <button
                  key={packet.id}
                  onClick={() => openPacket(packet)}
                  className="group text-left rounded-2xl overflow-hidden border border-slate-200 hover:border-[#ff8240]/40 shadow-sm hover:shadow-md transition-all bg-white"
                >
                  {/* Thumbnail — 9/16 */}
                  <div className="relative bg-slate-100" style={{ aspectRatio: '9/16' }}>
                    {packet.thumbnail_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={packet.thumbnail_url}
                        alt={packet.title}
                        className="absolute inset-0 w-full h-full object-cover"
                      />
                    ) : (
                      <div className="absolute inset-0 bg-gradient-to-br from-[#ff8240]/20 to-[#00f99d]/20 flex items-center justify-center">
                        <svg className="w-10 h-10 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                      </div>
                    )}
                    {/* Stats overlay */}
                    <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/60 to-transparent px-2 py-2">
                      <div className="flex items-center gap-2 text-[11px] text-white/80">
                        <span>{packet.card_count} cards</span>
                        <span>·</span>
                        <span>{packet.subscriber_count} students</span>
                      </div>
                    </div>
                  </div>
                  {/* Title */}
                  <div className="px-3 py-2.5">
                    <p className="text-sm font-semibold text-slate-800 truncate group-hover:text-[#ff8240] transition-colors">{packet.title}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </>
      )}

      {/* ── PACKET DETAIL ── */}
      {view === 'detail' && selectedPacket && (
        <>
          {/* Header */}
          <div className="flex items-start gap-4">
            <button
              onClick={() => { setView('list'); setSelectedPacket(null); }}
              className="mt-1 w-9 h-9 flex items-center justify-center rounded-xl border border-slate-200 hover:bg-slate-50 transition-colors flex-shrink-0"
            >
              <svg className="w-5 h-5 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>

            {/* Packet thumbnail (small) */}
            <div className="flex-shrink-0 w-14 rounded-xl overflow-hidden border border-slate-200 shadow-sm" style={{ aspectRatio: '9/16' }}>
              {selectedPacket.thumbnail_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={selectedPacket.thumbnail_url} alt={selectedPacket.title} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-[#ff8240]/20 to-[#00f99d]/20" />
              )}
            </div>

            <div className="flex-1 min-w-0">
              <h2 className="text-2xl font-bold text-slate-900 truncate">{selectedPacket.title}</h2>
              <p className="text-slate-500 text-sm mt-0.5">
                {selectedPacket.card_count} cards · {selectedPacket.subscriber_count} students
              </p>
              <div className="flex gap-2 mt-3">
                <button
                  onClick={() => openEditPacket(selectedPacket)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                  Edit Packet
                </button>
                <button
                  onClick={() => setConfirmDeletePacket(selectedPacket)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-red-500 bg-red-50 hover:bg-red-100 rounded-lg transition-colors"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  Delete
                </button>
              </div>
            </div>
          </div>

          {/* Section tabs */}
          <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit">
            {(['cards', 'subscribers'] as DetailSection[]).map((s) => (
              <button
                key={s}
                onClick={() => setDetailSection(s)}
                className={`px-4 py-2 text-sm font-semibold rounded-lg transition-all capitalize ${
                  detailSection === s
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {s === 'cards' ? `Cards (${packetCards.length})` : `Subscribers (${subscribers.length})`}
              </button>
            ))}
          </div>

          {detailLoading ? (
            <div className="flex justify-center py-16">
              <div className="w-8 h-8 border-2 border-slate-200 border-t-[#ff8240] rounded-full animate-spin" />
            </div>
          ) : (
            <>
              {/* ── CARDS SECTION ── */}
              {detailSection === 'cards' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-slate-500 font-medium">
                      {packetCards.length === 0 ? 'No cards yet' : `${packetCards.length} card${packetCards.length !== 1 ? 's' : ''}`}
                    </p>
                    <button
                      onClick={() => { setCcTitle(''); setCcYoutube(''); setCcFile(null); setCcPreview(''); setShowCreateCard(true); }}
                      className="flex items-center gap-2 px-3.5 py-2 bg-gradient-to-r from-[#ff8240] to-[#00f99d] text-white text-sm font-semibold rounded-xl hover:shadow-lg hover:shadow-[#ff8240]/25 transition-all"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                      Add Card
                    </button>
                  </div>

                  {packetCards.length === 0 ? (
                    <div className="text-center py-14 bg-white rounded-2xl border border-slate-200 border-dashed">
                      <svg className="w-10 h-10 mx-auto text-slate-300 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      <p className="text-slate-400 text-sm">Add the first card to this packet</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                      {packetCards.map((card) => (
                        <div key={card.id} className="group rounded-2xl overflow-hidden border border-slate-200 bg-white shadow-sm hover:shadow-md transition-all">
                          {/* Card image — 9/16 */}
                          <div className="relative bg-slate-100" style={{ aspectRatio: '9/16' }}>
                            {card.image_url ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={card.image_url} alt={card.title} className="absolute inset-0 w-full h-full object-cover" />
                            ) : (
                              <div className="absolute inset-0 bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center">
                                <svg className="w-8 h-8 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                              </div>
                            )}
                            {/* YouTube indicator */}
                            <div className="absolute top-2 right-2 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center">
                              <svg className="w-3 h-3 text-white" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M8 5v14l11-7z" />
                              </svg>
                            </div>
                            {/* Actions overlay */}
                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
                              <button
                                onClick={() => openEditCard(card)}
                                className="p-2 bg-white rounded-xl text-slate-700 hover:bg-slate-100 transition-colors"
                                title="Edit"
                              >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                </svg>
                              </button>
                              <button
                                onClick={() => setConfirmDeleteCard(card)}
                                className="p-2 bg-red-500 rounded-xl text-white hover:bg-red-600 transition-colors"
                                title="Delete"
                              >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                            </div>
                          </div>
                          {/* Title */}
                          <div className="px-3 py-2.5">
                            <p className="text-sm font-semibold text-slate-800 truncate">{card.title}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* ── SUBSCRIBERS SECTION ── */}
              {detailSection === 'subscribers' && (
                <div className="space-y-4">
                  {/* Add subscriber search */}
                  <div className="bg-white rounded-2xl border border-slate-200 p-5">
                    <p className="text-sm font-semibold text-slate-700 mb-3">Add Student</p>
                    <div className="relative mb-3">
                      <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                      <input
                        type="text"
                        placeholder="Search by username or phone…"
                        value={userSearch}
                        onChange={(e) => setUserSearch(e.target.value)}
                        className="w-full pl-9 pr-4 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#ff8240]/40 focus:border-[#ff8240]/50"
                      />
                    </div>
                    {userSearch && (
                      <div className="max-h-48 overflow-y-auto space-y-1">
                        {filteredUsers.length === 0 ? (
                          <p className="text-sm text-slate-400 text-center py-3">No students found</p>
                        ) : (
                          filteredUsers.slice(0, 20).map((u) => (
                            <button
                              key={u.user_id}
                              onClick={() => addSubscriber(u)}
                              className="w-full flex items-center justify-between px-3 py-2.5 text-left hover:bg-slate-50 rounded-xl transition-colors group"
                            >
                              <div>
                                <p className="text-sm font-medium text-slate-800">{u.username}</p>
                                {u.phone && <p className="text-xs text-slate-400">{u.phone}</p>}
                              </div>
                              <span className="text-xs font-semibold text-[#ff8240] opacity-0 group-hover:opacity-100 transition-opacity">+ Add</span>
                            </button>
                          ))
                        )}
                      </div>
                    )}
                  </div>

                  {/* Subscriber list */}
                  <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                    <div className="px-5 py-4 border-b border-slate-100">
                      <p className="text-sm font-semibold text-slate-700">
                        {subscribers.length} Subscriber{subscribers.length !== 1 ? 's' : ''}
                      </p>
                    </div>
                    {subscribers.length === 0 ? (
                      <div className="px-5 py-10 text-center text-slate-400 text-sm">No students subscribed yet</div>
                    ) : (
                      <div className="divide-y divide-slate-100">
                        {subscribers.map((sub) => (
                          <div key={sub.user_id} className="flex items-center justify-between px-5 py-3.5 hover:bg-slate-50 transition-colors">
                            <div>
                              <p className="text-sm font-medium text-slate-800">{sub.username}</p>
                              {sub.phone && <p className="text-xs text-slate-400">{sub.phone}</p>}
                            </div>
                            <button
                              onClick={() => removeSubscriber(sub)}
                              className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                              title="Remove"
                            >
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7a4 4 0 11-8 0 4 4 0 018 0zM9 14a6 6 0 00-6 6v1h12v-1a6 6 0 00-6-6zM21 12h-6" />
                              </svg>
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </>
      )}

      {/* ── MODALS ── */}

      {/* Create Packet */}
      {showCreatePacket && (
        <Modal title="New Packet" onClose={() => setShowCreatePacket(false)}>
          <div className="space-y-5">
            <div className="flex gap-5">
              <ImagePicker
                preview={cpPreview}
                placeholder="Thumbnail&#10;(9:16)"
                onChange={(file, url) => { setCpFile(file); setCpPreview(url); }}
              />
              <div className="flex-1 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Title</label>
                  <input
                    type="text"
                    placeholder="e.g. Algebra Essentials"
                    value={cpTitle}
                    onChange={(e) => setCpTitle(e.target.value)}
                    className="w-full px-3 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#ff8240]/40 focus:border-[#ff8240]/50"
                    autoFocus
                  />
                </div>
              </div>
            </div>
            <div className="flex gap-3 pt-1">
              <button onClick={() => setShowCreatePacket(false)} className="flex-1 px-4 py-2.5 text-sm font-semibold bg-slate-100 text-slate-600 rounded-xl hover:bg-slate-200 transition-colors">Cancel</button>
              <button
                onClick={handleCreatePacket}
                disabled={!cpTitle.trim() || cpSaving}
                className="flex-1 px-4 py-2.5 text-sm font-semibold bg-gradient-to-r from-[#ff8240] to-[#00f99d] text-white rounded-xl hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {cpSaving && <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>}
                {cpSaving ? 'Creating…' : 'Create Packet'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Edit Packet */}
      {editingPacket && (
        <Modal title="Edit Packet" onClose={() => setEditingPacket(null)}>
          <div className="space-y-5">
            <div className="flex gap-5">
              <ImagePicker
                preview={epPreview}
                placeholder="Thumbnail&#10;(9:16)"
                onChange={(file, url) => { setEpFile(file); setEpPreview(url); }}
              />
              <div className="flex-1 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Title</label>
                  <input
                    type="text"
                    value={epTitle}
                    onChange={(e) => setEpTitle(e.target.value)}
                    className="w-full px-3 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#ff8240]/40 focus:border-[#ff8240]/50"
                  />
                </div>
              </div>
            </div>
            <div className="flex gap-3 pt-1">
              <button onClick={() => setEditingPacket(null)} className="flex-1 px-4 py-2.5 text-sm font-semibold bg-slate-100 text-slate-600 rounded-xl hover:bg-slate-200 transition-colors">Cancel</button>
              <button
                onClick={handleEditPacket}
                disabled={!epTitle.trim() || epSaving}
                className="flex-1 px-4 py-2.5 text-sm font-semibold bg-gradient-to-r from-[#ff8240] to-[#00f99d] text-white rounded-xl hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {epSaving && <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>}
                {epSaving ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Delete Packet */}
      {confirmDeletePacket && (
        <ConfirmDelete
          message={`Delete "${confirmDeletePacket.title}"? All cards and subscriptions will be permanently removed.`}
          onConfirm={() => handleDeletePacket(confirmDeletePacket)}
          onCancel={() => setConfirmDeletePacket(null)}
        />
      )}

      {/* Create Card */}
      {showCreateCard && (
        <Modal title="Add Card" onClose={() => setShowCreateCard(false)}>
          <div className="space-y-5">
            <div className="flex gap-5">
              <ImagePicker
                preview={ccPreview}
                placeholder="Question&#10;image (9:16)"
                onChange={(file, url) => { setCcFile(file); setCcPreview(url); }}
              />
              <div className="flex-1 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Title</label>
                  <input
                    type="text"
                    placeholder="e.g. Question 1"
                    value={ccTitle}
                    onChange={(e) => setCcTitle(e.target.value)}
                    className="w-full px-3 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#ff8240]/40 focus:border-[#ff8240]/50"
                    autoFocus
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">YouTube URL</label>
                  <input
                    type="text"
                    placeholder="https://youtube.com/watch?v=..."
                    value={ccYoutube}
                    onChange={(e) => setCcYoutube(e.target.value)}
                    className="w-full px-3 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#ff8240]/40 focus:border-[#ff8240]/50"
                  />
                </div>
              </div>
            </div>
            <div className="flex gap-3 pt-1">
              <button onClick={() => setShowCreateCard(false)} className="flex-1 px-4 py-2.5 text-sm font-semibold bg-slate-100 text-slate-600 rounded-xl hover:bg-slate-200 transition-colors">Cancel</button>
              <button
                onClick={handleCreateCard}
                disabled={!ccTitle.trim() || !ccYoutube.trim() || ccSaving}
                className="flex-1 px-4 py-2.5 text-sm font-semibold bg-gradient-to-r from-[#ff8240] to-[#00f99d] text-white rounded-xl hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {ccSaving && <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>}
                {ccSaving ? 'Adding…' : 'Add Card'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Edit Card */}
      {editingCard && (
        <Modal title="Edit Card" onClose={() => setEditingCard(null)}>
          <div className="space-y-5">
            <div className="flex gap-5">
              <ImagePicker
                preview={ecPreview}
                placeholder="Question&#10;image (9:16)"
                onChange={(file, url) => { setEcFile(file); setEcPreview(url); }}
              />
              <div className="flex-1 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Title</label>
                  <input
                    type="text"
                    value={ecTitle}
                    onChange={(e) => setEcTitle(e.target.value)}
                    className="w-full px-3 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#ff8240]/40 focus:border-[#ff8240]/50"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">YouTube URL</label>
                  <input
                    type="text"
                    value={ecYoutube}
                    onChange={(e) => setEcYoutube(e.target.value)}
                    className="w-full px-3 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#ff8240]/40 focus:border-[#ff8240]/50"
                  />
                </div>
              </div>
            </div>
            <div className="flex gap-3 pt-1">
              <button onClick={() => setEditingCard(null)} className="flex-1 px-4 py-2.5 text-sm font-semibold bg-slate-100 text-slate-600 rounded-xl hover:bg-slate-200 transition-colors">Cancel</button>
              <button
                onClick={handleEditCard}
                disabled={!ecTitle.trim() || !ecYoutube.trim() || ecSaving}
                className="flex-1 px-4 py-2.5 text-sm font-semibold bg-gradient-to-r from-[#ff8240] to-[#00f99d] text-white rounded-xl hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {ecSaving && <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>}
                {ecSaving ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Delete Card */}
      {confirmDeleteCard && (
        <ConfirmDelete
          message={`Delete the card "${confirmDeleteCard.title}"? This cannot be undone.`}
          onConfirm={() => handleDeleteCard(confirmDeleteCard)}
          onCancel={() => setConfirmDeleteCard(null)}
        />
      )}
    </div>
  );
}
