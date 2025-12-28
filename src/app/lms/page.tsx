'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface SubscribedTopic {
  id: string;
  name: string;
  description?: string;
  overall_percentage: number;
  total_lessons: number;
  completed_lessons: number;
  is_active: boolean;
}

interface Student {
  id: string;
  username: string;
  email: string;
}

export default function LMSDashboard() {
  const router = useRouter();
  const [topics, setTopics] = useState<SubscribedTopic[]>([]);
  const [student, setStudent] = useState<Student | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    checkSession();
  }, []);

  async function checkSession() {
    try {
      const sessionRes = await fetch('/api/lms/session');
      if (sessionRes.status === 401) {
        router.push('/lms/login');
        return;
      }
      if (sessionRes.ok) {
        const sessionData = await sessionRes.json();
        setStudent(sessionData.student);
        loadTopics();
      } else {
        router.push('/lms/login');
      }
    } catch (err) {
      router.push('/lms/login');
    }
  }

  async function loadTopics() {
    try {
      const response = await fetch('/api/lms/topics');
      if (response.status === 401) {
        router.push('/lms/login');
        return;
      }
      if (response.ok) {
        const data = await response.json();
        setTopics(data.topics || []);
      } else {
        setError('Failed to load courses');
      }
    } catch (err) {
      setError('Failed to load courses');
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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-[#ff8240] border-t-transparent rounded-full animate-spin"></div>
          <p className="text-slate-500">Loading your courses...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-[#ff8240] to-[#00f99d] rounded-xl flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
              </div>
              <div>
                <h1 className="text-xl font-bold text-slate-900">Rassa LMS</h1>
                <p className="text-sm text-slate-500">Your Learning Dashboard</p>
              </div>
            </div>
            <Link
              href="/lms/login"
              className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
            >
              Sign Out
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 py-8">
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700">
            {error}
          </div>
        )}

        <h2 className="text-2xl font-bold text-slate-900 mb-6">My Courses</h2>

        {topics.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
            <svg className="w-16 h-16 text-slate-300 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
            <h3 className="text-lg font-semibold text-slate-700 mb-2">No courses yet</h3>
            <p className="text-slate-500">Contact your administrator to get enrolled in a course.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {topics.map(topic => (
              <div
                key={topic.id}
                className={`bg-white rounded-2xl border border-slate-200 overflow-hidden hover:shadow-lg transition-shadow ${
                  !topic.is_active ? 'opacity-75' : ''
                }`}
              >
                {/* Topic Header */}
                <div className="h-32 bg-gradient-to-br from-[#ff8240] to-[#00f99d] p-6 flex items-end">
                  <h3 className="text-xl font-bold text-white">{topic.name}</h3>
                </div>

                {/* Topic Body */}
                <div className="p-6">
                  {topic.description && (
                    <p className="text-slate-600 text-sm mb-4 line-clamp-2">{topic.description}</p>
                  )}

                  {/* Progress */}
                  <div className="mb-4">
                    <div className="flex justify-between text-sm mb-2">
                      <span className="text-slate-600">Progress</span>
                      <span className="font-medium text-slate-900">{topic.overall_percentage}%</span>
                    </div>
                    <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-[#ff8240] to-[#00f99d] rounded-full transition-all"
                        style={{ width: `${topic.overall_percentage}%` }}
                      />
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                      {topic.completed_lessons} of {topic.total_lessons} lessons completed
                    </p>
                  </div>

                  {/* Status Badge */}
                  {!topic.is_active && (
                    <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                      <p className="text-sm text-red-700">
                        Subscription expired. Contact admin to renew.
                      </p>
                    </div>
                  )}

                  {/* Action Button */}
                  <Link
                    href={topic.is_active ? `/lms/topics/${topic.id}` : '#'}
                    className={`block w-full py-3 text-center font-medium rounded-xl transition-colors ${
                      topic.is_active
                        ? 'bg-gradient-to-r from-[#ff8240] to-[#00f99d] text-white hover:opacity-90'
                        : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                    }`}
                    onClick={(e) => !topic.is_active && e.preventDefault()}
                  >
                    {topic.overall_percentage > 0 ? 'Continue' : 'Start'}
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
