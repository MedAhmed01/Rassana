'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter } from 'next/navigation';

function HomeContent() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    async function checkSession() {
      try {
        const response = await fetch('/api/auth/session');
        const data = await response.json();
        
        if (response.ok && data.authenticated) {
          if (data.role === 'admin') {
            router.push('/admin');
          } else {
            setLoading(false);
          }
        } else {
          router.push('/login');
        }
      } catch (err) {
        router.push('/login');
      }
    }
    
    checkSession();
  }, [router]);
  
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-[#d4834b] border-t-transparent rounded-full animate-spin"></div>
          <p className="text-gray-500 text-sm">Loading...</p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-[#fdf6f1]">
      {/* Header */}
      <header className="bg-white border-b border-gray-100">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#d4834b] rounded-xl flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            </div>
            <span className="font-bold text-xl text-gray-900">Rassana CardVideo</span>
          </div>
          <button
            onClick={() => fetch('/api/auth/logout', { method: 'POST' }).then(() => router.push('/login'))}
            className="text-sm text-gray-500 hover:text-[#d4834b] font-medium"
          >
            Sign out
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-12 sm:py-20">
        <div className="text-center mb-12">
          <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-4">
            Welcome to <span className="text-[#d4834b]">Rassana CardVideo</span>
          </h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Access video explanations instantly by scanning the QR code on your learning card.
          </p>
        </div>

        {/* How it works */}
        <div className="bg-white rounded-2xl shadow-xl shadow-[#d4834b]/5 border border-gray-100 p-6 sm:p-10 max-w-2xl mx-auto">
          <h2 className="text-xl font-bold text-gray-900 mb-8 text-center">
            How it works
          </h2>
          
          <div className="space-y-6">
            {[
              {
                step: '1',
                title: 'Find your QR code',
                description: 'Look for the QR code printed on your learning card',
                icon: (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                )
              },
              {
                step: '2',
                title: 'Scan with your phone',
                description: 'Use your phone camera or QR scanner app',
                icon: (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                )
              },
              {
                step: '3',
                title: 'Watch & learn',
                description: 'Enjoy the video explanation for your topic',
                icon: (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                )
              }
            ].map((item, index) => (
              <div key={index} className="flex items-start gap-4">
                <div className="flex-shrink-0 w-12 h-12 bg-[#d4834b] rounded-xl flex items-center justify-center text-white font-bold text-lg">
                  {item.step}
                </div>
                <div className="flex-1 pt-1">
                  <h3 className="font-semibold text-gray-900 mb-1">{item.title}</h3>
                  <p className="text-gray-500 text-sm">{item.description}</p>
                </div>
              </div>
            ))}
          </div>

          {/* QR Icon */}
          <div className="mt-10 pt-8 border-t border-gray-100 text-center">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-gray-900 rounded-2xl mb-4">
              <svg className="w-12 h-12 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
              </svg>
            </div>
            <p className="text-sm text-gray-500">
              Ready to scan? Point your camera at the QR code
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="py-8 text-center text-sm text-gray-400">
        <p>© 2025 Rassana CardVideo. All rights reserved.</p>
      </footer>
    </div>
  );
}

export default function Home() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-[#d4834b] border-t-transparent rounded-full animate-spin"></div>
          <p className="text-gray-500 text-sm">Loading...</p>
        </div>
      </div>
    }>
      <HomeContent />
    </Suspense>
  );
}
