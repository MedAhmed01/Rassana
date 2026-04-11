'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';

interface OnlineCard {
  id: string;
  packet_id: string;
  title: string;
  image_url?: string;
  youtube_url: string;
  sort_order: number;
}

interface OnlinePacket {
  id: string;
  title: string;
  thumbnail_url?: string;
}

declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: () => void;
  }
}

function extractYouTubeId(url: string): string | null {
  const match = url.match(
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/
  );
  return match ? match[1] : null;
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// ── Full custom video player (same experience as /access/[cardId]) ────────────
function VideoPlayer({ videoId, phone, onClose }: { videoId: string; phone?: string; onClose: () => void }) {
  const playerRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const playerIdRef = useRef(`yt-player-${videoId}-${Math.random().toString(36).slice(2)}`);

  const [playerReady, setPlayerReady] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [showControls, setShowControls] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const controlsTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const resetControlsTimeout = useCallback(() => {
    setShowControls(true);
    if (controlsTimeout.current) clearTimeout(controlsTimeout.current);
    controlsTimeout.current = setTimeout(() => setShowControls(false), 3000);
  }, []);

  // Init YouTube player
  useEffect(() => {
    const playerId = playerIdRef.current;

    function createPlayer() {
      if (playerRef.current) { try { playerRef.current.destroy(); } catch {} }
      playerRef.current = new window.YT.Player(playerId, {
        videoId,
        playerVars: { autoplay: 1, controls: 0, disablekb: 1, fs: 0, iv_load_policy: 3, modestbranding: 1, rel: 0, playsinline: 1 },
        events: {
          onReady: (e: any) => {
            setPlayerReady(true);
            setDuration(e.target.getDuration());
            e.target.playVideo();
            setIsPlaying(true);
          },
          onStateChange: (e: any) => {
            setIsPlaying(e.data === window.YT?.PlayerState?.PLAYING);
          },
        },
      });
    }

    if (window.YT && window.YT.Player) {
      createPlayer();
    } else {
      const prev = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => { prev?.(); createPlayer(); };
      if (!document.querySelector('script[src*="youtube.com/iframe_api"]')) {
        const tag = document.createElement('script');
        tag.src = 'https://www.youtube.com/iframe_api';
        document.head.appendChild(tag);
      }
    }

    return () => {
      if (controlsTimeout.current) clearTimeout(controlsTimeout.current);
      try { playerRef.current?.destroy(); } catch {}
    };
  }, [videoId]);

  // Time ticker
  useEffect(() => {
    if (!playerReady) return;
    const id = setInterval(() => {
      if (playerRef.current?.getCurrentTime) {
        setCurrentTime(playerRef.current.getCurrentTime());
        setDuration(playerRef.current.getDuration());
      }
    }, 500);
    return () => clearInterval(id);
  }, [playerReady]);

  // Auto-hide controls
  useEffect(() => {
    if (!isPlaying) { setShowControls(true); return; }
    resetControlsTimeout();
  }, [isPlaying, resetControlsTimeout]);

  // Fullscreen listener
  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  const togglePlay = useCallback(() => {
    if (!playerRef.current || !playerReady) return;
    const state = playerRef.current.getPlayerState();
    if (state === 1) { playerRef.current.pauseVideo(); setIsPlaying(false); }
    else { playerRef.current.playVideo(); setIsPlaying(true); }
  }, [playerReady]);

  const skip = useCallback((secs: number) => {
    if (!playerRef.current || !duration) return;
    const t = Math.max(0, Math.min(currentTime + secs, duration));
    playerRef.current.seekTo(t, true);
    setCurrentTime(t);
  }, [currentTime, duration]);

  const handleSeek = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!progressRef.current || !playerRef.current || !duration) return;
    const rect = progressRef.current.getBoundingClientRect();
    const t = ((e.clientX - rect.left) / rect.width) * duration;
    playerRef.current.seekTo(t, true);
    setCurrentTime(t);
  }, [duration]);

  const toggleFullscreen = useCallback(() => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) containerRef.current.requestFullscreen().catch(() => {});
    else document.exitFullscreen();
  }, []);

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;
  const playerId = playerIdRef.current;

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-50 bg-black flex flex-col"
      onMouseMove={resetControlsTimeout}
      onTouchStart={resetControlsTimeout}
    >
      {/* Header */}
      <div className={`absolute top-0 inset-x-0 z-30 bg-gradient-to-b from-black/80 to-transparent px-4 py-3 flex items-center justify-between transition-opacity duration-300 ${showControls ? 'opacity-100' : 'opacity-0'}`}>
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-7 h-7 bg-[#ff8240] rounded-lg flex items-center justify-center flex-shrink-0">
            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          </div>
          <span className="text-white text-sm font-medium truncate">Rassana CardVideo</span>
        </div>
        <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors">
          <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Video area */}
      <div className="flex-1 flex items-center justify-center">
        <div className="relative w-full h-full max-w-5xl" style={{ maxHeight: isFullscreen ? '100vh' : undefined }}>
          {/* YouTube player div */}
          <div id={playerId} className="absolute inset-0 w-full h-full pointer-events-none" />

          {/* Watermark */}
          {phone && (
            <div className="absolute inset-0 z-40 pointer-events-none select-none overflow-hidden">
              <div className="absolute text-white/25 text-[11px] font-medium tracking-wide animate-[moveWatermark_20s_linear_infinite]">
                {phone}
              </div>
            </div>
          )}

          {/* Click overlay */}
          <div className="absolute inset-0 z-10" onClick={() => { togglePlay(); resetControlsTimeout(); }} />

          {/* Loading */}
          {!playerReady && (
            <div className="absolute inset-0 flex items-center justify-center bg-black z-20">
              <div className="w-12 h-12 border-4 border-[#ff8240] border-t-transparent rounded-full animate-spin" />
            </div>
          )}

          {/* Center controls */}
          <div className={`absolute inset-0 flex items-center justify-center z-20 pointer-events-none transition-opacity duration-300 ${showControls || !isPlaying ? 'opacity-100' : 'opacity-0'}`}>
            <div className="flex items-center gap-6 pointer-events-auto">
              {/* Skip back */}
              <button
                onClick={(e) => { e.stopPropagation(); skip(-10); }}
                disabled={!playerReady}
                className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-black/60 hover:bg-black/80 flex items-center justify-center text-white transition-all hover:scale-105 active:scale-90 disabled:opacity-40"
              >
                <div className="relative">
                  <svg className="w-7 h-7 sm:w-8 sm:h-8" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z"/>
                  </svg>
                  <span className="absolute inset-0 flex items-center justify-center text-[9px] sm:text-[11px] font-bold mt-0.5">10</span>
                </div>
              </button>

              {/* Play/Pause */}
              <button
                onClick={(e) => { e.stopPropagation(); togglePlay(); }}
                disabled={!playerReady}
                className={`w-14 h-14 sm:w-16 sm:h-16 rounded-full flex items-center justify-center text-white shadow-lg transition-all hover:scale-105 active:scale-90 disabled:opacity-40 ${playerReady ? 'bg-[#ff8240] hover:bg-[#00f99d] shadow-[#ff8240]/40' : 'bg-gray-600'}`}
              >
                {!playerReady ? (
                  <svg className="w-6 h-6 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                  </svg>
                ) : isPlaying ? (
                  <svg className="w-6 h-6 sm:w-7 sm:h-7" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z"/>
                  </svg>
                ) : (
                  <svg className="w-6 h-6 sm:w-7 sm:h-7 ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M8 5v14l11-7z"/>
                  </svg>
                )}
              </button>

              {/* Skip forward */}
              <button
                onClick={(e) => { e.stopPropagation(); skip(10); }}
                disabled={!playerReady}
                className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-black/60 hover:bg-black/80 flex items-center justify-center text-white transition-all hover:scale-105 active:scale-90 disabled:opacity-40"
              >
                <div className="relative">
                  <svg className="w-7 h-7 sm:w-8 sm:h-8" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 5V1l5 5-5 5V7c-3.31 0-6 2.69-6 6s2.69 6 6 6 6-2.69 6-6h2c0 4.42-3.58 8-8 8s-8-3.58-8-8 3.58-8 8-8z"/>
                  </svg>
                  <span className="absolute inset-0 flex items-center justify-center text-[9px] sm:text-[11px] font-bold mt-0.5">10</span>
                </div>
              </button>
            </div>
          </div>

          {/* Bottom controls */}
          <div className={`absolute bottom-0 inset-x-0 z-30 bg-gradient-to-t from-black/80 to-transparent pt-8 pb-3 px-4 transition-opacity duration-300 pointer-events-none ${showControls ? 'opacity-100' : 'opacity-0'}`}>
            {/* Progress bar */}
            <div
              ref={progressRef}
              className="h-1 bg-gray-600 rounded-full mb-3 cursor-pointer group pointer-events-auto"
              onClick={(e) => { e.stopPropagation(); handleSeek(e); }}
            >
              <div className="h-full bg-[#ff8240] rounded-full relative" style={{ width: `${progress}%` }}>
                <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-[#00f99d] rounded-full opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </div>

            {/* Controls row */}
            <div className="flex items-center justify-between pointer-events-auto">
              <span className="text-white/70 text-xs tabular-nums">
                {formatTime(currentTime)} / {formatTime(duration)}
              </span>
              <button
                onClick={toggleFullscreen}
                className="p-1.5 text-white/70 hover:text-white transition-colors"
              >
                {isFullscreen ? (
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 9V4.5M9 9H4.5M9 9L3.75 3.75M9 15v4.5M9 15H4.5M9 15l-5.25 5.25M15 9h4.5M15 9V4.5M15 9l5.25-5.25M15 15h4.5M15 15v4.5m0-4.5l5.25 5.25" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                  </svg>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Flip card — front = question image, flip → video player opens ────────────
const FLIP_DURATION = 600; // ms, must match CSS transition below

function FlipCard({ card, phone }: { card: OnlineCard; phone?: string }) {
  const [flipped, setFlipped] = useState(false);
  const [showPlayer, setShowPlayer] = useState(false);
  const videoId = extractYouTubeId(card.youtube_url);

  function handleTap() {
    if (flipped) return; // already flipped, player is open
    setFlipped(true);
    // Open player after flip animation completes
    setTimeout(() => setShowPlayer(true), FLIP_DURATION);
  }

  function handleClose() {
    setShowPlayer(false);
    setFlipped(false);
  }

  return (
    <>
      <div
        className="cursor-pointer select-none"
        style={{ perspective: '1200px', aspectRatio: '9/16' }}
        onClick={handleTap}
        role="button"
        aria-label={`Flip card: ${card.title}`}
      >
        {/* Inner wrapper — rotates */}
        <div
          style={{
            position: 'relative',
            width: '100%',
            height: '100%',
            transformStyle: 'preserve-3d',
            transition: `transform ${FLIP_DURATION}ms cubic-bezier(0.4, 0, 0.2, 1)`,
            transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
          }}
        >
          {/* ── FRONT — question image, no play icon ── */}
          <div
            style={{ position: 'absolute', inset: 0, backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden' }}
            className="rounded-2xl overflow-hidden shadow-lg border border-white/10"
          >
            {card.image_url ? (
              <div className="relative w-full h-full bg-black">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={card.image_url} alt={card.title} className="absolute inset-0 w-full h-full object-cover" />
                <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent px-3 py-3">
                  <p className="text-white text-xs font-semibold leading-snug drop-shadow truncate">{card.title}</p>
                  <p className="text-white/50 text-[10px] mt-0.5">Tap to flip</p>
                </div>
              </div>
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-slate-800 to-slate-900 flex flex-col items-center justify-center gap-3 p-5">
                <p className="text-center font-semibold text-white/90 text-sm leading-snug">{card.title}</p>
                <span className="text-white/30 text-[11px] mt-auto">Tap to flip</span>
              </div>
            )}
          </div>

          {/* ── BACK — solid dark face shown during flip, player opens on top ── */}
          <div
            style={{ position: 'absolute', inset: 0, backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
            className="rounded-2xl overflow-hidden shadow-lg bg-black flex items-center justify-center"
          >
            <div className="w-8 h-8 border-2 border-white/20 border-t-[#ff8240] rounded-full animate-spin" />
          </div>
        </div>
      </div>

      {showPlayer && videoId && (
        <VideoPlayer videoId={videoId} phone={phone} onClose={handleClose} />
      )}
    </>
  );
}

export default function PacketDetailPage() {
  const router = useRouter();
  const params = useParams();
  const packetId = params.packetId as string;

  const [packet, setPacket] = useState<OnlinePacket | null>(null);
  const [cards, setCards] = useState<OnlineCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [userPhone, setUserPhone] = useState<string | undefined>();

  useEffect(() => {
    async function load() {
      try {
        const [sessionRes, cardsRes] = await Promise.all([
          fetch('/api/auth/session'),
          fetch(`/api/student/packets/${packetId}/cards`),
        ]);

        if (!sessionRes.ok) { router.push('/login'); return; }
        const session = await sessionRes.json();
        if (!session.authenticated) { router.push('/login'); return; }
        setUserPhone(session.phone || undefined);

        if (cardsRes.status === 403) { setError('You do not have access to this packet.'); setLoading(false); return; }
        if (!cardsRes.ok) { setError('Failed to load cards. Please try again.'); setLoading(false); return; }

        const data = await cardsRes.json();
        setPacket(data.packet);
        setCards(data.cards || []);
      } catch {
        setError('Something went wrong. Please try again.');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [router, packetId]);

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 right-0 w-96 h-96 bg-[#ff8240]/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-[#00f99d]/10 rounded-full blur-3xl" />
      </div>

      <div className="relative">
        <header className="px-4 pt-6 pb-4 flex items-center gap-3 max-w-5xl mx-auto">
          <button
            onClick={() => router.push('/my-cards')}
            className="w-9 h-9 flex items-center justify-center rounded-xl bg-white/10 hover:bg-white/20 transition-colors flex-shrink-0"
            aria-label="Back"
          >
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-white leading-tight truncate">{packet?.title || 'Packet'}</h1>
            <p className="text-white/50 text-xs mt-0.5">
              {cards.length} {cards.length === 1 ? 'card' : 'cards'} — tap a card to watch
            </p>
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

          {!loading && !error && cards.length === 0 && (
            <div className="text-center py-24">
              <div className="w-20 h-20 mx-auto mb-5 bg-white/5 rounded-full flex items-center justify-center">
                <svg className="w-10 h-10 text-white/20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <p className="text-white/40 text-sm">No cards in this packet yet.</p>
            </div>
          )}

          {!loading && !error && cards.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 mt-2">
              {cards.map((card) => (
                <FlipCard key={card.id} card={card} phone={userPhone} />
              ))}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
