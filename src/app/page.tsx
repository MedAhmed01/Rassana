'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter } from 'next/navigation';

interface UserData {
  username: string;
  role: string;
  subscriptions: string[];
  expires_at: string;
}

function HomeContent() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<UserData | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);
  
  useEffect(() => {
    async function checkSession() {
      try {
        const response = await fetch('/api/auth/session');
        const data = await response.json();
        
        if (response.ok && data.authenticated) {
          if (data.role === 'admin') {
            router.push('/admin');
          } else {
            setUser({
              username: data.username || 'User',
              role: data.role,
              subscriptions: data.subscriptions || [],
              expires_at: data.expires_at || '',
            });
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

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      router.push('/login');
    } catch (err) {
      setLoggingOut(false);
    }
  }

  const subscriptionColors: Record<string, { bg: string; text: string; icon: string }> = {
    math: { bg: 'bg-[#ff8240]/10', text: 'text-[#ff8240]', icon: '📐' },
    physics: { bg: 'bg-blue-500/10', text: 'text-blue-600', icon: '⚡' },
    science: { bg: 'bg-[#00f99d]/10', text: 'text-[#00c97d]', icon: '🔬' },
  };

  const isExpired = user?.expires_at ? new Date(user.expires_at) < new Date() : false;
  const daysLeft = user?.expires_at ? Math.ceil((new Date(user.expires_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : 0;
  
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-[#ff8240] border-t-transparent rounded-full animate-spin"></div>
          <p className="text-white/60 text-sm">Loading...</p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Decorative background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 right-0 w-96 h-96 bg-[#ff8240]/10 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-[#00f99d]/10 rounded-full blur-3xl"></div>
      </div>

      <div className="relative min-h-screen flex flex-col">
        {/* Header */}
        <header className="px-4 py-4 sm:py-6">
          <div className="max-w-lg mx-auto flex justify-center items-center">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 bg-gradient-to-br from-[#ff8240] to-[#00f99d] rounded-xl flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              </div>
              <span className="font-bold text-white text-lg">بطاقات رصانة || Rassana Cards</span>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 px-4 pb-8">
          <div className="max-w-lg mx-auto space-y-6">
            
            {/* User Profile Card */}
            <div className="bg-white/5 backdrop-blur-xl rounded-3xl border border-white/10 overflow-hidden">
              {/* Profile Header */}
              <div className="bg-gradient-to-r from-[#ff8240] to-[#00f99d] p-6 text-center">
                <div className="w-20 h-20 mx-auto bg-white/20 backdrop-blur rounded-full flex items-center justify-center mb-3">
                  <span className="text-3xl font-bold text-white">
                    {user?.username?.charAt(0).toUpperCase() || 'U'}
                  </span>
                </div>
                <h1 className="text-2xl font-bold text-white mb-1">
                  {user?.username || 'User'}
                </h1>
                <p className="text-white/80 text-sm">Student Account</p>
              </div>

              {/* Subscriptions */}
              <div className="p-5">
                <h2 className="text-white/60 text-xs font-semibold uppercase tracking-wider mb-3">
                  Your Subscriptions
                </h2>
                {user?.subscriptions && user.subscriptions.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {user.subscriptions.map((sub) => {
                      const colors = subscriptionColors[sub.toLowerCase()] || { bg: 'bg-gray-500/10', text: 'text-gray-400', icon: '📚' };
                      return (
                        <div
                          key={sub}
                          className={`${colors.bg} ${colors.text} px-4 py-2 rounded-xl text-sm font-medium flex items-center gap-2`}
                        >
                          <span>{colors.icon}</span>
                          <span className="capitalize">{sub}</span>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-white/40 text-sm">No active subscriptions</p>
                )}

                {/* Expiration */}
                {user?.expires_at && (
                  <div className={`mt-4 p-3 rounded-xl ${isExpired ? 'bg-red-500/10' : daysLeft <= 7 ? 'bg-yellow-500/10' : 'bg-[#00f99d]/10'}`}>
                    <div className="flex items-center gap-2">
                      <svg className={`w-4 h-4 ${isExpired ? 'text-red-400' : daysLeft <= 7 ? 'text-yellow-400' : 'text-[#00f99d]'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span className={`text-sm ${isExpired ? 'text-red-400' : daysLeft <= 7 ? 'text-yellow-400' : 'text-[#00f99d]'}`}>
                        {isExpired ? 'Subscription expired' : `${daysLeft} days remaining`}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* How to Use Card */}
            <div className="bg-white/5 backdrop-blur-xl rounded-3xl border border-white/10 p-5">
              <h2 className="text-white font-semibold mb-4 flex items-center gap-2">
                <svg className="w-5 h-5 text-[#ff8240]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                How to access videos
              </h2>
              
              <div className="space-y-4">
                {[
                  { step: '1', title: 'Find QR code', desc: 'On your learning card', icon: '🔍' },
                  { step: '2', title: 'Scan it', desc: 'With your phone camera', icon: '📱' },
                  { step: '3', title: 'Watch & learn', desc: 'Enjoy the video', icon: '🎬' },
                ].map((item) => (
                  <div key={item.step} className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-[#ff8240]/20 rounded-xl flex items-center justify-center text-lg">
                      {item.icon}
                    </div>
                    <div className="flex-1">
                      <p className="text-white text-sm font-medium">{item.title}</p>
                      <p className="text-white/50 text-xs">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Logout Button */}
            <button
              onClick={handleLogout}
              disabled={loggingOut}
              className="w-full bg-white/5 hover:bg-red-500/20 border border-white/10 hover:border-red-500/30 rounded-2xl p-4 flex items-center justify-center gap-3 transition-all duration-300 group"
            >
              {loggingOut ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
              ) : (
                <svg className="w-5 h-5 text-white/60 group-hover:text-red-400 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
              )}
              <span className="text-white/60 group-hover:text-red-400 font-medium transition-colors">
                {loggingOut ? 'Signing out...' : 'Sign out'}
              </span>
            </button>

          </div>
        </main>

        {/* Footer */}
        <footer className="px-4 py-4 text-center">
          <p className="text-white/30 text-xs">© 2025 Rassana CardVideo</p>
        </footer>
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-[#ff8240] border-t-transparent rounded-full animate-spin"></div>
          <p className="text-white/60 text-sm">Loading...</p>
        </div>
      </div>
    }>
      <HomeContent />
    </Suspense>
  );
}
