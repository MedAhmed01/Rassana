'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

type LoginMode = 'cards' | 'lms';

/**
 * Generate a unique device ID based on browser fingerprint
 * This is stored in localStorage to persist across sessions
 */
function getDeviceId(): string {
  const DEVICE_ID_KEY = 'rassana_device_id';
  
  // Check if we already have a device ID
  let deviceId = localStorage.getItem(DEVICE_ID_KEY);
  
  if (!deviceId) {
    // Generate a new device ID based on browser characteristics
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.textBaseline = 'top';
      ctx.font = '14px Arial';
      ctx.fillText('device-fingerprint', 2, 2);
    }
    
    const fingerprint = [
      navigator.userAgent,
      navigator.language,
      screen.width + 'x' + screen.height,
      screen.colorDepth,
      new Date().getTimezoneOffset(),
      canvas.toDataURL(),
    ].join('|');
    
    // Create a hash of the fingerprint
    let hash = 0;
    for (let i = 0; i < fingerprint.length; i++) {
      const char = fingerprint.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    
    deviceId = 'dev_' + Math.abs(hash).toString(36) + '_' + Date.now().toString(36);
    localStorage.setItem(DEVICE_ID_KEY, deviceId);
  }
  
  return deviceId;
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const [loginMode, setLoginMode] = useState<LoginMode>('cards');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  
  const redirect = searchParams.get('redirect');
  const errorParam = searchParams.get('error');
  const modeParam = searchParams.get('mode');
  
  useEffect(() => {
    if (errorParam === 'expired') {
      setError('Your credentials have expired. Please contact an administrator.');
    }
    if (modeParam === 'lms') {
      setLoginMode('lms');
    }
  }, [errorParam, modeParam]);

  // Clear form when switching modes
  useEffect(() => {
    setUsername('');
    setPassword('');
    setError('');
  }, [loginMode]);
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    
    try {
      if (loginMode === 'cards') {
        // Get device ID for device binding
        const deviceId = getDeviceId();
        
        // Card system login
        const response = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password, deviceId }),
        });
        
        const data = await response.json();
        
        if (!response.ok) {
          setError(data.error || 'Login failed');
          setLoading(false);
          return;
        }
        
        localStorage.removeItem('rassana_continue_watching');
        
        if (redirect) {
          router.push(redirect);
        } else if (data.role === 'admin') {
          router.push('/admin');
        } else {
          router.push('/');
        }
      } else {
        // LMS login
        const response = await fetch('/api/lms/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: username, password }),
        });
        
        const data = await response.json();
        
        if (!response.ok || !data.success) {
          setError(data.error || 'Login failed');
          setLoading(false);
          return;
        }
        
        router.push('/lms');
      }
    } catch (err) {
      setError('An error occurred. Please try again.');
      setLoading(false);
    }
  };
  
  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden">
      {/* Gradient Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-[#7d4727] to-slate-900">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-[#ff8240]/20 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-[#00f99d]/15 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }}></div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-gradient-to-r from-[#ff8240]/10 to-[#00f99d]/10 rounded-full blur-3xl"></div>
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:50px_50px]"></div>
        <div className="absolute top-20 left-20 w-2 h-2 bg-[#e9b48e] rounded-full animate-bounce" style={{ animationDuration: '3s' }}></div>
        <div className="absolute top-40 right-32 w-3 h-3 bg-[#ff8240] rounded-full animate-bounce" style={{ animationDuration: '4s', animationDelay: '0.5s' }}></div>
        <div className="absolute bottom-32 left-1/3 w-2 h-2 bg-[#e9b48e] rounded-full animate-bounce" style={{ animationDuration: '3.5s', animationDelay: '1s' }}></div>
        <div className="absolute top-1/3 right-20 w-1.5 h-1.5 bg-[#ffd4b8] rounded-full animate-bounce" style={{ animationDuration: '4.5s', animationDelay: '0.3s' }}></div>
      </div>

      {/* Content */}
      <div className="relative flex-1 flex items-center justify-center px-4 py-8 sm:py-12">
        <div className="w-full max-w-md">
          {/* Logo & Header */}
          <div className="text-center mb-6">
            <div className="relative inline-block mb-4">
              <div className="absolute inset-0 bg-gradient-to-r from-[#ff8240] to-[#00f99d] rounded-2xl blur-xl opacity-50 animate-pulse"></div>
              <div className="relative w-16 h-16 sm:w-20 sm:h-20 bg-gradient-to-br from-[#ff8240] via-[#ff8240] to-[#00f99d] rounded-2xl flex items-center justify-center shadow-2xl transform hover:scale-105 transition-transform duration-300">
                {loginMode === 'cards' ? (
                  <svg className="w-8 h-8 sm:w-10 sm:h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                ) : (
                  <svg className="w-8 h-8 sm:w-10 sm:h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                  </svg>
                )}
              </div>
            </div>
            
            <h1 className="text-xl sm:text-2xl font-bold text-white mb-2">
              {loginMode === 'cards' ? 'بطاقات رصانة || Rassana Cards' : 'Rassa LMS'}
            </h1>
            <p className="text-[#ffd4b8]/70 text-sm sm:text-base">
              {loginMode === 'cards' ? 'Sign in to access your video content' : 'Sign in to access your courses'}
            </p>
          </div>

          {/* Mode Toggle */}
          <div className="relative mb-6">
            <div className="flex bg-white/5 backdrop-blur-sm rounded-xl p-1 border border-white/10">
              <button
                type="button"
                onClick={() => setLoginMode('cards')}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-sm font-medium transition-all duration-300 ${
                  loginMode === 'cards'
                    ? 'bg-gradient-to-r from-[#ff8240] to-[#ff8240] text-white shadow-lg'
                    : 'text-[#ffd4b8]/70 hover:text-white'
                }`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                <span>Cards</span>
              </button>
              <button
                type="button"
                onClick={() => setLoginMode('lms')}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-sm font-medium transition-all duration-300 ${
                  loginMode === 'lms'
                    ? 'bg-gradient-to-r from-[#00f99d] to-[#00d084] text-white shadow-lg'
                    : 'text-[#ffd4b8]/70 hover:text-white'
                }`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
                <span>LMS</span>
              </button>
            </div>
          </div>

          {/* Form Card */}
          <div className="relative">
            <div className={`absolute -inset-1 bg-gradient-to-r ${loginMode === 'cards' ? 'from-[#ff8240] via-[#00f99d] to-[#ff8240]' : 'from-[#00f99d] via-[#ff8240] to-[#00f99d]'} rounded-3xl blur-lg opacity-30`}></div>
            
            <div className="relative bg-white/10 backdrop-blur-xl rounded-2xl p-6 sm:p-8 border border-white/20 shadow-2xl">
              <form onSubmit={handleSubmit} className="space-y-5">
                {error && (
                  <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 flex items-start gap-3 animate-in slide-in-from-top duration-300">
                    <div className="w-5 h-5 rounded-full bg-red-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <svg className="w-3 h-3 text-red-400" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <p className="text-sm text-red-300">{error}</p>
                  </div>
                )}

                {/* Username/Email Field */}
                <div className="space-y-2">
                  <label htmlFor="username" className="block text-sm font-medium text-[#ffd4b8]">
                    {loginMode === 'cards' ? 'Username or phone number' : 'Email or Username'}
                  </label>
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <svg className="w-5 h-5 text-[#ffd4b8]/50 group-focus-within:text-[#ff8240] transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        {loginMode === 'cards' ? (
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        ) : (
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                        )}
                      </svg>
                    </div>
                    <input
                      id="username"
                      name="username"
                      type="text"
                      required
                      className="w-full pl-12 pr-4 py-3.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-[#ffd4b8]/40 focus:outline-none focus:ring-2 focus:ring-[#ff8240]/50 focus:border-[#ff8240]/50 focus:bg-white/10 transition-all duration-200"
                      placeholder={loginMode === 'cards' ? 'Username or phone number' : 'Email or username'}
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      disabled={loading}
                    />
                  </div>
                </div>

                {/* Password Field */}
                <div className="space-y-2">
                  <label htmlFor="password" className="block text-sm font-medium text-[#ffd4b8]">
                    Password
                  </label>
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <svg className="w-5 h-5 text-[#ffd4b8]/50 group-focus-within:text-[#ff8240] transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                      </svg>
                    </div>
                    <input
                      id="password"
                      name="password"
                      type={showPassword ? 'text' : 'password'}
                      required
                      className="w-full pl-12 pr-12 py-3.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-[#ffd4b8]/40 focus:outline-none focus:ring-2 focus:ring-[#ff8240]/50 focus:border-[#ff8240]/50 focus:bg-white/10 transition-all duration-200"
                      placeholder="Enter your password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      disabled={loading}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 pr-4 flex items-center text-[#ffd4b8]/50 hover:text-[#ffd4b8] transition-colors"
                    >
                      {showPassword ? (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                        </svg>
                      ) : (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={loading}
                  className="relative w-full group mt-6"
                >
                  <div className={`absolute -inset-0.5 bg-gradient-to-r ${loginMode === 'cards' ? 'from-[#ff8240] to-[#ff8240]' : 'from-[#00f99d] to-[#00d084]'} rounded-xl blur opacity-60 group-hover:opacity-100 transition duration-300`}></div>
                  <div className={`relative w-full py-4 bg-gradient-to-r ${loginMode === 'cards' ? 'from-[#ff8240] to-[#ff8240]' : 'from-[#00f99d] to-[#00d084]'} text-white font-semibold rounded-xl hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-900 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 flex items-center justify-center gap-2`}>
                    {loading ? (
                      <>
                        <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        <span>Signing in...</span>
                      </>
                    ) : (
                      <>
                        <span>Sign in to {loginMode === 'cards' ? 'Cards' : 'LMS'}</span>
                        <svg className="w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                        </svg>
                      </>
                    )}
                  </div>
                </button>
              </form>

              {/* Divider */}
              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-white/10"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-4 bg-transparent text-[#ffd4b8]/50">Secure Login</span>
                </div>
              </div>

              {/* Security Badge */}
              <div className="flex items-center justify-center gap-2 text-[#ffd4b8]/50 text-sm">
                <svg className={`w-4 h-4 ${loginMode === 'cards' ? 'text-[#ff8240]' : 'text-[#00f99d]'}`} fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <span>Protected with end-to-end encryption</span>
              </div>
            </div>
          </div>

          {/* Footer */}
          <p className="text-center text-[#ffd4b8]/50 text-sm mt-6">
            Need help? <span className={`${loginMode === 'cards' ? 'text-[#ff8240]' : 'text-[#00f99d]'} hover:opacity-80 cursor-pointer transition-colors`}>Contact your administrator</span>
          </p>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-[#7d4727] to-slate-900">
        <div className="relative">
          <div className="w-16 h-16 border-4 border-[#ff8240]/30 rounded-full"></div>
          <div className="absolute top-0 left-0 w-16 h-16 border-4 border-[#ff8240] border-t-transparent rounded-full animate-spin"></div>
        </div>
      </div>
    }>
      <LoginForm />
    </Suspense>
  );
}
