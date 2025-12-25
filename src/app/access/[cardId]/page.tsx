'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';

export default function VideoAccessPage() {
  const params = useParams();
  const router = useRouter();
  const cardId = params.cardId as string;
  
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  
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
          window.location.href = data.videoUrl;
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
  
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-white to-blue-50">
        <div className="text-center px-4">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-blue-600 rounded-2xl mb-6 shadow-lg shadow-blue-600/30">
            <svg className="w-10 h-10 text-white animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Loading your video</h2>
          <p className="text-gray-500">Please wait while we prepare your content...</p>
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
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-white to-blue-50 px-4">
        <div className="max-w-md w-full">
          <div className="bg-white rounded-2xl shadow-xl shadow-gray-900/5 border border-gray-100 p-8 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-red-100 rounded-2xl mb-6">
              <svg className="w-8 h-8 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            
            <h2 className="text-xl font-bold text-gray-900 mb-2">Unable to load video</h2>
            <p className="text-gray-500 mb-8">{error}</p>
            
            <div className="space-y-3">
              <button
                onClick={() => window.location.reload()}
                className="w-full py-3 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 shadow-lg shadow-blue-600/30 btn-lift"
              >
                Try again
              </button>
              <button
                onClick={() => router.push('/login')}
                className="w-full py-3 bg-gray-100 text-gray-700 font-semibold rounded-xl hover:bg-gray-200"
              >
                Go to login
              </button>
            </div>
          </div>
          
          <p className="text-center text-gray-400 text-sm mt-6">
            Card ID: {cardId}
          </p>
        </div>
      </div>
    );
  }
  
  return null;
}
