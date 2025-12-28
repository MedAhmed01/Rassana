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

export default function LessonPlayerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: lessonId } = use(params);
  const router = useRouter();
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [studentInfo, setStudentInfo] = useState<StudentInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [locked, setLocked] = useState(false);
  const [expired, setExpired] = useState(false);
  
  // Video state
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const playerRef = useRef<any>(null);
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  // Watermark position
  const [watermarkPosition, setWatermarkPosition] = useState({ x: 10, y: 10 });

  useEffect(() => {
    loadLesson();
    loadStudentInfo();
    
    // Disable right-click
    const handleContextMenu = (e: MouseEvent) => e.preventDefault();
    document.addEventListener('contextmenu', handleContextMenu);
    
    // Disable keyboard shortcuts
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'S' || e.key === 'u' || e.key === 'U')) {
        e.preventDefault();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    
    return () => {
      document.removeEventListener('contextmenu', handleContextMenu);
      document.removeEventListener('keydown', handleKeyDown);
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
      }
    };
  }, [lessonId]);

  // Move watermark periodically
  useEffect(() => {
    const moveWatermark = () => {
      setWatermarkPosition({
        x: Math.random() * 60 + 10, // 10-70%
        y: Math.random() * 60 + 10, // 10-70%
      });
    };
    
    const interval = setInterval(moveWatermark, 15000); // Move every 15 seconds
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
        if (data.locked) {
          setLocked(true);
        } else if (data.expired) {
          setExpired(true);
        }
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
      // Get student info from LMS session (via header or cookie)
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

  const saveProgress = useCallback(async (watchedSeconds: number, lastPosition: number) => {
    if (!lesson) return;
    
    try {
      await fetch('/api/lms/progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lesson_id: lesson.id,
          watched_seconds: Math.floor(watchedSeconds),
          total_seconds: duration || lesson.duration_seconds || 0,
          last_position_seconds: Math.floor(lastPosition),
        }),
      });
    } catch (err) {
      console.error('Failed to save progress');
    }
  }, [lesson, duration]);

  // Start progress tracking when playing
  useEffect(() => {
    if (isPlaying && lesson) {
      progressIntervalRef.current = setInterval(() => {
        saveProgress(currentTime, currentTime);
      }, 30000); // Save every 30 seconds
    } else {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
      }
    }
    
    return () => {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
      }
    };
  }, [isPlaying, lesson, currentTime, saveProgress]);

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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-[#ff8240] border-t-transparent rounded-full animate-spin"></div>
          <p className="text-white/70">Loading lesson...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="max-w-md w-full mx-4">
          <div className={`p-6 rounded-2xl ${locked ? 'bg-amber-900/50 border border-amber-700' : expired ? 'bg-red-900/50 border border-red-700' : 'bg-red-900/50 border border-red-700'}`}>
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
            <Link
              href="/lms"
              className="block w-full py-3 text-center bg-white/10 hover:bg-white/20 text-white rounded-xl transition-colors"
            >
              Back to Courses
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (!lesson) return null;

  const videoId = extractVideoId(lesson.youtube_url);

  return (
    <div className="min-h-screen bg-slate-900">
      {/* Header */}
      <header className="bg-slate-800 border-b border-slate-700">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link
            href={`/lms/topics/${lesson.chapter.topic_id}`}
            className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors"
          >
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

      {/* Video Player Container */}
      <main className="max-w-6xl mx-auto px-4 py-6">
        <div className="relative bg-black rounded-2xl overflow-hidden shadow-2xl">
          {/* Video Player */}
          <div className="relative aspect-video">
            {videoId ? (
              <iframe
                ref={playerRef}
                src={`https://www.youtube.com/embed/${videoId}?autoplay=0&controls=1&modestbranding=1&rel=0&showinfo=0&start=${Math.floor(currentTime)}`}
                className="w-full h-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                style={{ pointerEvents: 'auto' }}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-slate-800">
                <p className="text-slate-400">Invalid video URL</p>
              </div>
            )}

            {/* Watermark Overlay */}
            <div
              className="absolute pointer-events-none select-none transition-all duration-1000 ease-in-out"
              style={{
                left: `${watermarkPosition.x}%`,
                top: `${watermarkPosition.y}%`,
                transform: 'translate(-50%, -50%)',
              }}
            >
              <div className="bg-black/30 backdrop-blur-sm rounded-lg px-4 py-2 border border-white/10">
                <p className="text-white/60 text-sm font-medium">
                  {studentInfo?.username || 'Student'}
                </p>
                <p className="text-white/40 text-xs">
                  ID: {studentInfo?.student_id || 'N/A'}
                </p>
                <p className="text-white/40 text-xs">
                  {new Date().toLocaleString()}
                </p>
              </div>
            </div>

            {/* Protection Overlay (prevents direct video interaction for download) */}
            <div 
              className="absolute inset-0 pointer-events-none"
              style={{ background: 'transparent' }}
            />
          </div>
        </div>

        {/* Lesson Info */}
        <div className="mt-6 bg-slate-800 rounded-2xl p-6">
          <h1 className="text-2xl font-bold text-white mb-2">{lesson.title}</h1>
          <p className="text-slate-400 text-sm mb-4">
            {lesson.chapter.name} • {lesson.chapter.topic.name}
          </p>
          {lesson.description && (
            <div className="prose prose-invert max-w-none">
              <p className="text-slate-300">{lesson.description}</p>
            </div>
          )}
        </div>

        {/* Progress Info */}
        {lesson.progress && (
          <div className="mt-4 bg-slate-800 rounded-2xl p-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-400">Your Progress</span>
              <span className="text-white font-medium">
                {Math.round(lesson.progress.max_percentage_watched)}% completed
              </span>
            </div>
            <div className="mt-2 h-2 bg-slate-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-[#ff8240] to-[#00f99d] rounded-full"
                style={{ width: `${lesson.progress.max_percentage_watched}%` }}
              />
            </div>
          </div>
        )}

        {/* Instructions */}
        <div className="mt-4 bg-slate-800/50 rounded-2xl p-4 border border-slate-700">
          <div className="flex items-start gap-3">
            <svg className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <p className="text-slate-300 text-sm">
                After watching this lesson, take notes and send them to your instructor to unlock the next lesson.
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
