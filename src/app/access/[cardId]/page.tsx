'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';

interface VideoData {
  videoUrl: string;
  title?: string;
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

export default function VideoAccessPage() {
  const params = useParams();
  const router = useRouter();
  const cardId = params.cardId as string;
  
  const playerRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  
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
        
        if (!response.ok) {
          setError(data.error || 'Failed to access video');
          setLoading(false);
          return;
        }
        
        if (data.videoUrl) {
          setVideoData({ videoUrl: data.videoUrl, title: data.title });
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
            setPlayerReady(true);
            setDuration(event.target.getDuration());
            setVolume(event.target.getVolume());
          },
          onStateChange: (event: any) => {
            setIsPlaying(event.data === window.YT.PlayerState.PLAYING);
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

  // Update time
  useEffect(() => {
    if (!playerReady) return;
    
    const interval = setInterval(() => {
      if (playerRef.current && typeof playerRef.current.getCurrentTime === 'function') {
        setCurrentTime(playerRef.current.getCurrentTime());
      }
    }, 500);
    
    return () => clearInterval(interval);
  }, [playerReady]);

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
    if (!playerRef.current) return;
    if (isPlaying) {
      playerRef.current.pauseVideo();
    } else {
      playerRef.current.playVideo();
    }
  }, [isPlaying]);

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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-white">Loading video...</p>
        </div>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900 px-4">
        <div className="max-w-md w-full bg-gray-800 rounded-2xl p-8 text-center">
          <p className="text-red-400 mb-4">{error}</p>
          <button onClick={() => window.location.reload()} className="px-6 py-2 bg-blue-600 text-white rounded-lg">
            Try again
          </button>
        </div>
      </div>
    );
  }

  if (!videoData) return null;
  const youtubeId = extractYouTubeId(videoData.videoUrl);
  if (!youtubeId) return <div className="min-h-screen bg-gray-900 flex items-center justify-center text-white">Invalid video</div>;

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className={`min-h-screen bg-gray-900 flex flex-col select-none ${isFullscreen ? 'fullscreen-mode' : ''}`}>
      {/* Header - hidden in fullscreen */}
      {!isFullscreen && (
        <header className="bg-gray-800/90 backdrop-blur border-b border-gray-700 px-4 py-3 z-20">
          <div className="max-w-6xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              </div>
              <span className="font-semibold text-white">CardVideo</span>
            </div>
            <button onClick={() => router.push('/')} className="text-sm text-gray-400 hover:text-white">← Back</button>
          </div>
        </header>
      )}

      {/* Video */}
      <main className={`flex-1 flex items-center justify-center ${isFullscreen ? 'p-0' : 'p-4'}`}>
        <div className={`w-full ${isFullscreen ? 'max-w-none h-full' : 'max-w-5xl'}`}>
          {videoData.title && !isFullscreen && <h1 className="text-xl font-bold text-white mb-4 text-center">{videoData.title}</h1>}
          
          <div 
            ref={containerRef}
            className={`relative bg-black overflow-hidden ${isFullscreen ? 'w-full h-full rounded-none' : 'rounded-xl'}`}
            style={isFullscreen ? { height: '100vh' } : { paddingBottom: '56.25%' }}
            onMouseMove={() => setShowControls(true)}
            onDoubleClick={toggleFullscreen}
          >
            {/* YouTube Player (hidden controls) */}
            <div id="youtube-player" className="absolute inset-0 w-full h-full pointer-events-none" />
            
            {/* Overlay to block all YouTube UI */}
            <div className="absolute inset-0 z-10" />
            
            {/* Center Controls - Skip Back, Play/Pause, Skip Forward */}
            <div className={`absolute inset-0 flex items-center justify-center z-20 transition-opacity duration-300 ${showControls || !isPlaying ? 'opacity-100' : 'opacity-0'}`}>
              <div className="flex items-center gap-6 sm:gap-10">
                {/* Skip Backward 10s */}
                <button 
                  onClick={(e) => { e.stopPropagation(); skipBackward(); }}
                  className="w-12 h-12 sm:w-16 sm:h-16 bg-black/50 hover:bg-black/70 rounded-full flex items-center justify-center text-white transition-all hover:scale-110"
                  title="Reculer 10s"
                >
                  <div className="relative">
                    <svg className="w-8 h-8 sm:w-10 sm:h-10" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z"/>
                    </svg>
                    <span className="absolute inset-0 flex items-center justify-center text-[10px] sm:text-xs font-bold mt-0.5">10</span>
                  </div>
                </button>

                {/* Play/Pause */}
                <button 
                  onClick={(e) => { e.stopPropagation(); togglePlay(); }}
                  className="w-16 h-16 sm:w-20 sm:h-20 bg-blue-600 hover:bg-blue-700 rounded-full flex items-center justify-center text-white shadow-lg shadow-blue-600/30 transition-all hover:scale-110"
                >
                  {isPlaying ? (
                    <svg className="w-8 h-8 sm:w-10 sm:h-10" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z"/>
                    </svg>
                  ) : (
                    <svg className="w-8 h-8 sm:w-10 sm:h-10 ml-1" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M8 5v14l11-7z"/>
                    </svg>
                  )}
                </button>

                {/* Skip Forward 10s */}
                <button 
                  onClick={(e) => { e.stopPropagation(); skipForward(); }}
                  className="w-12 h-12 sm:w-16 sm:h-16 bg-black/50 hover:bg-black/70 rounded-full flex items-center justify-center text-white transition-all hover:scale-110"
                  title="Avancer 10s"
                >
                  <div className="relative">
                    <svg className="w-8 h-8 sm:w-10 sm:h-10" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 5V1l5 5-5 5V7c-3.31 0-6 2.69-6 6s2.69 6 6 6 6-2.69 6-6h2c0 4.42-3.58 8-8 8s-8-3.58-8-8 3.58-8 8-8z"/>
                    </svg>
                    <span className="absolute inset-0 flex items-center justify-center text-[10px] sm:text-xs font-bold mt-0.5">10</span>
                  </div>
                </button>
              </div>
            </div>

            {/* Bottom Controls */}
            <div className={`absolute bottom-0 left-0 right-0 z-30 transition-opacity duration-300 ${showControls ? 'opacity-100' : 'opacity-0'}`}>
              <div className="bg-gradient-to-t from-black/90 to-transparent pt-10 pb-4 px-4">
                {/* Progress bar */}
                <div 
                  ref={progressRef}
                  className="h-1.5 bg-gray-600 rounded-full mb-4 cursor-pointer group"
                  onClick={(e) => { e.stopPropagation(); handleSeek(e); }}
                >
                  <div className="h-full bg-blue-600 rounded-full relative" style={{ width: `${progress}%` }}>
                    <div className="absolute right-0 top-1/2 -translate-y-1/2 w-4 h-4 bg-blue-500 rounded-full opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </div>
                
                {/* Controls row */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {/* Volume */}
                    <div className="flex items-center gap-2 group">
                      <button onClick={(e) => { e.stopPropagation(); toggleMute(); }} className="text-white hover:text-blue-400 p-1">
                        {isMuted || volume === 0 ? (
                          <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/></svg>
                        ) : (
                          <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>
                        )}
                      </button>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={isMuted ? 0 : volume}
                        onChange={handleVolumeChange}
                        onClick={(e) => e.stopPropagation()}
                        className="w-0 group-hover:w-20 transition-all duration-200 accent-blue-600"
                      />
                    </div>
                    
                    {/* Time */}
                    <span className="text-white text-sm ml-2">{formatTime(currentTime)} / {formatTime(duration)}</span>
                  </div>

                  {/* Right side controls */}
                  <div className="flex items-center gap-2">
                    {/* Fullscreen */}
                    <button onClick={(e) => { e.stopPropagation(); toggleFullscreen(); }} className="text-white hover:text-blue-400 p-1" title="Plein écran">
                      {isFullscreen ? (
                        <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z"/>
                        </svg>
                      ) : (
                        <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/>
                        </svg>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {!isFullscreen && (
            <div className="mt-4 text-center">
              <span className="px-3 py-1 bg-gray-800 text-gray-500 text-sm rounded-full">Card: {cardId}</span>
            </div>
          )}
        </div>
      </main>

      {/* Footer - hidden in fullscreen */}
      {!isFullscreen && (
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
