'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

interface Packet {
  id: string;
  title: string;
  thumbnail_url?: string;
  card_count: number;
}

function PacketCard({ packet, onClick }: { packet: Packet; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="group relative rounded-2xl overflow-hidden shadow-md hover:shadow-xl transition-shadow duration-300 text-left w-full focus:outline-none focus:ring-2 focus:ring-white/40 bg-black border border-white/10"
      style={{ aspectRatio: '9/16' }}
    >
      {/* Thumbnail or gradient fallback */}
      {packet.thumbnail_url ? (
        <div className="absolute inset-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={packet.thumbnail_url}
            alt={packet.title}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
        </div>
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-slate-800 to-slate-900">
          <div className="absolute inset-0 opacity-10">
            <div className="absolute top-6 right-6 w-24 h-24 rounded-full border-2 border-white" />
            <div className="absolute top-14 right-14 w-12 h-12 rounded-full border border-white" />
            <div className="absolute bottom-16 left-6 w-16 h-16 rounded-full border border-white" />
          </div>
        </div>
      )}

      {/* Card count badge */}
      <div className="absolute top-3 left-3">
        <span className="bg-black/40 backdrop-blur-sm text-white/80 text-xs font-semibold px-2.5 py-1 rounded-full">
          {packet.card_count} {packet.card_count === 1 ? 'card' : 'cards'}
        </span>
      </div>

      {/* Title at bottom */}
      <div className="absolute bottom-0 inset-x-0 px-4 py-4">
        <h3 className="text-white font-bold text-base leading-tight drop-shadow-sm">
          {packet.title}
        </h3>
      </div>

      {/* Hover overlay */}
      <div className="absolute inset-0 bg-white/0 group-hover:bg-white/5 transition-colors duration-300 pointer-events-none" />
    </button>
  );
}

export default function MyCardsPage() {
  const router = useRouter();
  const [packets, setPackets] = useState<Packet[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function load() {
      try {
        const sessionRes = await fetch('/api/auth/session');
        if (!sessionRes.ok || !(await sessionRes.json()).authenticated) {
          router.push('/login');
          return;
        }

        const res = await fetch('/api/student/packets');
        if (!res.ok) { setError('Failed to load your packets.'); setLoading(false); return; }
        const data = await res.json();
        setPackets(data.packets || []);
      } catch {
        setError('Something went wrong. Please try again.');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [router]);

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Background glow */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 right-0 w-96 h-96 bg-[#ff8240]/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-[#00f99d]/10 rounded-full blur-3xl" />
      </div>

      <div className="relative">
        {/* Header */}
        <header className="px-4 pt-6 pb-4 flex items-center gap-3 max-w-5xl mx-auto">
          <button
            onClick={() => router.push('/')}
            className="w-9 h-9 flex items-center justify-center rounded-xl bg-white/10 hover:bg-white/20 transition-colors"
            aria-label="Back to home"
          >
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div>
            <h1 className="text-xl font-bold text-white leading-tight">Online Cards</h1>
            <p className="text-white/50 text-xs mt-0.5">Your subscribed packets</p>
          </div>
        </header>

        <main className="px-4 pb-12 max-w-5xl mx-auto">
          {loading && (
            <div className="flex justify-center items-center py-24">
              <div className="w-8 h-8 border-2 border-white/20 border-t-[#ff8240] rounded-full animate-spin" />
            </div>
          )}

          {!loading && error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-6 text-center text-red-400 text-sm">
              {error}
            </div>
          )}

          {!loading && !error && packets.length === 0 && (
            <div className="text-center py-24">
              <div className="w-20 h-20 mx-auto mb-5 bg-white/5 rounded-full flex items-center justify-center">
                <svg className="w-10 h-10 text-white/20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
              </div>
              <p className="text-white/40 text-sm">You don&apos;t have any active packets yet.</p>
              <p className="text-white/25 text-xs mt-1">Contact your teacher to get access.</p>
            </div>
          )}

          {!loading && !error && packets.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 mt-2">
              {packets.map((packet) => (
                <PacketCard
                  key={packet.id}
                  packet={packet}
                  onClick={() => router.push(`/my-cards/${packet.id}`)}
                />
              ))}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
