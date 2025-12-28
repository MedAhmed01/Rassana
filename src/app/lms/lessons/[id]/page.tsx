'use client';

import { useState, useEffect, useRef, use, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface Lesson {
  id: string;
  title: string;
  description?: string;
  youtube_url: string;
  duration_seconds?: number;
  chapter: {
    id: string;
    name: string;
    topic_id: string;
    topic: {
      id: string;
      name: string;
    };
  };
  progress?: {
    watched_seconds: number;
    total_seconds: number;
    last_position_seconds: number;
    max_percentage_watched: number;
  };
}

interface StudentInfo {
  username: string;
  student_id: string;
}

declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: () => void;
  }
}

function extractVideoId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/)([\w-]+)/,
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match && match[1]) return match[1];
  }
  return null;
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}


export default function LessonPlayerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: lessonId } = use(params);
  const router = useRouter();
  
  // Data state
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [studentInfo, setStudentInfo] = useState<StudentInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [locked, setLocked] = useState(false);
  const [expired, setExpired] = useState(false);
  
  // Player refs
  const playerRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const lastSaveRef = useRef<number>(0);
  const lastTapRef = useRef<number>(0);
  
  // Player state
  const [playerReady, setPlayerReady] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(100);
  const [isMuted, setIsMuted] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isPseudoFullscreen, setIsPseudoFullscreen] = useState(false);
  const [isIPhone, setIsIPhone] = useState(false);
  
  // Watermark position
  const [watermarkPosition, setWatermarkPosition] = useState({ x: 10, y: 10 });

  // Detect iPhone
  useEffect(() => {
    const userAgent = navigator.userAgent || navigator.vendor;
    const isIPhoneDevice = /iPhone/i.test(userAgent) && !/iPad/i.test(userAgent);
    setIsIPhone(isIPhoneDevice);
  }, []);

  // Load lesson and student info
  useEffect(() => {
    loadLesson();
    loadStudentInfo();
    
    // Disable right-click
    const handleContextMenu = (e: MouseEvent) => e.preventDefault();
    document.addEventListener('contextmenu', handleContextMenu);
    
    // Disable keyboard shortcuts for saving
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'S' || e.key === 'u' || e.key === 'U')) {
        e.preventDefault();
      }
      if ((e.ctrlKey && e.shiftKey && e.key === 'i') || e.key === 'F12') {
        e.preventDefault();
      }
      // Player keyboard shortcuts
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
    document.addEventListener('keydown', handleKeyDown);
    
    return () => {
      document.removeEventListener('contextmenu', handleContextMenu);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [lessonId, playerReady]);


  // Move watermark periodically
  useEffect(() => {
    const moveWatermark = () => {
      setWatermarkPosition({
        x: Math.random() * 60 + 10,
        y: Math.random() * 60 + 10,
      });
    };
    const interval = setInterval(moveWatermark, 15000);
    return () => clearInterval(interval);
  }, []);

  async function loadLesson() {
    try {
      const response = await fetch(`/api/lms/lessons/${lessonId}`);
      if (response.status === 401) {
        router.push('/lms/login');
        return;
      }
      if (response.status === 403) {
        const data = await response.json();
        if (data.locked) setLocked(true);
        else if (data.expired) setExpired(true);
        setError(data.error);
        return;
      }
      if (response.ok) {
        const data = await response.json();
        setLesson(data.lesson);
        if (data.lesson.progress?.last_position_seconds) {
          setCurrentTime(data.lesson.progress.last_position_seconds);
        }
        if (data.lesson.duration_seconds) {
          setDuration(data.lesson.duration_seconds);
        }
      } else {
        setError('Failed to load lesson');
      }
    } catch (err) {
      setError('Failed to load lesson');
    } finally {
      setLoading(false);
    }
  }

  async function loadStudentInfo() {
    try {
      const response = await fetch('/api/lms/session');
      if (response.ok) {
        const data = await response.json();
        setStudentInfo({
          username: data.student?.username || 'Student',
          student_id: data.student?.id?.substring(0, 8) || 'N/A',
        });
      }
    } catch (err) {
      console.error('Failed to load student info');
    }
  }


  // Save progress to server
  const saveProgress = useCallback(async (time: number, dur: number) => {
    if (!lesson || dur <= 0) return;
    
    const now = Date.now();
    if (now - lastSaveRef.current < 5000) return;
    lastSaveRef.current = now;
    
    try {
      await fetch('/api/lms/progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lesson_id: lesson.id,
          watched_seconds: Math.floor(time),
          total_seconds: Math.floor(dur),
          last_position_seconds: Math.floor(time),
        }),
      });
    } catch (err) {
      console.error('Failed to save progress');
    }
  }, [lesson]);

  // Initialize YouTube Player
  useEffect(() => {
    if (!lesson) return;
    
    const videoId = extractVideoId(lesson.youtube_url);
    if (!videoId) return;

    if (!window.YT) {
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      const firstScriptTag = document.getElementsByTagName('script')[0];
      firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);
    }

    window.onYouTubeIframeAPIReady = () => {
      playerRef.current = new window.YT.Player('youtube-player', {
        videoId: videoId,
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
            setPlayerReady(true);
            setDuration(event.target.getDuration());
            setVolume(event.target.getVolume());
            
            // Resume from saved position
            if (lesson.progress?.last_position_seconds && lesson.progress.last_position_seconds > 10) {
              event.target.seekTo(lesson.progress.last_position_seconds, true);
              setCurrentTime(lesson.progress.last_position_seconds);
            }
            
            event.target.playVideo();
            setIsPlaying(true);
          },
          onStateChange: (event: any) => {
            const playing = event.data === window.YT.PlayerState.PLAYING;
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
  }, [lesson]);


  // Update time and save progress
  useEffect(() => {
    if (!playerReady) return;
    
    const interval = setInterval(() => {
      if (playerRef.current && typeof playerRef.current.getCurrentTime === 'function') {
        const time = playerRef.current.getCurrentTime();
        const dur = playerRef.current.getDuration();
        setCurrentTime(time);
        if (isPlaying && dur > 0) {
          saveProgress(time, dur);
        }
      }
    }, 500);
    
    return () => clearInterval(interval);
  }, [playerReady, isPlaying, saveProgress]);

  // Save progress when leaving
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (playerRef.current && lesson && duration > 0) {
        const time = playerRef.current.getCurrentTime();
        navigator.sendBeacon('/api/lms/progress', JSON.stringify({
          lesson_id: lesson.id,
          watched_seconds: Math.floor(time),
          total_seconds: Math.floor(duration),
          last_position_seconds: Math.floor(time),
        }));
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [lesson, duration]);

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


  // Player controls
  const togglePlay = useCallback(() => {
    if (!playerRef.current || !playerReady) return;
    try {
      const playerState = playerRef.current.getPlayerState();
      if (playerState === 1) {
        playerRef.current.pauseVideo();
        setIsPlaying(false);
      } else {
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
    if (newVolume === 0) setIsMuted(true);
    else if (isMuted) {
      playerRef.current.unMute();
      setIsMuted(false);
    }
  }, [isMuted]);

  const toggleFullscreen = useCallback(() => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(err => console.log('Fullscreen error:', err));
    } else {
      document.exitFullscreen();
    }
  }, []);

  const handleDoubleTap = useCallback(() => {
    const now = Date.now();
    if (now - lastTapRef.current < 300) {
      if (isIPhone) setIsPseudoFullscreen(prev => !prev);
      else toggleFullscreen();
    }
    lastTapRef.current = now;
  }, [isIPhone, toggleFullscreen]);


  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-[#ff8240] border-t-transparent rounded-full animate-spin"></div>
          <p className="text-white/70">Loading lesson...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="max-w-md w-full mx-4">
          <div className={`p-6 rounded-2xl ${locked ? 'bg-amber-900/50 border border-amber-700' : 'bg-red-900/50 border border-red-700'}`}>
            <div className="flex items-center gap-3 mb-4">
              <div className={`w-12 h-12 rounded-full flex items-center justify-center ${locked ? 'bg-amber-500/20' : 'bg-red-500/20'}`}>
                <svg className={`w-6 h-6 ${locked ? 'text-amber-400' : 'text-red-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  {locked ? (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  )}
                </svg>
              </div>
              <div>
                <h2 className={`text-lg font-semibold ${locked ? 'text-amber-200' : 'text-red-200'}`}>
                  {locked ? 'Lesson Locked' : expired ? 'Subscription Expired' : 'Error'}
                </h2>
                <p className={`text-sm ${locked ? 'text-amber-300/70' : 'text-red-300/70'}`}>{error}</p>
              </div>
            </div>
            <Link href="/lms" className="block w-full py-3 text-center bg-white/10 hover:bg-white/20 text-white rounded-xl transition-colors">
              Back to Courses
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (!lesson) return null;

  const videoId = extractVideoId(lesson.youtube_url);
  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;
  const isFullscreenMode = isFullscreen || isPseudoFullscreen;


  return (
    <div className={`min-h-screen bg-slate-900 flex flex-col select-none ${isFullscreenMode ? 'fullscreen-mode' : ''}`}>
      {/* Header - hidden in fullscreen */}
      {!isFullscreenMode && (
        <header className="bg-slate-800 border-b border-slate-700">
          <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
            <Link href={`/lms/topics/${lesson.chapter.topic_id}`} className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back to Course
            </Link>
            <div className="text-right">
              <p className="text-sm text-white font-medium">{lesson.title}</p>
              <p className="text-xs text-slate-400">{lesson.chapter.topic.name}</p>
            </div>
          </div>
        </header>
      )}

      {/* Video Player */}
      <main className={`flex-1 flex items-center justify-center ${isFullscreenMode ? 'p-0' : 'p-4'}`}>
        <div className={`w-full ${isFullscreenMode ? 'max-w-none h-full' : 'max-w-5xl'}`}>
          {!isFullscreenMode && <h1 className="text-xl font-bold text-white mb-4 text-center">{lesson.title}</h1>}
          
          <div 
            ref={containerRef}
            className={`relative bg-black overflow-hidden ${isFullscreenMode ? 'w-full h-full rounded-none' : 'rounded-xl'}`}
            style={isFullscreenMode ? { height: '100vh' } : { paddingBottom: '56.25%' }}
            onMouseMove={() => setShowControls(true)}
            onTouchStart={handleDoubleTap}
          >
            {/* YouTube Player */}
            {videoId ? (
              <div id="youtube-player" className="absolute inset-0 w-full h-full pointer-events-none" />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center bg-slate-800">
                <p className="text-slate-400">Invalid video URL</p>
              </div>
            )}


            {/* Moving Watermark */}
            {studentInfo && (
              <div 
                className="absolute z-40 pointer-events-none select-none transition-all duration-1000 ease-in-out"
                style={{ left: `${watermarkPosition.x}%`, top: `${watermarkPosition.y}%`, transform: 'translate(-50%, -50%)' }}
              >
                <div className="text-white/30 text-sm font-medium">
                  <p>{studentInfo.username}</p>
                  <p className="text-xs">ID: {studentInfo.student_id}</p>
                </div>
              </div>
            )}
            
            {/* Clickable overlay */}
            <div className="absolute inset-0 z-10" onClick={() => setShowControls(true)} />
            
            {/* Center Controls */}
            <div className={`absolute inset-0 flex items-center justify-center z-20 transition-opacity duration-300 pointer-events-none ${showControls || !isPlaying ? 'opacity-100' : 'opacity-0'}`}>
              <div className="flex items-center gap-4 sm:gap-8 pointer-events-auto">
                {/* Skip Backward */}
                <button 
                  onClick={(e) => { e.stopPropagation(); skipBackward(); }}
                  disabled={!playerReady}
                  className={`w-12 h-12 sm:w-14 sm:h-14 rounded-full flex items-center justify-center text-white transition-all ${playerReady ? 'bg-black/60 hover:bg-black/80 hover:scale-105 active:scale-90' : 'bg-black/30 opacity-50'}`}
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
                  className={`w-14 h-14 sm:w-16 sm:h-16 rounded-full flex items-center justify-center text-white shadow-lg transition-all ${playerReady ? 'bg-[#ff8240] hover:bg-[#00f99d] shadow-[#ff8240]/40 hover:scale-105 active:scale-90' : 'bg-gray-600 opacity-50'}`}
                >
                  {!playerReady ? (
                    <svg className="w-6 h-6 sm:w-7 sm:h-7 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  ) : isPlaying ? (
                    <svg className="w-6 h-6 sm:w-7 sm:h-7" fill="currentColor" viewBox="0 0 24 24"><path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z"/></svg>
                  ) : (
                    <svg className="w-6 h-6 sm:w-7 sm:h-7 ml-0.5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                  )}
                </button>

                {/* Skip Forward */}
                <button 
                  onClick={(e) => { e.stopPropagation(); skipForward(); }}
                  disabled={!playerReady}
                  className={`w-12 h-12 sm:w-14 sm:h-14 rounded-full flex items-center justify-center text-white transition-all ${playerReady ? 'bg-black/60 hover:bg-black/80 hover:scale-105 active:scale-90' : 'bg-black/30 opacity-50'}`}
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


            {/* Bottom Controls */}
            <div className={`absolute bottom-0 left-0 right-0 z-30 transition-opacity duration-300 pointer-events-none ${showControls ? 'opacity-100' : 'opacity-0'}`}>
              <div className="bg-gradient-to-t from-black/80 to-transparent pt-6 pb-2 px-3 pointer-events-auto">
                {/* Progress bar */}
                <div ref={progressRef} className="h-1 bg-gray-600 rounded-full mb-2 cursor-pointer group" onClick={(e) => { e.stopPropagation(); handleSeek(e); }}>
                  <div className="h-full bg-[#ff8240] rounded-full relative" style={{ width: `${progress}%` }}>
                    <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-[#00f99d] rounded-full opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </div>
                
                {/* Controls row */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {/* Volume */}
                    <div className="hidden sm:flex items-center gap-2 group">
                      <button onClick={(e) => { e.stopPropagation(); toggleMute(); }} className="text-white hover:text-[#00f99d] p-0.5">
                        {isMuted || volume === 0 ? (
                          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/></svg>
                        ) : (
                          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>
                        )}
                      </button>
                      <input type="range" min="0" max="100" value={isMuted ? 0 : volume} onChange={handleVolumeChange} className="w-16 h-1 bg-gray-600 rounded-full appearance-none cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:rounded-full" />
                    </div>
                    <span className="text-white text-xs">{formatTime(currentTime)} / {formatTime(duration)}</span>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    {/* Fullscreen */}
                    <button onClick={(e) => { e.stopPropagation(); isIPhone ? setIsPseudoFullscreen(!isPseudoFullscreen) : toggleFullscreen(); }} className="text-white hover:text-[#00f99d] p-1">
                      {isFullscreenMode ? (
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z"/></svg>
                      ) : (
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/></svg>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>


      {/* Lesson Info - hidden in fullscreen */}
      {!isFullscreenMode && (
        <div className="max-w-5xl mx-auto px-4 pb-6 space-y-4">
          {/* Lesson Info */}
          <div className="bg-slate-800 rounded-2xl p-6">
            <h2 className="text-xl font-bold text-white mb-2">{lesson.title}</h2>
            <p className="text-slate-400 text-sm mb-4">{lesson.chapter.name} • {lesson.chapter.topic.name}</p>
            {lesson.description && <p className="text-slate-300">{lesson.description}</p>}
          </div>

          {/* Progress Info */}
          {lesson.progress && (
            <div className="bg-slate-800 rounded-2xl p-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-400">Your Progress</span>
                <span className="text-white font-medium">{Math.round(lesson.progress.max_percentage_watched)}% completed</span>
              </div>
              <div className="mt-2 h-2 bg-slate-700 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-[#ff8240] to-[#00f99d] rounded-full" style={{ width: `${lesson.progress.max_percentage_watched}%` }} />
              </div>
            </div>
          )}

          {/* Instructions */}
          <div className="bg-slate-800/50 rounded-2xl p-4 border border-slate-700">
            <div className="flex items-start gap-3">
              <svg className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-slate-300 text-sm">After watching this lesson, take notes and send them to your instructor to unlock the next lesson.</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}