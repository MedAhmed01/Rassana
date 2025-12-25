'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';

interface VideoData {
  videoUrl: string;
  title?: string;
}

// Extract YouTube video ID from various URL formats
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

export default function VideoAccessPage() {
  const params = useParams();
  const router = useRouter();
  const cardId = params.cardId as string;
  
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [videoData, setVideoData] = useState<VideoData | null>(null);
  
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
          setVideoData({
            videoUrl: data.videoUrl,
            title: data.title,
          });
          setLoading(false);
        } else {
          setError('Video URL not found');
          setLoading(false);
        }
      } catch (err) {
        setError('An error occurred. Please try again.');
        setLoading(false);
      }
    }
    
    handleAccess();
  }, [cardId, router]);

  // Prevent right-click context menu
  useEffect(() => {
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };
    
    document.addEventListener('contextmenu', handleContextMenu);
    return () => document.removeEventListener('contextmenu', handleContextMenu);
  }, []);

  // Prevent keyboard shortcuts for copying/saving
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Prevent Ctrl+S, Ctrl+U, Ctrl+Shift+I, F12
      if (
        (e.ctrlKey && (e.key === 's' || e.key === 'u')) ||
        (e.ctrlKey && e.shiftKey && e.key === 'i') ||
        e.key === 'F12'
      ) {
        e.preventDefault();
      }
    };
    
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);
  
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="text-center px-4">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-blue-600 rounded-2xl mb-6 shadow-lg shadow-blue-600/30">
            <svg className="w-10 h-10 text-white animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-white mb-2">Loading your video</h2>
          <p className="text-gray-400">Please wait...</p>
          <div className="mt-6 flex justify-center gap-1">
            <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
            <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
            <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
          </div>
        </div>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900 px-4">
        <div className="max-w-md w-full">
          <div className="bg-gray-800 rounded-2xl shadow-xl border border-gray-700 p-8 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-red-900/50 rounded-2xl mb-6">
              <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            
            <h2 className="text-xl font-bold text-white mb-2">Unable to load video</h2>
            <p className="text-gray-400 mb-8">{error}</p>
            
            <div className="space-y-3">
              <button
                onClick={() => window.location.reload()}
                className="w-full py-3 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700"
              >
                Try again
              </button>
              <button
                onClick={() => router.push('/')}
                className="w-full py-3 bg-gray-700 text-gray-300 font-semibold rounded-xl hover:bg-gray-600"
              >
                Go home
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!videoData) return null;

  const youtubeId = extractYouTubeId(videoData.videoUrl);
  
  // YouTube embed URL with privacy-enhanced mode and restricted controls
  const embedUrl = youtubeId 
    ? `https://www.youtube-nocookie.com/embed/${youtubeId}?rel=0&modestbranding=1&showinfo=0&controls=1&disablekb=0&fs=1&iv_load_policy=3&playsinline=1`
    : null;

  return (
    <div 
      className="min-h-screen bg-gray-900 flex flex-col select-none"
      onCopy={(e) => e.preventDefault()}
      onCut={(e) => e.preventDefault()}
    >
      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700 px-4 py-3">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            </div>
            <span className="font-semibold text-white">CardVideo</span>
          </div>
          <button
            onClick={() => router.push('/')}
            className="text-sm text-gray-400 hover:text-white"
          >
            ← Back to home
          </button>
        </div>
      </header>

      {/* Video Container */}
      <main className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-5xl">
          {videoData.title && (
            <h1 className="text-xl font-bold text-white mb-4 text-center">{videoData.title}</h1>
          )}
          
          {embedUrl ? (
            <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
              <iframe
                className="absolute inset-0 w-full h-full rounded-xl"
                src={embedUrl}
                title="Video player"
                frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                referrerPolicy="strict-origin-when-cross-origin"
              />
              {/* Overlay to prevent right-click on iframe */}
              <div 
                className="absolute inset-0 pointer-events-none"
                style={{ pointerEvents: 'none' }}
              />
            </div>
          ) : (
            <div className="bg-gray-800 rounded-xl p-8 text-center">
              <p className="text-gray-400">Video format not supported for embedded playback.</p>
            </div>
          )}

          {/* Card info */}
          <div className="mt-6 text-center">
            <span className="inline-flex px-3 py-1 bg-gray-800 text-gray-400 text-sm rounded-full">
              Card: {cardId}
            </span>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-gray-800 border-t border-gray-700 px-4 py-3">
        <p className="text-center text-gray-500 text-sm">
          This content is protected and for authorized viewing only.
        </p>
      </footer>

      {/* CSS to disable text selection and dragging */}
      <style jsx global>{`
        .select-none {
          -webkit-user-select: none;
          -moz-user-select: none;
          -ms-user-select: none;
          user-select: none;
        }
        
        img, video, iframe {
          -webkit-user-drag: none;
          -khtml-user-drag: none;
          -moz-user-drag: none;
          -o-user-drag: none;
          user-drag: none;
        }
      `}</style>
    </div>
  );
}
