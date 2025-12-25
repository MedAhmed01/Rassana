'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';

interface VideoData {
  videoUrl: string;
  title?: string;
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

export default function VideoAccessPage() {
  const params = useParams();
  const router = useRouter();
  const cardId = params.cardId as string;
  const containerRef = useRef<HTMLDivElement>(null);
  
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [videoData, setVideoData] = useState<VideoData | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  
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
        setError('An error occurred. Please try again.');
        setLoading(false);
      }
    }
    handleAccess();
  }, [cardId, router]);

  useEffect(() => {
    const handleContextMenu = (e: MouseEvent) => e.preventDefault();
    document.addEventListener('contextmenu', handleContextMenu);
    return () => document.removeEventListener('contextmenu', handleContextMenu);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey && (e.key === 's' || e.key === 'u')) ||
          (e.ctrlKey && e.shiftKey && e.key === 'i') || e.key === 'F12') {
        e.preventDefault();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handlePlayClick = () => setIsPlaying(true);
  
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="text-center px-4">
          <div className="w-20 h-20 bg-blue-600 rounded-2xl mb-6 mx-auto flex items-center justify-center">
            <svg className="w-10 h-10 text-white animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-white mb-2">Loading video...</h2>
        </div>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900 px-4">
        <div className="max-w-md w-full bg-gray-800 rounded-2xl p-8 text-center">
          <div className="w-16 h-16 bg-red-900/50 rounded-2xl mb-6 mx-auto flex items-center justify-center">
            <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-white mb-2">Unable to load video</h2>
          <p className="text-gray-400 mb-6">{error}</p>
          <button onClick={() => window.location.reload()} className="w-full py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700">
            Try again
          </button>
        </div>
      </div>
    );
  }

  if (!videoData) return null;

  const youtubeId = extractYouTubeId(videoData.videoUrl);
  const embedUrl = youtubeId 
    ? `https://www.youtube-nocookie.com/embed/${youtubeId}?rel=0&modestbranding=1&showinfo=0&controls=1&fs=0&iv_load_policy=3&playsinline=1&autoplay=${isPlaying ? 1 : 0}`
    : null;

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col select-none" onContextMenu={(e) => e.preventDefault()}>
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
          <button onClick={() => router.push('/')} className="text-sm text-gray-400 hover:text-white">
            ← Back
          </button>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-5xl">
          {videoData.title && (
            <h1 className="text-xl font-bold text-white mb-4 text-center">{videoData.title}</h1>
          )}
          
          {embedUrl ? (
            <div ref={containerRef} className="relative w-full bg-black rounded-xl overflow-hidden" style={{ paddingBottom: '56.25%' }}>
              {!isPlaying ? (
                <div className="absolute inset-0 cursor-pointer group" onClick={handlePlayClick}>
                  <img
                    src={`https://img.youtube.com/vi/${youtubeId}/maxresdefault.jpg`}
                    alt="Video thumbnail"
                    className="absolute inset-0 w-full h-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = `https://img.youtube.com/vi/${youtubeId}/hqdefault.jpg`;
                    }}
                  />
                  <div className="absolute inset-0 bg-black/30 group-hover:bg-black/20 transition-colors" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-20 h-20 bg-blue-600 rounded-full flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                      <svg className="w-10 h-10 text-white ml-1" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M8 5v14l11-7z" />
                      </svg>
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  <iframe
                    className="absolute inset-0 w-full h-full"
                    src={embedUrl}
                    title="Video"
                    frameBorder="0"
                    allow="accelerometer; autoplay; encrypted-media; gyroscope"
                    referrerPolicy="strict-origin-when-cross-origin"
                  />
                  {/* Top overlay - blocks YouTube logo, title, channel */}
                  <div className="absolute top-0 left-0 right-0 h-14 bg-gradient-to-b from-gray-900 to-transparent z-10" />
                  {/* Bottom-right overlay - blocks YouTube logo */}
                  <div className="absolute bottom-8 right-0 w-28 h-8 bg-gray-900/80 z-10" />
                  {/* Top-right overlay - blocks share/more buttons */}
                  <div className="absolute top-0 right-0 w-20 h-14 bg-gray-900 z-10" />
                </>
              )}
            </div>
          ) : (
            <div className="bg-gray-800 rounded-xl p-8 text-center">
              <p className="text-gray-400">Video not available.</p>
            </div>
          )}

          <div className="mt-4 text-center">
            <span className="px-3 py-1 bg-gray-800 text-gray-500 text-sm rounded-full">Card: {cardId}</span>
          </div>
        </div>
      </main>

      <footer className="bg-gray-800 border-t border-gray-700 px-4 py-3">
        <p className="text-center text-gray-500 text-xs">Protected content - Authorized viewing only</p>
      </footer>
    </div>
  );
}
