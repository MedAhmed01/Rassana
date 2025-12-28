'use client';

import { useState, useEffect } from 'react';

interface Topic {
  id: string;
  name: string;
  description?: string;
  is_free: boolean;
  display_order: number;
  chapters?: Chapter[];
}

interface Chapter {
  id: string;
  topic_id: string;
  name: string;
  description?: string;
  display_order: number;
  lessons?: Lesson[];
}

interface Lesson {
  id: string;
  chapter_id: string;
  title: string;
  description?: string;
  youtube_url: string;
  duration_seconds?: number;
  display_order: number;
}

interface Props {
  onError: (error: string) => void;
}

export function LMSTopicsSubTab({ onError }: Props) {
  const [topics, setTopics] = useState<Topic[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedTopics, setExpandedTopics] = useState<Set<string>>(new Set());
  const [expandedChapters, setExpandedChapters] = useState<Set<string>>(new Set());
  
  // Form states
  const [showTopicForm, setShowTopicForm] = useState(false);
  const [editingTopic, setEditingTopic] = useState<Topic | null>(null);
  const [topicForm, setTopicForm] = useState({ name: '', description: '', is_free: false });
  const [topicLoading, setTopicLoading] = useState(false);
  
  const [showChapterForm, setShowChapterForm] = useState<string | null>(null);
  const [editingChapter, setEditingChapter] = useState<Chapter | null>(null);
  const [chapterForm, setChapterForm] = useState({ name: '', description: '' });
  const [chapterLoading, setChapterLoading] = useState(false);

  const [showLessonForm, setShowLessonForm] = useState<string | null>(null);
  const [editingLesson, setEditingLesson] = useState<Lesson | null>(null);
  const [lessonForm, setLessonForm] = useState({ title: '', description: '', youtube_url: '', duration_seconds: '' });
  const [lessonLoading, setLessonLoading] = useState(false);

  useEffect(() => {
    loadTopics();
  }, []);

  async function loadTopics() {
    setLoading(true);
    try {
      const response = await fetch('/api/lms/admin/topics');
      if (response.ok) {
        const data = await response.json();
        setTopics(data.topics || []);
      }
    } catch (err) {
      onError('Failed to load topics');
    } finally {
      setLoading(false);
    }
  }

  function toggleTopic(topicId: string) {
    setExpandedTopics(prev => {
      const next = new Set(prev);
      if (next.has(topicId)) next.delete(topicId);
      else next.add(topicId);
      return next;
    });
  }

  function toggleChapter(chapterId: string) {
    setExpandedChapters(prev => {
      const next = new Set(prev);
      if (next.has(chapterId)) next.delete(chapterId);
      else next.add(chapterId);
      return next;
    });
  }

  // Topic CRUD
  async function handleSaveTopic(e: React.FormEvent) {
    e.preventDefault();
    setTopicLoading(true);
    try {
      const url = editingTopic 
        ? `/api/lms/admin/topics/${editingTopic.id}`
        : '/api/lms/admin/topics';
      const method = editingTopic ? 'PATCH' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(topicForm),
      });
      
      if (!response.ok) {
        const data = await response.json();
        onError(data.error || 'Failed to save topic');
        return;
      }
      
      setShowTopicForm(false);
      setEditingTopic(null);
      setTopicForm({ name: '', description: '', is_free: false });
      loadTopics();
    } catch (err) {
      onError('Failed to save topic');
    } finally {
      setTopicLoading(false);
    }
  }

  async function handleDeleteTopic(topic: Topic) {
    if (!confirm(`Delete topic "${topic.name}"? This will delete all chapters and lessons.`)) return;
    
    try {
      const response = await fetch(`/api/lms/admin/topics/${topic.id}`, { method: 'DELETE' });
      if (!response.ok) {
        const data = await response.json();
        onError(data.error || 'Failed to delete topic');
        return;
      }
      loadTopics();
    } catch (err) {
      onError('Failed to delete topic');
    }
  }

  function startEditTopic(topic: Topic) {
    setEditingTopic(topic);
    setTopicForm({ name: topic.name, description: topic.description || '', is_free: topic.is_free });
    setShowTopicForm(true);
  }

  // Chapter CRUD
  async function handleSaveChapter(e: React.FormEvent, topicId: string) {
    e.preventDefault();
    setChapterLoading(true);
    try {
      const url = editingChapter 
        ? `/api/lms/admin/chapters/${editingChapter.id}`
        : '/api/lms/admin/chapters';
      const method = editingChapter ? 'PATCH' : 'POST';
      
      const body = editingChapter 
        ? chapterForm 
        : { ...chapterForm, topic_id: topicId };
      
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      
      if (!response.ok) {
        const data = await response.json();
        onError(data.error || 'Failed to save chapter');
        return;
      }
      
      setShowChapterForm(null);
      setEditingChapter(null);
      setChapterForm({ name: '', description: '' });
      loadTopics();
    } catch (err) {
      onError('Failed to save chapter');
    } finally {
      setChapterLoading(false);
    }
  }

  async function handleDeleteChapter(chapter: Chapter) {
    if (!confirm(`Delete chapter "${chapter.name}"? This will delete all lessons.`)) return;
    
    try {
      const response = await fetch(`/api/lms/admin/chapters/${chapter.id}`, { method: 'DELETE' });
      if (!response.ok) {
        const data = await response.json();
        onError(data.error || 'Failed to delete chapter');
        return;
      }
      loadTopics();
    } catch (err) {
      onError('Failed to delete chapter');
    }
  }

  function startEditChapter(chapter: Chapter) {
    setEditingChapter(chapter);
    setChapterForm({ name: chapter.name, description: chapter.description || '' });
    setShowChapterForm(chapter.topic_id);
  }

  // Lesson CRUD
  async function handleSaveLesson(e: React.FormEvent, chapterId: string) {
    e.preventDefault();
    setLessonLoading(true);
    try {
      const url = editingLesson 
        ? `/api/lms/admin/lessons/${editingLesson.id}`
        : '/api/lms/admin/lessons';
      const method = editingLesson ? 'PATCH' : 'POST';
      
      const body = editingLesson 
        ? { 
            title: lessonForm.title,
            description: lessonForm.description || undefined,
            youtube_url: lessonForm.youtube_url,
            duration_seconds: lessonForm.duration_seconds ? parseInt(lessonForm.duration_seconds) : undefined,
          }
        : { 
            chapter_id: chapterId,
            title: lessonForm.title,
            description: lessonForm.description || undefined,
            youtube_url: lessonForm.youtube_url,
            duration_seconds: lessonForm.duration_seconds ? parseInt(lessonForm.duration_seconds) : undefined,
          };
      
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      
      if (!response.ok) {
        const data = await response.json();
        onError(data.error || 'Failed to save lesson');
        return;
      }
      
      setShowLessonForm(null);
      setEditingLesson(null);
      setLessonForm({ title: '', description: '', youtube_url: '', duration_seconds: '' });
      loadTopics();
    } catch (err) {
      onError('Failed to save lesson');
    } finally {
      setLessonLoading(false);
    }
  }

  async function handleDeleteLesson(lesson: Lesson) {
    if (!confirm(`Delete lesson "${lesson.title}"?`)) return;
    
    try {
      const response = await fetch(`/api/lms/admin/lessons/${lesson.id}`, { method: 'DELETE' });
      if (!response.ok) {
        const data = await response.json();
        onError(data.error || 'Failed to delete lesson');
        return;
      }
      loadTopics();
    } catch (err) {
      onError('Failed to delete lesson');
    }
  }

  function startEditLesson(lesson: Lesson) {
    setEditingLesson(lesson);
    setLessonForm({ 
      title: lesson.title, 
      description: lesson.description || '',
      youtube_url: lesson.youtube_url,
      duration_seconds: lesson.duration_seconds?.toString() || '',
    });
    setShowLessonForm(lesson.chapter_id);
  }

  if (loading) {
    return (
      <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-xl sm:rounded-2xl border border-slate-700/50 p-6 sm:p-8 text-center">
        <div className="w-8 h-8 border-4 border-[#ff8240] border-t-transparent rounded-full animate-spin mx-auto"></div>
        <p className="text-slate-400 mt-3 text-sm">Loading topics...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header with Add Topic Button */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-lg sm:text-xl font-bold text-slate-800">Course Topics</h2>
          <p className="text-sm text-slate-500 mt-0.5">{topics.length} topic{topics.length !== 1 ? 's' : ''} available</p>
        </div>
        <button
          onClick={() => { setShowTopicForm(true); setEditingTopic(null); setTopicForm({ name: '', description: '', is_free: false }); }}
          className="flex items-center justify-center gap-2 px-4 py-2.5 sm:py-2 bg-gradient-to-r from-[#ff8240] to-[#00f99d] text-white font-medium rounded-xl hover:opacity-90 transition-opacity shadow-lg shadow-[#ff8240]/25 active:scale-[0.98]"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          <span>Add Topic</span>
        </button>
      </div>

      {/* Topic Form Modal - Elegant Dark Theme */}
      {showTopicForm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 z-50 animate-in fade-in duration-200">
          <div className="relative w-full max-w-md animate-in zoom-in-95 duration-200">
            <div className="absolute -inset-1 bg-gradient-to-r from-orange-500 via-pink-500 to-[#00f99d] rounded-2xl sm:rounded-3xl blur-lg opacity-30"></div>
            
            <div className="relative bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-xl sm:rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto">
              {/* Header */}
              <div className="relative p-4 sm:p-6 pb-0">
                <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-br from-orange-500/20 via-pink-500/10 to-transparent"></div>
                
                <div className="relative flex items-center justify-between">
                  <div className="flex items-center gap-3 sm:gap-4">
                    <div className="relative">
                      <div className="absolute inset-0 bg-gradient-to-r from-orange-500 to-pink-500 rounded-lg sm:rounded-xl blur-lg opacity-50"></div>
                      <div className="relative w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-orange-500 to-pink-600 rounded-lg sm:rounded-xl flex items-center justify-center shadow-lg">
                        <svg className="w-5 h-5 sm:w-6 sm:h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                        </svg>
                      </div>
                    </div>
                    <div>
                      <h2 className="text-lg sm:text-xl font-bold text-white">{editingTopic ? 'Edit Topic' : 'Create Topic'}</h2>
                      <p className="text-slate-400 text-xs sm:text-sm">{editingTopic ? 'Update topic details' : 'Add a new learning topic'}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowTopicForm(false)}
                    className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-slate-800/50 flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
                  >
                    <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Form Content */}
              <form onSubmit={handleSaveTopic} className="p-4 sm:p-6 space-y-4 sm:space-y-5">
                {/* Topic Name */}
                <div className="group">
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                    Topic Name <span className="text-pink-400">*</span>
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <svg className="w-5 h-5 text-slate-500 group-focus-within:text-orange-400 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                      </svg>
                    </div>
                    <input
                      type="text"
                      placeholder="Enter topic name"
                      value={topicForm.name}
                      onChange={(e) => setTopicForm({ ...topicForm, name: e.target.value })}
                      required
                      className="w-full pl-10 pr-4 py-3 bg-slate-800/50 border border-slate-700/50 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500/50 transition-all text-sm sm:text-base"
                    />
                  </div>
                </div>

                {/* Description */}
                <div className="group">
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                    Description
                  </label>
                  <textarea
                    placeholder="Topic description..."
                    value={topicForm.description}
                    onChange={(e) => setTopicForm({ ...topicForm, description: e.target.value })}
                    rows={3}
                    className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700/50 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500/50 transition-all resize-none text-sm sm:text-base"
                  />
                </div>

                {/* Free Topic Toggle */}
                <div className="flex items-center gap-3 p-3 bg-slate-800/30 rounded-xl">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <div className="relative">
                      <input
                        type="checkbox"
                        checked={topicForm.is_free}
                        onChange={(e) => setTopicForm({ ...topicForm, is_free: e.target.checked })}
                        className="sr-only"
                      />
                      <div className={`w-11 h-6 rounded-full transition-colors ${topicForm.is_free ? 'bg-gradient-to-r from-green-500 to-emerald-500' : 'bg-slate-700'}`}>
                        <div className={`w-5 h-5 bg-white rounded-full shadow-md transform transition-transform mt-0.5 ${topicForm.is_free ? 'translate-x-5.5 ml-0.5' : 'translate-x-0.5'}`}></div>
                      </div>
                    </div>
                    <div>
                      <span className="text-sm text-slate-300">Free topic</span>
                      <p className="text-xs text-slate-500">Accessible to all students without a package</p>
                    </div>
                  </label>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowTopicForm(false)}
                    className="flex-1 px-4 py-3 bg-slate-800 text-slate-300 font-medium rounded-xl hover:bg-slate-700 transition-colors text-sm sm:text-base"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={topicLoading}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-orange-500 to-pink-500 text-white font-semibold rounded-xl hover:shadow-lg hover:shadow-orange-500/25 transition-all disabled:opacity-50 text-sm sm:text-base"
                  >
                    {topicLoading ? (
                      <>
                        <div className="w-4 h-4 sm:w-5 sm:h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        <span>Saving...</span>
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={editingTopic ? "M5 13l4 4L19 7" : "M12 4v16m8-8H4"} />
                        </svg>
                        <span>{editingTopic ? 'Save Changes' : 'Create Topic'}</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Chapter Form Modal - Elegant Dark Theme */}
      {showChapterForm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 z-50 animate-in fade-in duration-200">
          <div className="relative w-full max-w-md animate-in zoom-in-95 duration-200">
            <div className="absolute -inset-1 bg-gradient-to-r from-orange-500 via-pink-500 to-[#00f99d] rounded-2xl sm:rounded-3xl blur-lg opacity-30"></div>
            
            <div className="relative bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-xl sm:rounded-2xl shadow-2xl overflow-hidden">
              {/* Header */}
              <div className="relative p-4 sm:p-6 pb-0">
                <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-br from-orange-500/20 via-pink-500/10 to-transparent"></div>
                
                <div className="relative flex items-center justify-between">
                  <div className="flex items-center gap-3 sm:gap-4">
                    <div className="relative">
                      <div className="absolute inset-0 bg-gradient-to-r from-orange-500 to-pink-500 rounded-lg sm:rounded-xl blur-lg opacity-50"></div>
                      <div className="relative w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-orange-500 to-pink-600 rounded-lg sm:rounded-xl flex items-center justify-center shadow-lg">
                        <svg className="w-5 h-5 sm:w-6 sm:h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                        </svg>
                      </div>
                    </div>
                    <div>
                      <h2 className="text-lg sm:text-xl font-bold text-white">{editingChapter ? 'Edit Chapter' : 'Create Chapter'}</h2>
                      <p className="text-slate-400 text-xs sm:text-sm">{editingChapter ? 'Update chapter details' : 'Add a new chapter'}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowChapterForm(null)}
                    className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-slate-800/50 flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
                  >
                    <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Form Content */}
              <form onSubmit={(e) => handleSaveChapter(e, showChapterForm)} className="p-4 sm:p-6 space-y-4 sm:space-y-5">
                {/* Chapter Name */}
                <div className="group">
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                    Chapter Name <span className="text-pink-400">*</span>
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <svg className="w-5 h-5 text-slate-500 group-focus-within:text-orange-400 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                      </svg>
                    </div>
                    <input
                      type="text"
                      placeholder="Enter chapter name"
                      value={chapterForm.name}
                      onChange={(e) => setChapterForm({ ...chapterForm, name: e.target.value })}
                      required
                      className="w-full pl-10 pr-4 py-3 bg-slate-800/50 border border-slate-700/50 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500/50 transition-all text-sm sm:text-base"
                    />
                  </div>
                </div>

                {/* Description */}
                <div className="group">
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                    Description
                  </label>
                  <textarea
                    placeholder="Chapter description (optional)..."
                    value={chapterForm.description}
                    onChange={(e) => setChapterForm({ ...chapterForm, description: e.target.value })}
                    rows={2}
                    className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700/50 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500/50 transition-all resize-none text-sm sm:text-base"
                  />
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowChapterForm(null)}
                    className="flex-1 px-4 py-3 bg-slate-800 text-slate-300 font-medium rounded-xl hover:bg-slate-700 transition-colors text-sm sm:text-base"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={chapterLoading}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-orange-500 to-pink-500 text-white font-semibold rounded-xl hover:shadow-lg hover:shadow-orange-500/25 transition-all disabled:opacity-50 text-sm sm:text-base"
                  >
                    {chapterLoading ? (
                      <>
                        <div className="w-4 h-4 sm:w-5 sm:h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        <span>Saving...</span>
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={editingChapter ? "M5 13l4 4L19 7" : "M12 4v16m8-8H4"} />
                        </svg>
                        <span>{editingChapter ? 'Save Changes' : 'Create Chapter'}</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Lesson Form Modal - Elegant Dark Theme */}
      {showLessonForm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 z-50 animate-in fade-in duration-200">
          <div className="relative w-full max-w-md animate-in zoom-in-95 duration-200">
            <div className="absolute -inset-1 bg-gradient-to-r from-orange-500 via-pink-500 to-[#00f99d] rounded-2xl sm:rounded-3xl blur-lg opacity-30"></div>
            
            <div className="relative bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-xl sm:rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto">
              {/* Header */}
              <div className="relative p-4 sm:p-6 pb-0">
                <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-br from-orange-500/20 via-pink-500/10 to-transparent"></div>
                
                <div className="relative flex items-center justify-between">
                  <div className="flex items-center gap-3 sm:gap-4">
                    <div className="relative">
                      <div className="absolute inset-0 bg-gradient-to-r from-red-500 to-pink-500 rounded-lg sm:rounded-xl blur-lg opacity-50"></div>
                      <div className="relative w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-red-500 to-pink-600 rounded-lg sm:rounded-xl flex items-center justify-center shadow-lg">
                        <svg className="w-5 h-5 sm:w-6 sm:h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M19.615 3.184c-3.604-.246-11.631-.245-15.23 0-3.897.266-4.356 2.62-4.385 8.816.029 6.185.484 8.549 4.385 8.816 3.6.245 11.626.246 15.23 0 3.897-.266 4.356-2.62 4.385-8.816-.029-6.185-.484-8.549-4.385-8.816zm-10.615 12.816v-8l8 3.993-8 4.007z"/>
                        </svg>
                      </div>
                    </div>
                    <div>
                      <h2 className="text-lg sm:text-xl font-bold text-white">{editingLesson ? 'Edit Lesson' : 'Create Lesson'}</h2>
                      <p className="text-slate-400 text-xs sm:text-sm">{editingLesson ? 'Update lesson details' : 'Add a new video lesson'}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowLessonForm(null)}
                    className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-slate-800/50 flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
                  >
                    <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Form Content */}
              <form onSubmit={(e) => handleSaveLesson(e, showLessonForm)} className="p-4 sm:p-6 space-y-4 sm:space-y-5">
                {/* Lesson Title */}
                <div className="group">
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                    Lesson Title <span className="text-pink-400">*</span>
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <svg className="w-5 h-5 text-slate-500 group-focus-within:text-orange-400 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </div>
                    <input
                      type="text"
                      placeholder="Enter lesson title"
                      value={lessonForm.title}
                      onChange={(e) => setLessonForm({ ...lessonForm, title: e.target.value })}
                      required
                      className="w-full pl-10 pr-4 py-3 bg-slate-800/50 border border-slate-700/50 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500/50 transition-all text-sm sm:text-base"
                    />
                  </div>
                </div>

                {/* YouTube URL */}
                <div className="group">
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                    YouTube URL <span className="text-pink-400">*</span>
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <svg className="w-5 h-5 text-red-500" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M19.615 3.184c-3.604-.246-11.631-.245-15.23 0-3.897.266-4.356 2.62-4.385 8.816.029 6.185.484 8.549 4.385 8.816 3.6.245 11.626.246 15.23 0 3.897-.266 4.356-2.62 4.385-8.816-.029-6.185-.484-8.549-4.385-8.816zm-10.615 12.816v-8l8 3.993-8 4.007z"/>
                      </svg>
                    </div>
                    <input
                      type="url"
                      placeholder="https://youtube.com/watch?v=..."
                      value={lessonForm.youtube_url}
                      onChange={(e) => setLessonForm({ ...lessonForm, youtube_url: e.target.value })}
                      required
                      className="w-full pl-10 pr-4 py-3 bg-slate-800/50 border border-slate-700/50 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500/50 transition-all text-sm sm:text-base"
                    />
                  </div>
                </div>

                {/* Duration */}
                <div className="group">
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                    Duration (seconds)
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <svg className="w-5 h-5 text-slate-500 group-focus-within:text-orange-400 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <input
                      type="number"
                      placeholder="e.g., 600 for 10 minutes"
                      value={lessonForm.duration_seconds}
                      onChange={(e) => setLessonForm({ ...lessonForm, duration_seconds: e.target.value })}
                      className="w-full pl-10 pr-4 py-3 bg-slate-800/50 border border-slate-700/50 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500/50 transition-all text-sm sm:text-base"
                    />
                  </div>
                </div>

                {/* Description */}
                <div className="group">
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                    Description
                  </label>
                  <textarea
                    placeholder="Lesson description (optional)..."
                    value={lessonForm.description}
                    onChange={(e) => setLessonForm({ ...lessonForm, description: e.target.value })}
                    rows={2}
                    className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700/50 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500/50 transition-all resize-none text-sm sm:text-base"
                  />
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowLessonForm(null)}
                    className="flex-1 px-4 py-3 bg-slate-800 text-slate-300 font-medium rounded-xl hover:bg-slate-700 transition-colors text-sm sm:text-base"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={lessonLoading}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-orange-500 to-pink-500 text-white font-semibold rounded-xl hover:shadow-lg hover:shadow-orange-500/25 transition-all disabled:opacity-50 text-sm sm:text-base"
                  >
                    {lessonLoading ? (
                      <>
                        <div className="w-4 h-4 sm:w-5 sm:h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        <span>Saving...</span>
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={editingLesson ? "M5 13l4 4L19 7" : "M12 4v16m8-8H4"} />
                        </svg>
                        <span>{editingLesson ? 'Save Changes' : 'Create Lesson'}</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Topics List - Modern Card-Based Mobile-Friendly Design */}
      {topics.length === 0 ? (
        <div className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-xl sm:rounded-2xl border border-slate-700/50 p-6 sm:p-8 text-center">
          <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-[#ff8240]/10 to-transparent rounded-full blur-2xl"></div>
          <div className="relative">
            <div className="w-16 h-16 mx-auto mb-4 bg-slate-800 rounded-2xl flex items-center justify-center">
              <svg className="w-8 h-8 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
            </div>
            <p className="text-slate-400 text-sm sm:text-base">No topics yet. Create your first topic to get started.</p>
          </div>
        </div>
      ) : (
        <div className="space-y-3 sm:space-y-4">
          {topics.map(topic => (
            <div key={topic.id} className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-xl sm:rounded-2xl border border-slate-700/50 transition-all duration-300 hover:border-slate-600/50">
              {/* Topic Header */}
              <div className="p-3 sm:p-4 flex items-start sm:items-center gap-3">
                {/* Expand/Collapse Button */}
                <button 
                  onClick={() => toggleTopic(topic.id)} 
                  className="flex-shrink-0 w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-slate-800/80 flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-700 transition-all active:scale-95"
                >
                  <svg className={`w-4 h-4 sm:w-5 sm:h-5 transition-transform duration-200 ${expandedTopics.has(topic.id) ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>

                {/* Topic Info */}
                <button onClick={() => toggleTopic(topic.id)} className="flex-1 text-left min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-semibold text-white text-sm sm:text-base truncate">{topic.name}</h3>
                    {topic.is_free && (
                      <span className="flex-shrink-0 px-2 py-0.5 text-xs font-medium bg-gradient-to-r from-green-500/20 to-emerald-500/20 text-green-400 rounded-full border border-green-500/30">
                        Free
                      </span>
                    )}
                  </div>
                  {topic.description && (
                    <p className="text-xs sm:text-sm text-slate-400 mt-0.5 line-clamp-1">{topic.description}</p>
                  )}
                  <div className="flex items-center gap-2 mt-1.5">
                    <span className="text-xs text-slate-500 flex items-center gap-1">
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                      </svg>
                      {topic.chapters?.length || 0} chapters
                    </span>
                  </div>
                </button>

                {/* Action Buttons */}
                <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
                  <button 
                    onClick={() => startEditTopic(topic)} 
                    className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-slate-800/80 flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-700 transition-all active:scale-95"
                    title="Edit topic"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                    </svg>
                  </button>
                  <button 
                    onClick={() => handleDeleteTopic(topic)} 
                    className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-slate-800/80 flex items-center justify-center text-red-400 hover:text-red-300 hover:bg-red-500/20 transition-all active:scale-95"
                    title="Delete topic"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Chapters - Expandable Section */}
              {expandedTopics.has(topic.id) && (
                <div className="px-3 sm:px-4 pb-3 sm:pb-4 space-y-2 sm:space-y-3 animate-in slide-in-from-top-2 duration-200">
                  {/* Add Chapter Button */}
                  <button
                    onClick={() => { setShowChapterForm(topic.id); setEditingChapter(null); setChapterForm({ name: '', description: '' }); }}
                    className="w-full py-2.5 sm:py-3 border-2 border-dashed border-slate-700 rounded-xl text-slate-400 hover:border-[#ff8240] hover:text-[#ff8240] transition-all flex items-center justify-center gap-2 active:scale-[0.99]"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    <span className="text-sm font-medium">Add Chapter</span>
                  </button>

                  {/* Chapters List */}
                  {topic.chapters?.map(chapter => (
                    <div key={chapter.id} className="bg-slate-800/50 rounded-xl border border-slate-700/50 overflow-hidden">
                      {/* Chapter Header */}
                      <div className="p-2.5 sm:p-3 flex items-center gap-2 sm:gap-3">
                        <button 
                          onClick={() => toggleChapter(chapter.id)} 
                          className="flex-shrink-0 w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-slate-700/50 flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-600 transition-all"
                        >
                          <svg className={`w-3.5 h-3.5 sm:w-4 sm:h-4 transition-transform duration-200 ${expandedChapters.has(chapter.id) ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </button>
                        
                        <button onClick={() => toggleChapter(chapter.id)} className="flex-1 text-left min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-slate-200 text-sm truncate">{chapter.name}</span>
                            <span className="flex-shrink-0 text-xs text-slate-500 bg-slate-700/50 px-2 py-0.5 rounded-full">
                              {chapter.lessons?.length || 0} lessons
                            </span>
                          </div>
                        </button>
                        
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <button 
                            onClick={() => startEditChapter(chapter)} 
                            className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-600 transition-all"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                            </svg>
                          </button>
                          <button 
                            onClick={() => handleDeleteChapter(chapter)} 
                            className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center text-red-400 hover:text-red-300 hover:bg-red-500/20 transition-all"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </div>

                      {/* Lessons - Expandable Section */}
                      {expandedChapters.has(chapter.id) && (
                        <div className="px-2.5 sm:px-3 pb-2.5 sm:pb-3 space-y-2 animate-in slide-in-from-top-2 duration-200">
                          {/* Add Lesson Button */}
                          <button
                            onClick={() => { setShowLessonForm(chapter.id); setEditingLesson(null); setLessonForm({ title: '', description: '', youtube_url: '', duration_seconds: '' }); }}
                            className="w-full py-2 border border-dashed border-slate-600 rounded-lg text-slate-400 hover:border-[#ff8240] hover:text-[#ff8240] transition-all text-sm flex items-center justify-center gap-1.5 active:scale-[0.99]"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                            <span>Add Lesson</span>
                          </button>

                          {/* Lessons List */}
                          {chapter.lessons?.map(lesson => (
                            <div key={lesson.id} className="p-2.5 sm:p-3 bg-slate-700/30 rounded-lg border border-slate-600/30 flex items-center gap-2 sm:gap-3">
                              {/* YouTube Icon */}
                              <div className="flex-shrink-0 w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-red-500/20 flex items-center justify-center">
                                <svg className="w-4 h-4 sm:w-5 sm:h-5 text-red-400" fill="currentColor" viewBox="0 0 24 24">
                                  <path d="M19.615 3.184c-3.604-.246-11.631-.245-15.23 0-3.897.266-4.356 2.62-4.385 8.816.029 6.185.484 8.549 4.385 8.816 3.6.245 11.626.246 15.23 0 3.897-.266 4.356-2.62 4.385-8.816-.029-6.185-.484-8.549-4.385-8.816zm-10.615 12.816v-8l8 3.993-8 4.007z"/>
                                </svg>
                              </div>
                              
                              {/* Lesson Info */}
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-slate-200 truncate">{lesson.title}</p>
                                {lesson.duration_seconds && (
                                  <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    {Math.floor(lesson.duration_seconds / 60)}:{(lesson.duration_seconds % 60).toString().padStart(2, '0')}
                                  </p>
                                )}
                              </div>
                              
                              {/* Action Buttons */}
                              <div className="flex items-center gap-1 flex-shrink-0">
                                <button 
                                  onClick={() => startEditLesson(lesson)} 
                                  className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-600 transition-all"
                                >
                                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                  </svg>
                                </button>
                                <button 
                                  onClick={() => handleDeleteLesson(lesson)} 
                                  className="w-7 h-7 rounded-lg flex items-center justify-center text-red-400 hover:text-red-300 hover:bg-red-500/20 transition-all"
                                >
                                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                  </svg>
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
