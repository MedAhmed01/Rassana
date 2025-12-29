'use client';

import { useState, useEffect, use, useMemo } from 'react';
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
  
  // Filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedChapter, setSelectedChapter] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<'all' | 'unlocked'>('all');
  const [expandedChapters, setExpandedChapters] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadTopic();
  }, [topicId]);

  // Initialize all chapters as expanded when topic loads
  useEffect(() => {
    if (topic) {
      setExpandedChapters(new Set(topic.chapters.map(c => c.id)));
    }
  }, [topic]);

  // Toggle chapter expansion
  function toggleChapter(chapterId: string) {
    setExpandedChapters(prev => {
      const next = new Set(prev);
      if (next.has(chapterId)) {
        next.delete(chapterId);
      } else {
        next.add(chapterId);
      }
      return next;
    });
  }

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
      if (data.subscription?.expired) {
        setExpired(true);
      }
    } catch (err) {
      setError('Failed to load topic');
    } finally {
      setLoading(false);
    }
  }

  // Find lesson to continue watching (most recently watched)
  const continueWatchingLesson = useMemo(() => {
    if (!topic) return null;
    
    let mostRecent: { lesson: any; chapter: any; updatedAt: string } | null = null;
    
    for (const chapter of topic.chapters) {
      for (const lesson of chapter.lessons) {
        if (lesson.is_unlocked && 
            lesson.progress && 
            lesson.progress.max_percentage_watched > 5 && 
            lesson.progress.max_percentage_watched < 90) {
          const updatedAt = lesson.progress.updated_at || '';
          if (!mostRecent || updatedAt > mostRecent.updatedAt) {
            mostRecent = { lesson, chapter, updatedAt };
          }
        }
      }
    }
    
    return mostRecent ? { lesson: mostRecent.lesson, chapter: mostRecent.chapter } : null;
  }, [topic]);

  // Filter lessons
  const filteredChapters = useMemo(() => {
    if (!topic) return [];
    
    return topic.chapters
      .map(chapter => ({
        ...chapter,
        lessons: chapter.lessons.filter(lesson => {
          // Search filter
          if (searchQuery && !lesson.title.toLowerCase().includes(searchQuery.toLowerCase())) {
            return false;
          }
          
          // Chapter filter
          if (selectedChapter !== 'all' && chapter.id !== selectedChapter) {
            return false;
          }
          
          // Status filter
          if (filterStatus === 'unlocked' && !lesson.is_unlocked) return false;
          
          return true;
        })
      }))
      .filter(chapter => chapter.lessons.length > 0);
  }, [topic, searchQuery, selectedChapter, filterStatus]);

  function formatDuration(seconds?: number) {
    if (!seconds) return '';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-[#ff8240] border-t-transparent rounded-full animate-spin"></div>
          <p className="text-white/70">Loading course...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-900">
        <header className="bg-slate-800 border-b border-slate-700">
          <div className="max-w-6xl mx-auto px-4 py-4">
            <Link href="/lms" className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back to Courses
            </Link>
          </div>
        </header>
        <main className="max-w-6xl mx-auto px-4 py-8">
          <div className={`p-6 rounded-2xl border ${expired ? 'bg-amber-900/50 border-amber-700' : 'bg-red-900/50 border-red-700'}`}>
            <h2 className={`text-lg font-semibold mb-2 ${expired ? 'text-amber-200' : 'text-red-200'}`}>
              {expired ? 'Subscription Expired' : 'Error'}
            </h2>
            <p className={expired ? 'text-amber-300/70' : 'text-red-300/70'}>{error}</p>
          </div>
        </main>
      </div>
    );
  }

  if (!topic) return null;

  return (
    <div className="min-h-screen bg-slate-900">
      {/* Topic Header - Matching Continue Watching Style */}
      <div className="max-w-6xl mx-auto px-4 pt-6 pb-0">
        <div className="relative overflow-hidden bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl border border-slate-700 p-6 sm:p-8">
          <div className="absolute top-0 right-0 w-40 h-40 bg-gradient-to-br from-[#ff8240]/20 to-transparent rounded-full blur-3xl"></div>
          <div className="absolute bottom-0 left-0 w-32 h-32 bg-gradient-to-tr from-[#00f99d]/10 to-transparent rounded-full blur-3xl"></div>
          <div className="relative">
            {/* Back Button (Absolute positioned) */}
            <Link 
              href="/lms" 
              className="absolute left-0 top-1/2 -translate-y-1/2 flex items-center justify-center w-10 h-10 rounded-xl bg-slate-700/50 hover:bg-slate-700 text-slate-400 hover:text-white transition-all"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            
            {/* Centered Title and Description */}
            <div className="text-center px-12">
              <h1 className="text-2xl sm:text-3xl font-bold text-white">{topic.name}</h1>
              {topic.description && <p className="text-slate-400 text-sm sm:text-base mt-2">{topic.description}</p>}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 py-6 sm:py-8">
        {/* Continue Watching Card */}
        {continueWatchingLesson && (
          <div className="mb-6">
            <Link
              href={`/lms/lessons/${continueWatchingLesson.lesson.id}`}
              className="block relative overflow-hidden bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl border border-slate-700 p-6 hover:border-[#ff8240]/50 transition-all cursor-pointer group"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-[#ff8240]/20 to-transparent rounded-full blur-3xl"></div>
              <div className="relative">
                <div className="flex items-center gap-2 mb-3">
                  <svg className="w-5 h-5 text-[#00f99d]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="text-sm font-medium text-[#00f99d]">Continue Watching</span>
                </div>
                <h3 className="text-lg font-semibold text-white mb-1 group-hover:text-[#ff8240] transition-colors">{continueWatchingLesson.lesson.title}</h3>
                <p className="text-sm text-slate-400 mb-4">{continueWatchingLesson.chapter.name}</p>
                <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-[#ff8240] to-[#00f99d] rounded-full"
                    style={{ width: `${continueWatchingLesson.lesson.progress?.max_percentage_watched || 0}%` }}
                  />
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  {Math.round(continueWatchingLesson.lesson.progress?.max_percentage_watched || 0)}% complete
                </p>
              </div>
            </Link>
          </div>
        )}

        {/* Filters */}
        <div className="mb-6 space-y-3">
          {/* Search */}
          <div className="relative">
            <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Search lessons..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#ff8240] focus:border-transparent transition-all"
            />
          </div>

          {/* Filter Buttons */}
          <div className="flex flex-wrap justify-center gap-2">
            {/* Chapter Filter */}
            <select
              value={selectedChapter}
              onChange={(e) => setSelectedChapter(e.target.value)}
              className="px-4 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#ff8240] focus:border-transparent"
            >
              <option value="all">All Chapters</option>
              {topic.chapters.map((chapter, idx) => (
                <option key={chapter.id} value={chapter.id}>
                  Chapter {idx + 1}: {chapter.name}
                </option>
              ))}
            </select>

            {/* Status Filters */}
            <button
              onClick={() => setFilterStatus('all')}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                filterStatus === 'all'
                  ? 'bg-gradient-to-r from-[#ff8240] to-[#00f99d] text-white'
                  : 'bg-slate-800 text-slate-400 hover:text-white border border-slate-700'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setFilterStatus('unlocked')}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                filterStatus === 'unlocked'
                  ? 'bg-gradient-to-r from-[#ff8240] to-[#00f99d] text-white'
                  : 'bg-slate-800 text-slate-400 hover:text-white border border-slate-700'
              }`}
            >
              Unlocked
            </button>
          </div>
        </div>

        {/* Lessons List */}
        <div className="space-y-4">
          {filteredChapters.length === 0 ? (
            <div className="text-center py-12 bg-slate-800 rounded-2xl border border-slate-700">
              <svg className="w-16 h-16 text-slate-600 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-slate-400">No lessons found matching your filters</p>
            </div>
          ) : (
            filteredChapters.map((chapter, chapterIndex) => {
              const isExpanded = expandedChapters.has(chapter.id);
              
              return (
              <div key={chapter.id} className="bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden">
                {/* Chapter Header - Clickable */}
                <button
                  onClick={() => toggleChapter(chapter.id)}
                  className="w-full p-4 bg-slate-800/50 border-b border-slate-700 hover:bg-slate-700/30 transition-colors text-left"
                >
                  <h2 className="font-semibold text-white flex items-center gap-2">
                    <svg 
                      className={`w-5 h-5 text-[#ff8240] transition-transform ${isExpanded ? 'rotate-90' : ''}`} 
                      fill="none" 
                      viewBox="0 0 24 24" 
                      stroke="currentColor"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                    <svg className="w-5 h-5 text-[#ff8240]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                    </svg>
                    Chapter {chapterIndex + 1}: {chapter.name}
                    <span className="ml-auto text-xs text-slate-400 font-normal">
                      {chapter.lessons.length} lesson{chapter.lessons.length !== 1 ? 's' : ''}
                    </span>
                  </h2>
                  {chapter.description && (
                    <p className="text-sm text-slate-400 mt-1 ml-12">{chapter.description}</p>
                  )}
                </button>

                {/* Lessons - Collapsible */}
                {isExpanded && (
                <div className="divide-y divide-slate-700">
                  {chapter.lessons.map((lesson, lessonIndex) => {
                    const isCompleted = (lesson.progress?.max_percentage_watched || 0) >= 90;
                    const hasProgress = (lesson.progress?.max_percentage_watched || 0) > 0;
                    
                    const content = (
                      <div className="flex items-start gap-3">
                        {/* Status Icon */}
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${
                          isCompleted
                            ? 'bg-green-500/20 text-green-400'
                            : lesson.is_unlocked
                              ? 'bg-[#ff8240]/20 text-[#ff8240]'
                              : 'bg-slate-700 text-slate-500'
                        }`}>
                          {isCompleted ? (
                            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                          ) : lesson.is_unlocked ? (
                            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M8 5v14l11-7z" />
                            </svg>
                          ) : (
                            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                            </svg>
                          )}
                        </div>

                        {/* Lesson Info */}
                        <div className="flex-1 min-w-0">
                          <h3 className={`font-medium mb-2 ${lesson.is_unlocked ? 'text-white group-hover:text-[#ff8240] transition-colors' : 'text-slate-500'}`}>
                            {lessonIndex + 1}. {lesson.title}
                          </h3>
                          <div className="flex items-center gap-2">
                            {lesson.duration_seconds && (
                              <span className="text-xs text-slate-400 flex items-center gap-1">
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                {formatDuration(lesson.duration_seconds)}
                              </span>
                            )}
                            {hasProgress && (
                              <>
                                <div className="flex-1 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                                  <div
                                    className="h-full bg-gradient-to-r from-[#ff8240] to-[#00f99d] rounded-full"
                                    style={{ width: `${lesson.progress?.max_percentage_watched || 0}%` }}
                                  />
                                </div>
                                <span className="text-xs text-slate-400 whitespace-nowrap">
                                  {Math.round(lesson.progress?.max_percentage_watched || 0)}%
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                    
                    return lesson.is_unlocked ? (
                      <Link
                        key={lesson.id}
                        href={`/lms/lessons/${lesson.id}`}
                        className="block p-4 hover:bg-slate-700/50 transition-colors cursor-pointer group"
                      >
                        {content}
                      </Link>
                    ) : (
                      <div
                        key={lesson.id}
                        className="p-4 bg-slate-800/30 cursor-not-allowed"
                      >
                        {content}
                      </div>
                    );
                  })}
                </div>
                )}
              </div>
              );
            })
          )}
        </div>
      </main>
    </div>
  );
}
