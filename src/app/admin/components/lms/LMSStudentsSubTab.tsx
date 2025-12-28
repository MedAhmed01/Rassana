'use client';

import { useState, useEffect } from 'react';

interface LMSStudent {
  student_id: string;
  username: string;
  email: string;
  phone?: string;
  class?: string;
  is_active: boolean;
  packages: {
    id: string;
    package_id: string;
    package_name: string;
    starts_at: string;
    expires_at: string;
    is_active: boolean;
  }[];
}

interface Package {
  id: string;
  name: string;
}

interface LessonAccess {
  lesson_id: string;
  lesson_title: string;
  chapter_name: string;
  is_unlocked: boolean;
  progress_percentage: number;
}

interface Props {
  onError: (error: string) => void;
}

export function LMSStudentsSubTab({ onError }: Props) {
  const [students, setStudents] = useState<LMSStudent[]>([]);
  const [packages, setPackages] = useState<Package[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [packageFilter, setPackageFilter] = useState<string>('all');
  
  // Add/Edit student modal state
  const [studentModalOpen, setStudentModalOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<LMSStudent | null>(null);
  const [studentLoading, setStudentLoading] = useState(false);
  const [studentForm, setStudentForm] = useState({
    username: '',
    email: '',
    phone: '',
    class: '',
    password: '',
    is_active: true,
  });

  // Delete confirmation state
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [studentToDelete, setStudentToDelete] = useState<LMSStudent | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  
  // Access modal state
  const [accessModalOpen, setAccessModalOpen] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<LMSStudent | null>(null);
  const [selectedTopicId, setSelectedTopicId] = useState<string>('');
  const [lessonAccess, setLessonAccess] = useState<LessonAccess[]>([]);
  const [selectedLessons, setSelectedLessons] = useState<Set<string>>(new Set());
  const [accessLoading, setAccessLoading] = useState(false);

  useEffect(() => {
    loadStudents();
    loadPackages();
  }, []);

  async function loadStudents() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (searchQuery) params.set('search', searchQuery);
      if (packageFilter !== 'all') params.set('topicId', packageFilter);
      
      const response = await fetch(`/api/lms/admin/students?${params}`);
      if (response.ok) {
        const data = await response.json();
        setStudents(data.students || []);
      }
    } catch (err) {
      onError('Failed to load students');
    } finally {
      setLoading(false);
    }
  }

  async function loadPackages() {
    try {
      const response = await fetch('/api/lms/admin/packages');
      if (response.ok) {
        const data = await response.json();
        setPackages(data.packages || []);
      }
    } catch (err) {
      console.error('Failed to load packages');
    }
  }

  useEffect(() => {
    const debounce = setTimeout(() => {
      loadStudents();
    }, 300);
    return () => clearTimeout(debounce);
  }, [searchQuery, packageFilter]);

  function openAddModal() {
    setEditingStudent(null);
    setStudentForm({ username: '', email: '', phone: '', class: '', password: '', is_active: true });
    setStudentModalOpen(true);
  }

  function openEditModal(student: LMSStudent) {
    setEditingStudent(student);
    setStudentForm({
      username: student.username,
      email: student.email,
      phone: student.phone || '',
      class: student.class || '',
      password: '',
      is_active: student.is_active,
    });
    setStudentModalOpen(true);
  }

  async function handleSaveStudent(e: React.FormEvent) {
    e.preventDefault();
    setStudentLoading(true);
    
    try {
      const url = editingStudent 
        ? `/api/lms/admin/students/${editingStudent.student_id}`
        : '/api/lms/admin/students';
      const method = editingStudent ? 'PATCH' : 'POST';
      
      const body: Record<string, unknown> = {
        username: studentForm.username,
        email: studentForm.email,
        phone: studentForm.phone || undefined,
        class: studentForm.class || undefined,
        is_active: studentForm.is_active,
      };
      
      if (studentForm.password) {
        body.password = studentForm.password;
      }
      
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      
      if (!response.ok) {
        const data = await response.json();
        onError(data.error || 'Failed to save student');
        return;
      }
      
      setStudentModalOpen(false);
      loadStudents();
    } catch (err) {
      onError('Failed to save student');
    } finally {
      setStudentLoading(false);
    }
  }

  function openDeleteModal(student: LMSStudent) {
    setStudentToDelete(student);
    setDeleteModalOpen(true);
  }

  async function handleDeleteStudent() {
    if (!studentToDelete) return;
    
    setDeleteLoading(true);
    try {
      const response = await fetch(`/api/lms/admin/students/${studentToDelete.student_id}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        const data = await response.json();
        onError(data.error || 'Failed to delete student');
        return;
      }
      
      setDeleteModalOpen(false);
      setStudentToDelete(null);
      loadStudents();
    } catch (err) {
      onError('Failed to delete student');
    } finally {
      setDeleteLoading(false);
    }
  }

  async function openAccessModal(student: LMSStudent, topicId: string) {
    setSelectedStudent(student);
    setSelectedTopicId(topicId);
    setAccessModalOpen(true);
    setAccessLoading(true);
    
    try {
      const response = await fetch(`/api/lms/admin/students/${student.student_id}/progress?topicId=${topicId}`);
      if (response.ok) {
        const data = await response.json();
        setLessonAccess(data.lessons || []);
        const unlockedIds = (data.lessons || [])
          .filter((l: LessonAccess) => l.is_unlocked)
          .map((l: LessonAccess) => l.lesson_id) as string[];
        setSelectedLessons(new Set(unlockedIds));
      }
    } catch (err) {
      onError('Failed to load lesson access');
    } finally {
      setAccessLoading(false);
    }
  }

  function toggleLessonSelection(lessonId: string) {
    setSelectedLessons(prev => {
      const next = new Set(prev);
      if (next.has(lessonId)) {
        next.delete(lessonId);
      } else {
        next.add(lessonId);
      }
      return next;
    });
  }

  function selectAll() {
    setSelectedLessons(new Set(lessonAccess.map(l => l.lesson_id)));
  }

  function deselectAll() {
    setSelectedLessons(new Set());
  }

  async function handleSaveAccess() {
    if (!selectedStudent) return;
    
    setAccessLoading(true);
    try {
      const toUnlock = Array.from(selectedLessons);
      if (toUnlock.length > 0) {
        await fetch('/api/lms/admin/access/unlock', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            student_id: selectedStudent.student_id,
            lesson_ids: toUnlock,
          }),
        });
      }
      
      const toLock = lessonAccess
        .filter(l => l.is_unlocked && !selectedLessons.has(l.lesson_id))
        .map(l => l.lesson_id);
      
      if (toLock.length > 0) {
        await fetch('/api/lms/admin/access/lock', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            student_id: selectedStudent.student_id,
            lesson_ids: toLock,
          }),
        });
      }
      
      setAccessModalOpen(false);
      loadStudents();
    } catch (err) {
      onError('Failed to save access changes');
    } finally {
      setAccessLoading(false);
    }
  }

  const lessonsByChapter = lessonAccess.reduce((acc, lesson) => {
    if (!acc[lesson.chapter_name]) {
      acc[lesson.chapter_name] = [];
    }
    acc[lesson.chapter_name].push(lesson);
    return acc;
  }, {} as Record<string, LessonAccess[]>);

  // Suppress unused variable warnings
  void selectedTopicId;
  void openAccessModal;

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header with Search, Filter, and Add Button */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h2 className="text-lg sm:text-xl font-bold text-slate-800">LMS Students</h2>
            <p className="text-sm text-slate-500 mt-0.5">{students.length} student{students.length !== 1 ? 's' : ''} registered</p>
          </div>
          <button
            onClick={openAddModal}
            className="flex items-center justify-center gap-2 px-4 py-2.5 sm:py-2 bg-gradient-to-r from-[#ff8240] to-[#00f99d] text-white font-medium rounded-xl hover:opacity-90 transition-opacity shadow-lg shadow-[#ff8240]/25 active:scale-[0.98]"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            <span>Add Student</span>
          </button>
        </div>
        
        {/* Search and Filter */}
        <div className="relative">
          <div className="absolute -inset-1 bg-gradient-to-r from-[#ff8240]/10 via-[#00f99d]/10 to-[#ff8240]/10 rounded-2xl blur-lg opacity-50"></div>
          <div className="relative bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-xl p-3 sm:p-4 border border-slate-700/50">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1 relative">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  type="text"
                  placeholder="Search by username, email, or phone..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-800/50 border border-slate-700/50 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500/50 transition-all text-sm"
                />
              </div>
              <select
                value={packageFilter}
                onChange={(e) => setPackageFilter(e.target.value)}
                className="px-4 py-2.5 bg-slate-800/50 border border-slate-700/50 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-orange-500/50 text-sm"
              >
                <option value="all">All Packages</option>
                {packages.map(pkg => (
                  <option key={pkg.id} value={pkg.id}>{pkg.name}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Students List - Modern Card-Based Mobile-Friendly Design */}
      {loading ? (
        <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-xl sm:rounded-2xl border border-slate-700/50 p-6 sm:p-8 text-center">
          <div className="w-8 h-8 border-4 border-[#ff8240] border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-slate-400 mt-3 text-sm">Loading students...</p>
        </div>
      ) : students.length === 0 ? (
        <div className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-xl sm:rounded-2xl border border-slate-700/50 p-6 sm:p-8 text-center">
          <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-[#ff8240]/10 to-transparent rounded-full blur-2xl"></div>
          <div className="relative">
            <div className="w-16 h-16 mx-auto mb-4 bg-slate-800 rounded-2xl flex items-center justify-center">
              <svg className="w-8 h-8 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            </div>
            <p className="text-slate-400 text-sm sm:text-base">No students found. Click &quot;Add Student&quot; to create one.</p>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {students.map((student) => (
            <div key={student.student_id} className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-xl sm:rounded-2xl border border-slate-700/50 transition-all duration-300 hover:border-slate-600/50">
              <div className="p-3 sm:p-4">
                {/* Mobile Layout */}
                <div className="flex items-start gap-3">
                  {/* Avatar */}
                  <div className="flex-shrink-0 w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-br from-orange-500/20 to-pink-500/20 flex items-center justify-center">
                    <span className="text-lg sm:text-xl font-bold text-orange-400">
                      {student.username.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  
                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-white text-sm sm:text-base truncate">{student.username}</h3>
                      <span className={`flex-shrink-0 px-2 py-0.5 text-xs font-medium rounded-full ${
                        student.is_active 
                          ? 'bg-green-500/20 text-green-400 border border-green-500/30' 
                          : 'bg-slate-700 text-slate-400'
                      }`}>
                        {student.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                    
                    <p className="text-xs sm:text-sm text-slate-400 truncate mt-0.5">{student.email}</p>
                    
                    {/* Contact & Class Info */}
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-xs text-slate-500">
                      {student.phone && (
                        <span className="flex items-center gap-1">
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                          </svg>
                          {student.phone}
                        </span>
                      )}
                      {student.class && (
                        <span className="flex items-center gap-1">
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                          </svg>
                          {student.class}
                        </span>
                      )}
                    </div>
                    
                    {/* Packages */}
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {student.packages.length === 0 ? (
                        <span className="text-xs text-slate-500">No packages assigned</span>
                      ) : (
                        student.packages.map(pkg => (
                          <span
                            key={pkg.id}
                            className={`px-2 py-0.5 text-xs rounded-full ${
                              pkg.is_active 
                                ? 'bg-gradient-to-r from-green-500/20 to-emerald-500/20 text-green-400 border border-green-500/30' 
                                : 'bg-red-500/20 text-red-400 border border-red-500/30'
                            }`}
                            title={`Expires: ${new Date(pkg.expires_at).toLocaleDateString()}`}
                          >
                            {pkg.package_name}
                          </span>
                        ))
                      )}
                    </div>
                  </div>
                  
                  {/* Action Buttons */}
                  <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
                    <button
                      onClick={() => openEditModal(student)}
                      className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-slate-800/80 flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-700 transition-all active:scale-95"
                      title="Edit student"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => openDeleteModal(student)}
                      className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-slate-800/80 flex items-center justify-center text-red-400 hover:text-red-300 hover:bg-red-500/20 transition-all active:scale-95"
                      title="Delete student"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit Student Modal - Elegant Dark Theme */}
      {studentModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 z-50 animate-in fade-in duration-200">
          <div className="relative w-full max-w-lg animate-in zoom-in-95 duration-200">
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
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                      </div>
                    </div>
                    <div>
                      <h2 className="text-lg sm:text-xl font-bold text-white">{editingStudent ? 'Edit Student' : 'Add New Student'}</h2>
                      <p className="text-slate-400 text-xs sm:text-sm">{editingStudent ? 'Update student information' : 'Create a new LMS student account'}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setStudentModalOpen(false)}
                    className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-slate-800/50 flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
                  >
                    <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Form Content */}
              <div className="p-4 sm:p-6">
                <form onSubmit={handleSaveStudent} className="space-y-4 sm:space-y-5">
                  {/* Username & Email Row */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="group">
                      <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                        Username <span className="text-pink-400">*</span>
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <svg className="w-5 h-5 text-slate-500 group-focus-within:text-orange-400 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                          </svg>
                        </div>
                        <input
                          type="text"
                          placeholder="Enter username"
                          value={studentForm.username}
                          onChange={(e) => setStudentForm({ ...studentForm, username: e.target.value })}
                          required
                          className="w-full pl-10 pr-4 py-3 bg-slate-800/50 border border-slate-700/50 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500/50 transition-all text-sm sm:text-base"
                        />
                      </div>
                    </div>

                    <div className="group">
                      <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                        Email <span className="text-pink-400">*</span>
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <svg className="w-5 h-5 text-slate-500 group-focus-within:text-orange-400 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                          </svg>
                        </div>
                        <input
                          type="email"
                          placeholder="Enter email"
                          value={studentForm.email}
                          onChange={(e) => setStudentForm({ ...studentForm, email: e.target.value })}
                          required
                          className="w-full pl-10 pr-4 py-3 bg-slate-800/50 border border-slate-700/50 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500/50 transition-all text-sm sm:text-base"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Phone & Class Row */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="group">
                      <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                        Phone Number
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <svg className="w-5 h-5 text-slate-500 group-focus-within:text-orange-400 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                          </svg>
                        </div>
                        <input
                          type="tel"
                          placeholder="Enter phone number"
                          value={studentForm.phone}
                          onChange={(e) => setStudentForm({ ...studentForm, phone: e.target.value })}
                          className="w-full pl-10 pr-4 py-3 bg-slate-800/50 border border-slate-700/50 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500/50 transition-all text-sm sm:text-base"
                        />
                      </div>
                    </div>

                    <div className="group">
                      <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                        Class
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <svg className="w-5 h-5 text-slate-500 group-focus-within:text-orange-400 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                          </svg>
                        </div>
                        <input
                          type="text"
                          placeholder="e.g., Grade 10, Class A"
                          value={studentForm.class}
                          onChange={(e) => setStudentForm({ ...studentForm, class: e.target.value })}
                          className="w-full pl-10 pr-4 py-3 bg-slate-800/50 border border-slate-700/50 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500/50 transition-all text-sm sm:text-base"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Password */}
                  <div className="group">
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                      Password {!editingStudent && <span className="text-pink-400">*</span>}
                      {editingStudent && <span className="text-slate-500 text-xs normal-case ml-1">(leave empty to keep current)</span>}
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <svg className="w-5 h-5 text-slate-500 group-focus-within:text-orange-400 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                        </svg>
                      </div>
                      <input
                        type="password"
                        placeholder={editingStudent ? "Enter new password" : "Enter password (min 6 characters)"}
                        value={studentForm.password}
                        onChange={(e) => setStudentForm({ ...studentForm, password: e.target.value })}
                        required={!editingStudent}
                        minLength={6}
                        className="w-full pl-10 pr-4 py-3 bg-slate-800/50 border border-slate-700/50 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500/50 transition-all text-sm sm:text-base"
                      />
                    </div>
                  </div>

                  {/* Active Status Toggle */}
                  {editingStudent && (
                    <div className="flex items-center gap-3 p-3 bg-slate-800/30 rounded-xl">
                      <label className="flex items-center gap-3 cursor-pointer">
                        <div className="relative">
                          <input
                            type="checkbox"
                            checked={studentForm.is_active}
                            onChange={(e) => setStudentForm({ ...studentForm, is_active: e.target.checked })}
                            className="sr-only"
                          />
                          <div className={`w-11 h-6 rounded-full transition-colors ${studentForm.is_active ? 'bg-gradient-to-r from-orange-500 to-pink-500' : 'bg-slate-700'}`}>
                            <div className={`w-5 h-5 bg-white rounded-full shadow-md transform transition-transform mt-0.5 ${studentForm.is_active ? 'translate-x-5.5 ml-0.5' : 'translate-x-0.5'}`}></div>
                          </div>
                        </div>
                        <span className="text-sm text-slate-300">Account is active</span>
                      </label>
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="flex gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setStudentModalOpen(false)}
                      className="flex-1 px-4 py-3 bg-slate-800 text-slate-300 font-medium rounded-xl hover:bg-slate-700 transition-colors text-sm sm:text-base"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={studentLoading}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-orange-500 to-pink-500 text-white font-semibold rounded-xl hover:shadow-lg hover:shadow-orange-500/25 transition-all disabled:opacity-50 text-sm sm:text-base"
                    >
                      {studentLoading ? (
                        <>
                          <div className="w-4 h-4 sm:w-5 sm:h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                          <span>Saving...</span>
                        </>
                      ) : (
                        <>
                          <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={editingStudent ? "M5 13l4 4L19 7" : "M12 4v16m8-8H4"} />
                          </svg>
                          <span>{editingStudent ? 'Save Changes' : 'Add Student'}</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal - Elegant Dark Theme */}
      {deleteModalOpen && studentToDelete && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 z-50 animate-in fade-in duration-200">
          <div className="relative w-full max-w-md animate-in zoom-in-95 duration-200">
            <div className="absolute -inset-1 bg-gradient-to-r from-red-500 via-pink-500 to-red-500 rounded-2xl sm:rounded-3xl blur-lg opacity-30"></div>
            
            <div className="relative bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-xl sm:rounded-2xl shadow-2xl overflow-hidden">
              <div className="relative p-4 sm:p-6">
                <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-br from-red-500/20 via-pink-500/10 to-transparent"></div>
                
                <div className="relative flex items-center gap-3 sm:gap-4 mb-4">
                  <div className="relative">
                    <div className="absolute inset-0 bg-gradient-to-r from-red-500 to-pink-500 rounded-lg sm:rounded-xl blur-lg opacity-50"></div>
                    <div className="relative w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-red-500 to-pink-600 rounded-lg sm:rounded-xl flex items-center justify-center shadow-lg">
                      <svg className="w-5 h-5 sm:w-6 sm:h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                    </div>
                  </div>
                  <div>
                    <h3 className="text-lg sm:text-xl font-bold text-white">Delete Student</h3>
                    <p className="text-slate-400 text-xs sm:text-sm">This action cannot be undone</p>
                  </div>
                </div>
                
                <p className="text-slate-300 mb-6 text-sm sm:text-base">
                  Are you sure you want to delete <span className="font-semibold text-white">{studentToDelete.username}</span>? 
                  This will also delete all their package assignments, lesson access, and watch progress.
                </p>
                
                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      setDeleteModalOpen(false);
                      setStudentToDelete(null);
                    }}
                    className="flex-1 px-4 py-3 bg-slate-800 text-slate-300 font-medium rounded-xl hover:bg-slate-700 transition-colors text-sm sm:text-base"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleDeleteStudent}
                    disabled={deleteLoading}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-red-500 to-pink-500 text-white font-semibold rounded-xl hover:shadow-lg hover:shadow-red-500/25 transition-all disabled:opacity-50 text-sm sm:text-base"
                  >
                    {deleteLoading ? (
                      <>
                        <div className="w-4 h-4 sm:w-5 sm:h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        <span>Deleting...</span>
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                        <span>Delete Student</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Access Modal - Elegant Dark Theme */}
      {accessModalOpen && selectedStudent && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 z-50 animate-in fade-in duration-200">
          <div className="relative w-full max-w-2xl max-h-[90vh] animate-in zoom-in-95 duration-200">
            <div className="absolute -inset-1 bg-gradient-to-r from-orange-500 via-pink-500 to-[#00f99d] rounded-2xl sm:rounded-3xl blur-lg opacity-30"></div>
            
            <div className="relative bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-xl sm:rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
              {/* Header */}
              <div className="relative p-4 sm:p-6 pb-4">
                <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-br from-orange-500/20 via-pink-500/10 to-transparent"></div>
                
                <div className="relative flex items-center justify-between">
                  <div className="flex items-center gap-3 sm:gap-4">
                    <div className="relative">
                      <div className="absolute inset-0 bg-gradient-to-r from-orange-500 to-pink-500 rounded-lg sm:rounded-xl blur-lg opacity-50"></div>
                      <div className="relative w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-orange-500 to-pink-600 rounded-lg sm:rounded-xl flex items-center justify-center shadow-lg">
                        <svg className="w-5 h-5 sm:w-6 sm:h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                        </svg>
                      </div>
                    </div>
                    <div>
                      <h2 className="text-lg sm:text-xl font-bold text-white">Manage Lesson Access</h2>
                      <p className="text-slate-400 text-xs sm:text-sm">{selectedStudent.username}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setAccessModalOpen(false)}
                    className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-slate-800/50 flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
                  >
                    <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto px-4 sm:px-6 pb-4">
                {accessLoading ? (
                  <div className="text-center py-8">
                    <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
                    <p className="text-slate-400 mt-2 text-sm">Loading lessons...</p>
                  </div>
                ) : (
                  <div className="space-y-3 sm:space-y-4">
                    {Object.entries(lessonsByChapter).map(([chapterName, lessons]) => (
                      <div key={chapterName} className="bg-slate-800/30 rounded-xl p-3 sm:p-4">
                        <h4 className="font-medium text-white mb-3 flex items-center gap-2 text-sm sm:text-base">
                          <svg className="w-4 h-4 text-orange-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                          </svg>
                          {chapterName}
                        </h4>
                        <div className="space-y-2">
                          {lessons.map(lesson => (
                            <label
                              key={lesson.lesson_id}
                              className="flex items-center gap-3 p-2.5 sm:p-3 bg-slate-800/50 rounded-lg cursor-pointer hover:bg-slate-700/50 transition-colors"
                            >
                              <input
                                type="checkbox"
                                checked={selectedLessons.has(lesson.lesson_id)}
                                onChange={() => toggleLessonSelection(lesson.lesson_id)}
                                className="w-4 h-4 sm:w-5 sm:h-5 rounded border-slate-600 bg-slate-700 text-orange-500 focus:ring-orange-500 focus:ring-offset-0"
                              />
                              <div className="flex-1 min-w-0">
                                <p className="font-medium text-white text-sm truncate">{lesson.lesson_title}</p>
                                <div className="flex items-center gap-2 mt-1">
                                  <div className="w-12 sm:w-16 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                                    <div 
                                      className="h-full bg-gradient-to-r from-orange-500 to-[#00f99d] rounded-full"
                                      style={{ width: `${lesson.progress_percentage}%` }}
                                    />
                                  </div>
                                  <span className="text-xs text-slate-400">{lesson.progress_percentage}%</span>
                                </div>
                              </div>
                              <span className={`flex-shrink-0 px-2 py-1 text-xs font-medium rounded ${
                                lesson.is_unlocked 
                                  ? 'bg-green-500/20 text-green-400' 
                                  : 'bg-slate-700 text-slate-400'
                              }`}>
                                {lesson.is_unlocked ? 'Unlocked' : 'Locked'}
                              </span>
                            </label>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="p-4 sm:p-6 pt-4 border-t border-slate-700/50 bg-slate-900/50">
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                  <div className="flex gap-2">
                    <button 
                      onClick={selectAll} 
                      className="flex-1 sm:flex-none px-3 py-2 text-sm text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
                    >
                      Select All
                    </button>
                    <button 
                      onClick={deselectAll} 
                      className="flex-1 sm:flex-none px-3 py-2 text-sm text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
                    >
                      Deselect All
                    </button>
                  </div>
                  <div className="flex gap-3">
                    <button 
                      onClick={() => setAccessModalOpen(false)} 
                      className="flex-1 sm:flex-none px-4 py-2 bg-slate-800 text-slate-300 font-medium rounded-xl hover:bg-slate-700 transition-colors text-sm"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSaveAccess}
                      disabled={accessLoading}
                      className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-gradient-to-r from-orange-500 to-pink-500 text-white font-semibold rounded-xl hover:shadow-lg hover:shadow-orange-500/25 transition-all disabled:opacity-50 text-sm"
                    >
                      {accessLoading ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                          <span>Saving...</span>
                        </>
                      ) : (
                        <span>Save Changes</span>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
