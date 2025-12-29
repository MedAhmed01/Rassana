'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface ContinueWatchingItem {
  lesson_id: string;
  lesson_title: string;
  chapter_name: string;
  topic_id: string;
  topic_name: string;
  progress: number;
  duration_seconds?: number;
}

interface Package {
  name: string;
  expires_at: string;
  topics: string[];
}

interface Topic {
  id: string;
  name: string;
  description?: string;
  overall_percentage: number;
  total_lessons: number;
  completed_lessons: number;
  is_active: boolean;
}

interface Student {
  username: string;
  email: string;
  class?: string;
}

export default function LMSDashboard() {
  const router = useRouter();
  const [student, setStudent] = useState<Student | null>(null);
  const [packages, setPackages] = useState<Package[]>([]);
  const [continueWatching, setContinueWatching] = useState<ContinueWatchingItem[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadDashboard();
  }, []);

  async function loadDashboard() {
    try {
      const response = await fetch('/api/lms/dashboard');
      if (response.status === 401) {
        router.push('/lms/login');
        return;
      }
      if (!response.ok) {
        setError('Failed to load dashboard');
        return;
      }
      const data = await response.json();
      setStudent(data.student);
      setPackages(data.packages || []);
      setContinueWatching(data.continueWatching || []);
      setTopics(data.topics || []);
    } catch (err) {
      setError('Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  }

  async function handleLogout() {
    try {
      await fetch('/api/lms/auth/logout', { method: 'POST' });
      router.push('/lms/login');
    } catch (err) {
      router.push('/lms/login');
    }
  }

  function formatDuration(seconds?: number) {
    if (!seconds) return '';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  function formatDate(dateString: string) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-[#ff8240] border-t-transparent rounded-full animate-spin"></div>
          <p className="text-white/70">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900">
      {/* Header */}
      <header className="bg-slate-800 border-b border-slate-700">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:py-6">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-gradient-to-br from-[#ff8240] to-[#00f99d] rounded-xl flex items-center justify-center flex-shrink-0">
                <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-white">Welcome back, {student?.username}</h1>
                {student?.class && <p className="text-sm text-slate-400">Class: {student.class}</p>}
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="w-10 h-10 flex items-center justify-center rounded-xl bg-red-500/20 text-red-400 hover:bg-red-500/30 hover:text-red-300 transition-colors flex-shrink-0"
              title="Sign Out"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-6 sm:py-8">
        {error && (
          <div className="mb-6 p-4 bg-red-900/50 border border-red-700 rounded-xl text-red-200">
            {error}
          </div>
        )}

        {/* Student Info Card - Combined */}
        <div className="relative overflow-hidden bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl border border-slate-700 p-6 mb-6">
          <div className="absolute top-0 right-0 w-40 h-40 bg-gradient-to-br from-[#ff8240]/20 to-transparent rounded-full blur-3xl"></div>
          <div className="absolute bottom-0 left-0 w-32 h-32 bg-gradient-to-tr from-[#00f99d]/10 to-transparent rounded-full blur-3xl"></div>
          
          <div className="relative flex flex-col md:flex-row md:items-center gap-6 md:divide-x md:divide-slate-700">
            {/* Subscription Info */}
            {packages.length > 0 && (
              <div className="flex items-center gap-4 flex-1">
                <div className="w-12 h-12 rounded-xl bg-[#00f99d]/20 flex items-center justify-center flex-shrink-0">
                  <svg className="w-6 h-6 text-[#00f99d]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-xs font-medium text-[#00f99d] uppercase tracking-wide">Active Subscription</span>
                  <h3 className="text-lg sm:text-xl font-bold text-white mt-1 mb-1 truncate">{packages[0].name}</h3>
                  <div className="space-y-0.5">
                    <p className="text-xs sm:text-sm text-slate-400">Expires: {formatDate(packages[0].expires_at)}</p>
                    <p className="text-xs text-slate-500">{packages[0].topics.length} course{packages[0].topics.length !== 1 ? 's' : ''} included</p>
                  </div>
                </div>
              </div>
            )}

            {/* Overall Progress */}
            <div className="flex items-center gap-4 flex-1 md:pl-6">
              <div className="w-12 h-12 rounded-xl bg-[#ff8240]/20 flex items-center justify-center flex-shrink-0">
                <svg className="w-6 h-6 text-[#ff8240]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
              </div>
              <div className="flex-1">
                <span className="text-xs font-medium text-[#ff8240] uppercase tracking-wide">Your Progress</span>
                <h3 className="text-2xl sm:text-3xl font-bold text-white mt-1 mb-1">
                  {topics.reduce((sum, t) => sum + t.completed_lessons, 0)} lessons
                </h3>
                <p className="text-xs sm:text-sm text-slate-400">
                  Completed across {topics.filter(t => t.completed_lessons > 0).length} course{topics.filter(t => t.completed_lessons > 0).length !== 1 ? 's' : ''}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Continue Watching */}
        {continueWatching.length > 0 && (
          <div className="mb-8">
            <h2 className="text-xl font-bold text-white mb-4">Continue Watching</h2>
            <Link
              href={`/lms/lessons/${continueWatching[0].lesson_id}`}
              className="block relative overflow-hidden bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl border border-slate-700 p-6 hover:border-[#ff8240]/50 transition-all group"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-[#ff8240]/20 to-transparent rounded-full blur-3xl"></div>
              <div className="relative flex items-start gap-4">
                <div className="w-16 h-16 rounded-xl bg-[#ff8240]/20 flex items-center justify-center flex-shrink-0">
                  <svg className="w-8 h-8 text-[#ff8240]" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-lg font-semibold text-white mb-1 group-hover:text-[#ff8240] transition-colors">
                    {continueWatching[0].lesson_title}
                  </h3>
                  <p className="text-sm text-slate-400 mb-4">{continueWatching[0].topic_name}</p>
                  <div className="space-y-2">
                    <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-[#ff8240] to-[#00f99d] rounded-full"
                        style={{ width: `${continueWatching[0].progress}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-400">{Math.round(continueWatching[0].progress)}% complete</span>
                      {continueWatching[0].duration_seconds && (
                        <span className="text-slate-400 flex items-center gap-1">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          {formatDuration(continueWatching[0].duration_seconds)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </Link>
          </div>
        )}

        {/* My Courses */}
        <div>
          <h2 className="text-xl font-bold text-white mb-4">My Courses</h2>
          {topics.length === 0 ? (
            <div className="bg-slate-800 rounded-2xl border border-slate-700 p-12 text-center">
              <svg className="w-16 h-16 text-slate-600 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
              <h3 className="text-lg font-semibold text-slate-300 mb-2">No courses yet</h3>
              <p className="text-slate-500">Contact your administrator to get enrolled in a course.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {topics.map(topic => (
                <Link
                  key={topic.id}
                  href={topic.is_active ? `/lms/topics/${topic.id}` : '#'}
                  onClick={(e) => !topic.is_active && e.preventDefault()}
                  className={`block relative overflow-hidden bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl border border-slate-700 p-6 transition-all ${
                    topic.is_active ? 'hover:border-[#ff8240]/50 cursor-pointer group' : 'opacity-60 cursor-not-allowed'
                  }`}
                >
                  <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-[#ff8240]/10 to-transparent rounded-full blur-3xl"></div>
                  <div className="relative">
                    <h3 className={`text-lg font-bold text-white mb-2 ${topic.is_active ? 'group-hover:text-[#ff8240] transition-colors' : ''}`}>
                      {topic.name}
                    </h3>
                    {topic.description && (
                      <p className="text-sm text-slate-400 mb-4 line-clamp-2">{topic.description}</p>
                    )}
                    
                    {!topic.is_active && (
                      <div className="mb-4 p-3 bg-red-900/30 border border-red-700/50 rounded-lg">
                        <p className="text-xs text-red-300">Subscription required</p>
                      </div>
                    )}

                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-400">Progress</span>
                        <span className="font-medium text-white">{topic.overall_percentage}%</span>
                      </div>
                      <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-[#ff8240] to-[#00f99d] rounded-full transition-all"
                          style={{ width: `${topic.overall_percentage}%` }}
                        />
                      </div>
                      <p className="text-xs text-slate-500">
                        {topic.completed_lessons} of {topic.total_lessons} lessons completed
                      </p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
