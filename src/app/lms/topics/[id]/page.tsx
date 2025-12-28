'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface Lesson {
  id: string;
  title: string;
  description?: string;
  duration_seconds?: number;
  is_unlocked: boolean;
  progress?: {
    max_percentage_watched: number;
    last_position_seconds: number;
  };
}

interface Chapter {
  id: string;
  name: string;
  description?: string;
  lessons: Lesson[];
}

interface Topic {
  id: string;
  name: string;
  description?: string;
  chapters: Chapter[];
}

export default function TopicDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: topicId } = use(params);
  const router = useRouter();
  const [topic, setTopic] = useState<Topic | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expired, setExpired] = useState(false);

  useEffect(() => {
    loadTopic();
  }, [topicId]);

  async function loadTopic() {
    try {
      const response = await fetch(`/api/lms/topics/${topicId}`);
      if (response.status === 401) {
        router.push('/lms/login');
        return;
      }
      if (!response.ok) {
        const data = await response.json();
        setError(data.error || 'Failed to load topic');
        return;
      }
      const data = await response.json();
      setTopic(data.topic);
      // Check if subscription is expired
      if (data.subscription?.expired) {
        setExpired(true);
      }
    } catch (err) {
      setError('Failed to load topic');
    } finally {
      setLoading(false);
    }
  }

  function formatDuration(seconds?: number) {
    if (!seconds) return '';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-[#ff8240] border-t-transparent rounded-full animate-spin"></div>
          <p className="text-slate-500">Loading course...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-50">
        <header className="bg-white border-b border-slate-200">
          <div className="max-w-4xl mx-auto px-4 py-4">
            <Link href="/lms" className="flex items-center gap-2 text-slate-600 hover:text-slate-900">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back to Courses
            </Link>
          </div>
        </header>
        <main className="max-w-4xl mx-auto px-4 py-8">
          <div className={`p-6 rounded-2xl border ${expired ? 'bg-amber-50 border-amber-200' : 'bg-red-50 border-red-200'}`}>
            <h2 className={`text-lg font-semibold mb-2 ${expired ? 'text-amber-800' : 'text-red-800'}`}>
              {expired ? 'Subscription Expired' : 'Error'}
            </h2>
            <p className={expired ? 'text-amber-700' : 'text-red-700'}>{error}</p>
          </div>
        </main>
      </div>
    );
  }

  if (!topic) return null;

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <Link href="/lms" className="flex items-center gap-2 text-slate-600 hover:text-slate-900">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Courses
          </Link>
        </div>
      </header>

      {/* Topic Header */}
      <div className="bg-gradient-to-br from-[#ff8240] to-[#00f99d] text-white">
        <div className="max-w-4xl mx-auto px-4 py-8">
          <h1 className="text-3xl font-bold mb-2">{topic.name}</h1>
          {topic.description && <p className="text-white/80">{topic.description}</p>}
        </div>
      </div>

      {/* Chapters and Lessons */}
      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="space-y-6">
          {topic.chapters.map((chapter, chapterIndex) => (
            <div key={chapter.id} className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
              {/* Chapter Header */}
              <div className="p-4 bg-slate-50 border-b border-slate-200">
                <h2 className="font-semibold text-slate-900">
                  Chapter {chapterIndex + 1}: {chapter.name}
                </h2>
                {chapter.description && (
                  <p className="text-sm text-slate-500 mt-1">{chapter.description}</p>
                )}
              </div>

              {/* Lessons */}
              <div className="divide-y divide-slate-100">
                {chapter.lessons.map((lesson, lessonIndex) => {
                  const isCompleted = (lesson.progress?.max_percentage_watched || 0) >= 90;
                  const hasProgress = (lesson.progress?.max_percentage_watched || 0) > 0;
                  
                  return (
                    <div
                      key={lesson.id}
                      className={`p-4 flex items-center gap-4 ${
                        lesson.is_unlocked ? 'hover:bg-slate-50' : 'bg-slate-50/50'
                      }`}
                    >
                      {/* Status Icon */}
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                        isCompleted
                          ? 'bg-green-100 text-green-600'
                          : lesson.is_unlocked
                            ? 'bg-[#ff8240]/10 text-[#ff8240]'
                            : 'bg-slate-200 text-slate-400'
                      }`}>
                        {isCompleted ? (
                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        ) : lesson.is_unlocked ? (
                          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M8 5v14l11-7z" />
                          </svg>
                        ) : (
                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                          </svg>
                        )}
                      </div>

                      {/* Lesson Info */}
                      <div className="flex-1 min-w-0">
                        <h3 className={`font-medium ${lesson.is_unlocked ? 'text-slate-900' : 'text-slate-500'}`}>
                          {lessonIndex + 1}. {lesson.title}
                        </h3>
                        <div className="flex items-center gap-3 mt-1">
                          {lesson.duration_seconds && (
                            <span className="text-xs text-slate-500">
                              {formatDuration(lesson.duration_seconds)}
                            </span>
                          )}
                          {hasProgress && (
                            <div className="flex items-center gap-2">
                              <div className="w-16 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-[#00f99d] rounded-full"
                                  style={{ width: `${lesson.progress?.max_percentage_watched || 0}%` }}
                                />
                              </div>
                              <span className="text-xs text-slate-500">
                                {Math.round(lesson.progress?.max_percentage_watched || 0)}%
                              </span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Action */}
                      {lesson.is_unlocked ? (
                        <Link
                          href={`/lms/lessons/${lesson.id}`}
                          className="px-4 py-2 bg-gradient-to-r from-[#ff8240] to-[#00f99d] text-white text-sm font-medium rounded-lg hover:opacity-90 transition-opacity"
                        >
                          {hasProgress ? 'Continue' : 'Watch'}
                        </Link>
                      ) : (
                        <span className="px-4 py-2 bg-slate-100 text-slate-400 text-sm font-medium rounded-lg">
                          Locked
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
