'use client';

import { useEffect, useState, useRef, useCallback, Suspense } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';

interface VideoData {
  videoUrl: string;
  title?: string;
  phone?: string;
}

interface WatchProgress {
  progress_seconds: number;
  duration_seconds: number;
}

declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: () => void;
  }
}

function extractYouTubeId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// LocalStorage key for continue watching
const CONTINUE_WATCHING_KEY = 'rassana_continue_watching';

function VideoAccessContent() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const cardId = params.cardId as string;
  
  const playerRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const lastTapRef = useRef<number>(0);
  const lastSaveRef = useRef<number>(0);
  const savedProgressRef = useRef<WatchProgress | null>(null);
  const hasResumedRef = useRef<boolean>(false);
  
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [videoData, setVideoData] = useState<VideoData | null>(null);
  const [playerReady, setPlayerReady] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(100);
  const [isMuted, setIsMuted] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isPseudoFullscreen, setIsPseudoFullscreen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isIPhone, setIsIPhone] = useState(false);
  const [showResumePrompt, setShowResumePrompt] = useState(false);
  
  // Detect iPhone (Safari on iPhone doesn't support Fullscreen API for divs)
  useEffect(() => {
    const userAgent = navigator.userAgent || navigator.vendor;
    const isIPhoneDevice = /iPhone/i.test(userAgent) && !/iPad/i.test(userAgent);
    setIsIPhone(isIPhoneDevice);
  }, []);

  // Save watch progress periodically
  const saveProgress = useCallback(async (time: number, dur: number) => {
    if (!cardId || dur <= 0) return;
    
    // Save to localStorage immediately (for Continue Watching feature)
    try {
      const continueWatchingData = {
        card_id: cardId,
        card_title: videoData?.title || null,
        progress_seconds: time,
        duration_seconds: dur,
        last_watched_at: new Date().toISOString(),
        video_url: videoData?.videoUrl || null,
      };
      localStorage.setItem(CONTINUE_WATCHING_KEY, JSON.stringify(continueWatchingData));
    } catch (err) {
      console.error('Failed to save to localStorage:', err);
    }
    
    // Only save to server every 5 seconds to avoid too many requests
    const now = Date.now();
    if (now - lastSaveRef.current < 5000) return;
    lastSaveRef.current = now;
    
    try {
      await fetch('/api/watch-progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cardId,
          progressSeconds: time,
          durationSeconds: dur,
        }),
      });
    } catch (err) {
      console.error('Failed to save progress:', err);
    }
  }, [cardId, videoData]);

  // Fetch saved progress on mount
  useEffect(() => {
    async function fetchSavedProgress() {
      try {
        const response = await fetch(`/api/watch-progress/${cardId}`);
        const data = await response.json();
        if (data.success && data.data) {
          savedProgressRef.current = data.data;
          // Check if we should show resume prompt (if progress > 10 seconds and < 95% complete)
          const progressPercent = data.data.duration_seconds > 0 
            ? (data.data.progress_seconds / data.data.duration_seconds) * 100 
            : 0;
          if (data.data.progress_seconds > 10 && progressPercent < 95) {
            setShowResumePrompt(true);
          }
        }
      } catch (err) {
        console.error('Failed to fetch saved progress:', err);
      }
    }
    
    // Check if we should auto-resume from URL param
    const resumeTime = searchParams.get('t');
    if (resumeTime) {
      savedProgressRef.current = {
        progress_seconds: parseFloat(resumeTime),
        duration_seconds: 0,
      };
      hasResumedRef.current = false; // Will resume when player is ready
    } else {
      fetchSavedProgress();
    }
  }, [cardId, searchParams]);
  
  // Fetch video data
  useEffect(() => {
    async function handleAccess() {
      try {
        const response = await fetch(`/api/access/${cardId}`);
        const data = await response.json();
        
        if (response.status === 401) {
          router.push(`/login?redirect=/access/${cardId}`);
          return;
        }
        
        if (response.status === 403) {
          // Access denied due to subscription
          const message = data.message || 'You do not have access to this content';
          const requiredSubs = data.requiredSubscriptions || [];
          const userSubs = data.userSubscriptions || [];
          
          let errorMsg = message;
          if (requiredSubs.length > 0) {
            errorMsg += `\n\nRequired: ${requiredSubs.join(', ')}`;
            if (userSubs.length > 0) {
              errorMsg += `\nYour subscriptions: ${userSubs.join(', ')}`;
            } else {
              errorMsg += `\nYou have no active subscriptions`;
            }
          }
          
          setError(errorMsg);
          setLoading(false);
          return;
        }
        
        if (!response.ok) {
          setError(data.error || 'Failed to access video');
          setLoading(false);
          return;
        }
        
        if (data.videoUrl) {
          setVideoData({ videoUrl: data.videoUrl, title: data.title, phone: data.phone });
          setLoading(false);
        } else {
          setError('Video URL not found');
          setLoading(false);
        }
      } catch (err) {
        setError('An error occurred.');
        setLoading(false);
      }
    }
    handleAccess();
  }, [cardId, router]);

  // Load YouTube IFrame API
  useEffect(() => {
    if (!videoData) return;
    
    const youtubeId = extractYouTubeId(videoData.videoUrl);
    if (!youtubeId) return;

    if (!window.YT) {
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      const firstScriptTag = document.getElementsByTagName('script')[0];
      firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);
    }

    window.onYouTubeIframeAPIReady = () => {
      playerRef.current = new window.YT.Player('youtube-player', {
        videoId: youtubeId,
        playerVars: {
          autoplay: 1,
          controls: 0,
          disablekb: 1,
          fs: 0,
          iv_load_policy: 3,
          modestbranding: 1,
          rel: 0,
          showinfo: 0,
          playsinline: 1,
        },
        events: {
          onReady: (event: any) => {
            console.log('YouTube player ready');
            setPlayerReady(true);
            setDuration(event.target.getDuration());
            setVolume(event.target.getVolume());
            
            // Check if we should resume from saved progress
            const resumeTime = searchParams.get('t');
            if (resumeTime && !hasResumedRef.current) {
              const time = parseFloat(resumeTime);
              event.target.seekTo(time, true);
              setCurrentTime(time);
              hasResumedRef.current = true;
            } else if (savedProgressRef.current && !hasResumedRef.current && !showResumePrompt) {
              // Auto-resume if coming from continue watching
              const time = savedProgressRef.current.progress_seconds;
              if (time > 10) {
                event.target.seekTo(time, true);
                setCurrentTime(time);
                hasResumedRef.current = true;
              }
            }
            
            // Autoplay the video
            event.target.playVideo();
            setIsPlaying(true);
          },
          onStateChange: (event: any) => {
            const playing = event.data === window.YT.PlayerState.PLAYING;
            console.log('Player state changed:', event.data, 'Playing:', playing);
            setIsPlaying(playing);
          },
        },
      });
    };

    if (window.YT && window.YT.Player) {
      window.onYouTubeIframeAPIReady();
    }

    return () => {
      if (playerRef.current) {
        playerRef.current.destroy();
      }
    };
  }, [videoData]);

  // Update time and save progress
  useEffect(() => {
    if (!playerReady) return;
    
    const interval = setInterval(() => {
      if (playerRef.current && typeof playerRef.current.getCurrentTime === 'function') {
        const time = playerRef.current.getCurrentTime();
        const dur = playerRef.current.getDuration();
        setCurrentTime(time);
        
        // Save progress while playing
        if (isPlaying && dur > 0) {
          saveProgress(time, dur);
        }
      }
    }, 500);
    
    return () => clearInterval(interval);
  }, [playerReady, isPlaying, saveProgress]);

  // Save progress when leaving the page
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (playerRef.current && duration > 0) {
        const time = playerRef.current.getCurrentTime();
        
        // Save to localStorage
        try {
          const continueWatchingData = {
            card_id: cardId,
            card_title: videoData?.title || null,
            progress_seconds: time,
            duration_seconds: duration,
            last_watched_at: new Date().toISOString(),
            video_url: videoData?.videoUrl || null,
          };
          localStorage.setItem(CONTINUE_WATCHING_KEY, JSON.stringify(continueWatchingData));
        } catch (err) {
          console.error('Failed to save to localStorage:', err);
        }
        
        // Use sendBeacon for reliable save on page unload
        navigator.sendBeacon('/api/watch-progress', JSON.stringify({
          cardId,
          progressSeconds: time,
          durationSeconds: duration,
        }));
      }
    };
    
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [cardId, duration, videoData]);

  // Auto-hide controls
  useEffect(() => {
    if (!isPlaying) {
      setShowControls(true);
      return;
    }
    
    const timeout = setTimeout(() => setShowControls(false), 3000);
    return () => clearTimeout(timeout);
  }, [isPlaying, showControls]);

  // Fullscreen change listener
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleContextMenu = (e: MouseEvent) => e.preventDefault();
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey && (e.key === 's' || e.key === 'u')) ||
          (e.ctrlKey && e.shiftKey && e.key === 'i') || e.key === 'F12') {
        e.preventDefault();
      }
      if (e.key === ' ' && playerReady) {
        e.preventDefault();
        togglePlay();
      }
      if (e.key === 'ArrowLeft' && playerReady) {
        e.preventDefault();
        skipBackward();
      }
      if (e.key === 'ArrowRight' && playerReady) {
        e.preventDefault();
        skipForward();
      }
    };
    document.addEventListener('contextmenu', handleContextMenu);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('contextmenu', handleContextMenu);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [playerReady]);

  const togglePlay = useCallback(() => {
    if (!playerRef.current) {
      console.log('Player not initialized');
      return;
    }
    
    if (!playerReady) {
      console.log('Player not ready yet');
      return;
    }
    
    try {
      const playerState = playerRef.current.getPlayerState();
      console.log('Current player state:', playerState);
      
      // YouTube player states: -1 (unstarted), 0 (ended), 1 (playing), 2 (paused), 3 (buffering), 5 (cued)
      if (playerState === 1) {
        // Currently playing, so pause
        console.log('Pausing video');
        playerRef.current.pauseVideo();
        setIsPlaying(false);
      } else {
        // Not playing, so play
        console.log('Playing video');
        playerRef.current.playVideo();
        setIsPlaying(true);
      }
    } catch (error) {
      console.error('Error toggling play:', error);
    }
  }, [playerReady]);

  const skipForward = useCallback(() => {
    if (!playerRef.current || !duration) return;
    const newTime = Math.min(currentTime + 10, duration);
    playerRef.current.seekTo(newTime, true);
    setCurrentTime(newTime);
  }, [currentTime, duration]);

  const skipBackward = useCallback(() => {
    if (!playerRef.current) return;
    const newTime = Math.max(currentTime - 10, 0);
    playerRef.current.seekTo(newTime, true);
    setCurrentTime(newTime);
  }, [currentTime]);

  const handleSeek = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!progressRef.current || !playerRef.current || !duration) return;
    const rect = progressRef.current.getBoundingClientRect();
    const percent = (e.clientX - rect.left) / rect.width;
    const time = percent * duration;
    playerRef.current.seekTo(time, true);
    setCurrentTime(time);
  }, [duration]);

  const toggleMute = useCallback(() => {
    if (!playerRef.current) return;
    if (isMuted) {
      playerRef.current.unMute();
      playerRef.current.setVolume(volume);
    } else {
      playerRef.current.mute();
    }
    setIsMuted(!isMuted);
  }, [isMuted, volume]);

  const handleVolumeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (!playerRef.current) return;
    const newVolume = parseInt(e.target.value);
    setVolume(newVolume);
    playerRef.current.setVolume(newVolume);
    if (newVolume === 0) {
      setIsMuted(true);
    } else if (isMuted) {
      playerRef.current.unMute();
      setIsMuted(false);
    }
  }, [isMuted]);

  const toggleFullscreen = useCallback(() => {
    if (!containerRef.current) return;
    
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(err => {
        console.log('Fullscreen error:', err);
      });
    } else {
      document.exitFullscreen();
    }
  }, []);

  // Handle double tap for pseudo-fullscreen on iPhone
  const handleDoubleTap = useCallback(() => {
    const now = Date.now();
    const DOUBLE_TAP_DELAY = 300;
    
    if (now - lastTapRef.current < DOUBLE_TAP_DELAY) {
      // Double tap detected
      if (isIPhone) {
        setIsPseudoFullscreen(prev => !prev);
      } else {
        toggleFullscreen();
      }
    }
    lastTapRef.current = now;
  }, [isIPhone, toggleFullscreen]);

  const copyLink = useCallback(() => {
    const link = `${window.location.origin}/access/${cardId}`;
    navigator.clipboard.writeText(link).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(err => {
      console.error('Failed to copy:', err);
    });
  }, [cardId]);

  const handleResume = useCallback(() => {
    if (playerRef.current && savedProgressRef.current) {
      playerRef.current.seekTo(savedProgressRef.current.progress_seconds, true);
      setCurrentTime(savedProgressRef.current.progress_seconds);
      hasResumedRef.current = true;
    }
    setShowResumePrompt(false);
  }, []);

  const handleStartOver = useCallback(() => {
    hasResumedRef.current = true;
    setShowResumePrompt(false);
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-[#ff8240] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-white">Loading video...</p>
        </div>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900 px-4">
        <div className="max-w-md w-full bg-gray-800 rounded-2xl p-8 text-center">
          <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-white mb-2">Access Denied</h2>
          <p className="text-red-400 mb-6 whitespace-pre-line">{error}</p>
          <div className="flex gap-3 justify-center">
            <button 
              onClick={() => router.push('/')} 
              className="px-6 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600"
            >
              Go Home
            </button>
            <button 
              onClick={() => window.location.reload()} 
              className="px-6 py-2 bg-[#ff8240] text-white rounded-lg hover:bg-[#e06620]"
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!videoData) return null;
  const youtubeId = extractYouTubeId(videoData.videoUrl);
  if (!youtubeId) return <div className="min-h-screen bg-gray-900 flex items-center justify-center text-white">Invalid video</div>;

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;
  const isFullscreenMode = isFullscreen || isPseudoFullscreen;

  return (
    <div className={`min-h-screen bg-gray-900 flex flex-col select-none ${isFullscreenMode ? 'fullscreen-mode' : ''}`}>
      {/* Header - hidden in fullscreen */}
      {!isFullscreenMode && (
        <header className="bg-gray-800/90 backdrop-blur border-b border-gray-700 px-4 py-3 z-20">
          <div className="max-w-6xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-[#ff8240] rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              </div>
              <span className="font-semibold text-white">Rassana CardVideo</span>
            </div>
            <button onClick={() => router.push('/')} className="text-sm text-gray-400 hover:text-white">← Back</button>
          </div>
        </header>
      )}

      {/* Video */}
      <main className={`flex-1 flex items-center justify-center ${isFullscreenMode ? 'p-0' : 'p-4'}`}>
        <div className={`w-full ${isFullscreenMode ? 'max-w-none h-full' : 'max-w-5xl'}`}>
          {videoData.title && !isFullscreenMode && <h1 className="text-xl font-bold text-white mb-4 text-center">{videoData.title}</h1>}
          
          <div 
            ref={containerRef}
            className={`relative bg-black overflow-hidden ${isFullscreenMode ? 'w-full h-full rounded-none' : 'rounded-xl'}`}
            style={isFullscreenMode ? { height: '100vh' } : { paddingBottom: '56.25%' }}
            onMouseMove={() => setShowControls(true)}
            onTouchStart={handleDoubleTap}
          >
            {/* YouTube Player (hidden controls) */}
            <div id="youtube-player" className="absolute inset-0 w-full h-full pointer-events-none" />
            
            {/* Moving Watermark */}
            {videoData.phone && (
              <div className="absolute inset-0 z-40 pointer-events-none select-none overflow-hidden">
                <div 
                  className="absolute text-white/25 text-[11px] font-medium tracking-wide animate-[moveWatermark_20s_linear_infinite]"
                >
                  {videoData.phone}
                </div>
              </div>
            )}
            
            {/* Clickable overlay for showing controls */}
            <div 
              className="absolute inset-0 z-10"
              onClick={() => setShowControls(true)}
            />
            
            {/* Center Controls - Skip Back, Play/Pause, Skip Forward */}
            <div 
              className={`absolute inset-0 flex items-center justify-center z-20 transition-opacity duration-300 pointer-events-none ${showControls || !isPlaying ? 'opacity-100' : 'opacity-0'}`}
            >
              <div className="flex items-center gap-4 sm:gap-8 pointer-events-auto">
                {/* Skip Backward 10s */}
                <button 
                  onClick={(e) => { e.stopPropagation(); skipBackward(); }}
                  disabled={!playerReady}
                  className={`w-12 h-12 sm:w-14 sm:h-14 rounded-full flex items-center justify-center text-white transition-all ${
                    playerReady
                      ? 'bg-black/60 hover:bg-black/80 hover:scale-105 active:scale-90 cursor-pointer'
                      : 'bg-black/30 cursor-not-allowed opacity-50'
                  }`}
                  title={playerReady ? "Reculer 10s" : "Loading..."}
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
                  className={`w-14 h-14 sm:w-16 sm:h-16 rounded-full flex items-center justify-center text-white shadow-lg transition-all ${
                    playerReady 
                      ? 'bg-[#ff8240] hover:bg-[#00f99d] shadow-[#ff8240]/40 hover:scale-105 active:scale-90 cursor-pointer' 
                      : 'bg-gray-600 cursor-not-allowed opacity-50'
                  }`}
                  title={playerReady ? (isPlaying ? 'Pause' : 'Play') : 'Loading...'}
                >
                  {!playerReady ? (
                    <svg className="w-6 h-6 sm:w-7 sm:h-7 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
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

                {/* Skip Forward 10s */}
                <button 
                  onClick={(e) => { e.stopPropagation(); skipForward(); }}
                  disabled={!playerReady}
                  className={`w-12 h-12 sm:w-14 sm:h-14 rounded-full flex items-center justify-center text-white transition-all ${
                    playerReady
                      ? 'bg-black/60 hover:bg-black/80 hover:scale-105 active:scale-90 cursor-pointer'
                      : 'bg-black/30 cursor-not-allowed opacity-50'
                  }`}
                  title={playerReady ? "Avancer 10s" : "Loading..."}
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

            {/* Resume Prompt */}
            {showResumePrompt && savedProgressRef.current && (
              <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/70 backdrop-blur-sm">
                <div className="bg-gray-800/95 rounded-2xl p-6 mx-4 max-w-sm w-full shadow-2xl border border-white/10">
                  <div className="text-center">
                    <div className="w-14 h-14 mx-auto mb-4 bg-[#ff8240]/20 rounded-full flex items-center justify-center">
                      <svg className="w-7 h-7 text-[#ff8240]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <h3 className="text-white font-semibold text-lg mb-2">Continue Watching?</h3>
                    <p className="text-gray-400 text-sm mb-5">
                      Resume from {formatTime(savedProgressRef.current.progress_seconds)}
                    </p>
                    <div className="flex gap-3">
                      <button
                        onClick={handleStartOver}
                        className="flex-1 px-4 py-2.5 bg-gray-700 hover:bg-gray-600 text-white rounded-xl text-sm font-medium transition-colors"
                      >
                        Start Over
                      </button>
                      <button
                        onClick={handleResume}
                        className="flex-1 px-4 py-2.5 bg-gradient-to-r from-[#ff8240] to-[#00f99d] hover:opacity-90 text-white rounded-xl text-sm font-medium transition-opacity"
                      >
                        Resume
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Bottom Controls */}
            <div className={`absolute bottom-0 left-0 right-0 z-30 transition-opacity duration-300 pointer-events-none ${showControls ? 'opacity-100' : 'opacity-0'}`}>
              <div className="bg-gradient-to-t from-black/80 to-transparent pt-6 pb-2 px-3 pointer-events-auto">
                {/* Progress bar */}
                <div 
                  ref={progressRef}
                  className="h-1 bg-gray-600 rounded-full mb-2 cursor-pointer group"
                  onClick={(e) => { e.stopPropagation(); handleSeek(e); }}
                >
                  <div className="h-full bg-[#ff8240] rounded-full relative" style={{ width: `${progress}%` }}>
                    <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-[#00f99d] rounded-full opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </div>
                
                {/* Controls row */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {/* Volume - hidden on mobile */}
                    <div className="hidden sm:flex items-center gap-2 group">
                      <button onClick={(e) => { e.stopPropagation(); toggleMute(); }} className="text-white hover:text-[#00f99d] p-0.5">
                        {isMuted || volume === 0 ? (
                          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/></svg>
                        ) : (
                          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>
                        )}
                      </button>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={isMuted ? 0 : volume}
                        onChange={handleVolumeChange}
                        onClick={(e) => e.stopPropagation()}
                        className="w-0 group-hover:w-16 transition-all duration-200 accent-[#ff8240]"
                      />
                    </div>
                    
                    {/* Time */}
                    <span className="text-white text-xs ml-1">{formatTime(currentTime)} / {formatTime(duration)}</span>
                  </div>

                  {/* Right side controls */}
                  <div className="flex items-center gap-1">
                    {/* Fullscreen - hidden on iPhone (not supported) */}
                    {!isIPhone && (
                      <button onClick={(e) => { e.stopPropagation(); toggleFullscreen(); }} className="text-white hover:text-[#00f99d] p-0.5" title="Plein écran">
                        {isFullscreen ? (
                          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z"/>
                          </svg>
                        ) : (
                          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/>
                          </svg>
                        )}
                      </button>
                    )}
                    {/* Exit pseudo-fullscreen button for iPhone */}
                    {isIPhone && isPseudoFullscreen && (
                      <button 
                        onClick={(e) => { e.stopPropagation(); setIsPseudoFullscreen(false); }} 
                        className="text-white hover:text-[#00f99d] p-0.5" 
                        title="Exit fullscreen"
                      >
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z"/>
                        </svg>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {!isFullscreenMode && (
            <div className="mt-4 text-center">
              <span className="px-3 py-1 bg-gray-800 text-gray-500 text-sm rounded-full">Card: {cardId}</span>
            </div>
          )}
          
          {/* Double tap hint for iPhone */}
          {isIPhone && !isPseudoFullscreen && (
            <p className="text-center text-gray-500 text-xs mt-2">Double tap video for fullscreen</p>
          )}
        </div>
      </main>

      {/* Footer - hidden in fullscreen */}
      {!isFullscreenMode && (
        <footer className="bg-gray-800 border-t border-gray-700 px-4 py-2">
          <p className="text-center text-gray-500 text-xs">Protected content</p>
        </footer>
      )}

      <style jsx global>{`
        .fullscreen-mode {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          z-index: 9999;
        }
      `}</style>
    </div>
  );
}

export default function VideoAccessPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-[#ff8240] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-white">Loading video...</p>
        </div>
      </div>
    }>
      <VideoAccessContent />
    </Suspense>
  );
}
