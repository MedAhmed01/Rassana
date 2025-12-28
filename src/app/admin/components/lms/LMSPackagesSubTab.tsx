'use client';

import { useState, useEffect } from 'react';

interface Topic {
  id: string;
  name: string;
  description?: string;
  is_free: boolean;
  display_order: number;
}

interface Package {
  id: string;
  name: string;
  description?: string;
  price: number;
  duration_days: number;
  is_active: boolean;
  display_order: number;
  topics: Topic[];
}

interface Student {
  id: string;
  username: string;
  email: string;
  class?: string;
}

interface StudentPackage {
  id: string;
  student_id: string;
  package_id: string;
  starts_at: string;
  expires_at: string;
  package: Package;
  student: Student;
  is_active: boolean;
}

interface Props {
  onError: (error: string) => void;
}

export function LMSPackagesSubTab({ onError }: Props) {
  const [packages, setPackages] = useState<Package[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [studentPackages, setStudentPackages] = useState<StudentPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeView, setActiveView] = useState<'packages' | 'assignments'>('packages');

  // Package form state
  const [packageModalOpen, setPackageModalOpen] = useState(false);
  const [editingPackage, setEditingPackage] = useState<Package | null>(null);
  const [packageLoading, setPackageLoading] = useState(false);
  const [packageForm, setPackageForm] = useState({
    name: '',
    description: '',
    price: '',
    duration_days: '30',
    topic_ids: [] as string[],
  });

  // Delete confirmation state
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [packageToDelete, setPackageToDelete] = useState<Package | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Assign package state
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [assignLoading, setAssignLoading] = useState(false);
  const [assignForm, setAssignForm] = useState({
    student_id: '',
    package_id: '',
    duration_days: '',
  });

  // Extend subscription state
  const [extendModalOpen, setExtendModalOpen] = useState(false);
  const [extendingSubscription, setExtendingSubscription] = useState<StudentPackage | null>(null);
  const [extendDays, setExtendDays] = useState('30');
  const [extendLoading, setExtendLoading] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const [packagesRes, topicsRes, studentsRes, assignmentsRes] = await Promise.all([
        fetch('/api/lms/admin/packages'),
        fetch('/api/lms/admin/topics'),
        fetch('/api/lms/admin/students'),
        fetch('/api/lms/admin/packages/assign'),
      ]);

      if (packagesRes.ok) {
        const data = await packagesRes.json();
        setPackages(data.packages || []);
      }
      if (topicsRes.ok) {
        const data = await topicsRes.json();
        setTopics(data.topics || []);
      }
      if (studentsRes.ok) {
        const data = await studentsRes.json();
        setStudents((data.students || []).map((s: Record<string, unknown>) => ({
          id: s.student_id,
          username: s.username,
          email: s.email,
          class: s.class,
        })));
      }
      if (assignmentsRes.ok) {
        const data = await assignmentsRes.json();
        setStudentPackages(data.assignments || []);
      }
    } catch (err) {
      onError('Failed to load data');
    } finally {
      setLoading(false);
    }
  }

  function openAddPackageModal() {
    setEditingPackage(null);
    setPackageForm({ name: '', description: '', price: '', duration_days: '30', topic_ids: [] });
    setPackageModalOpen(true);
  }

  function openEditPackageModal(pkg: Package) {
    setEditingPackage(pkg);
    setPackageForm({
      name: pkg.name,
      description: pkg.description || '',
      price: pkg.price.toString(),
      duration_days: pkg.duration_days.toString(),
      topic_ids: pkg.topics.map(t => t.id),
    });
    setPackageModalOpen(true);
  }

  async function handleSavePackage(e: React.FormEvent) {
    e.preventDefault();
    setPackageLoading(true);

    try {
      const url = editingPackage
        ? `/api/lms/admin/packages/${editingPackage.id}`
        : '/api/lms/admin/packages';
      const method = editingPackage ? 'PATCH' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: packageForm.name,
          description: packageForm.description || undefined,
          price: parseFloat(packageForm.price) || 0,
          duration_days: parseInt(packageForm.duration_days) || 30,
          topic_ids: packageForm.topic_ids,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        onError(data.error || 'Failed to save package');
        return;
      }

      setPackageModalOpen(false);
      loadData();
    } catch (err) {
      onError('Failed to save package');
    } finally {
      setPackageLoading(false);
    }
  }

  function openDeleteModal(pkg: Package) {
    setPackageToDelete(pkg);
    setDeleteModalOpen(true);
  }

  async function handleDeletePackage() {
    if (!packageToDelete) return;

    setDeleteLoading(true);
    try {
      const response = await fetch(`/api/lms/admin/packages/${packageToDelete.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const data = await response.json();
        onError(data.error || 'Failed to delete package');
        return;
      }

      setDeleteModalOpen(false);
      setPackageToDelete(null);
      loadData();
    } catch (err) {
      onError('Failed to delete package');
    } finally {
      setDeleteLoading(false);
    }
  }

  function toggleTopicSelection(topicId: string) {
    setPackageForm(prev => ({
      ...prev,
      topic_ids: prev.topic_ids.includes(topicId)
        ? prev.topic_ids.filter(id => id !== topicId)
        : [...prev.topic_ids, topicId],
    }));
  }

  function openAssignModal() {
    setAssignForm({ student_id: '', package_id: '', duration_days: '' });
    setAssignModalOpen(true);
  }

  async function handleAssignPackage(e: React.FormEvent) {
    e.preventDefault();
    setAssignLoading(true);

    try {
      const response = await fetch('/api/lms/admin/packages/assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          student_id: assignForm.student_id,
          package_id: assignForm.package_id,
          duration_days: assignForm.duration_days ? parseInt(assignForm.duration_days) : undefined,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        onError(data.error || 'Failed to assign package');
        return;
      }

      setAssignModalOpen(false);
      loadData();
    } catch (err) {
      onError('Failed to assign package');
    } finally {
      setAssignLoading(false);
    }
  }

  function openExtendModal(sp: StudentPackage) {
    setExtendingSubscription(sp);
    setExtendDays('30');
    setExtendModalOpen(true);
  }

  async function handleExtendSubscription(e: React.FormEvent) {
    e.preventDefault();
    if (!extendingSubscription) return;

    setExtendLoading(true);
    try {
      const response = await fetch('/api/lms/admin/packages/assign', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: extendingSubscription.id,
          additional_days: parseInt(extendDays),
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        onError(data.error || 'Failed to extend subscription');
        return;
      }

      setExtendModalOpen(false);
      setExtendingSubscription(null);
      loadData();
    } catch (err) {
      onError('Failed to extend subscription');
    } finally {
      setExtendLoading(false);
    }
  }

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }

  function getDaysRemaining(expiresAt: string) {
    const now = new Date();
    const expires = new Date(expiresAt);
    const diff = Math.ceil((expires.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return diff;
  }

  if (loading) {
    return (
      <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-xl sm:rounded-2xl border border-slate-700/50 p-6 sm:p-8 text-center">
        <div className="w-8 h-8 border-4 border-[#ff8240] border-t-transparent rounded-full animate-spin mx-auto"></div>
        <p className="text-slate-400 mt-3 text-sm">Loading packages...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header with View Toggle & Actions */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h2 className="text-lg sm:text-xl font-bold text-slate-800">Packages & Assignments</h2>
            <p className="text-sm text-slate-500 mt-0.5">
              {activeView === 'packages' 
                ? `${packages.length} package${packages.length !== 1 ? 's' : ''} available`
                : `${studentPackages.length} assignment${studentPackages.length !== 1 ? 's' : ''}`
              }
            </p>
          </div>
          {activeView === 'packages' ? (
            <button
              onClick={openAddPackageModal}
              className="flex items-center justify-center gap-2 px-4 py-2.5 sm:py-2 bg-gradient-to-r from-[#ff8240] to-[#00f99d] text-white font-medium rounded-xl hover:opacity-90 transition-opacity shadow-lg shadow-[#ff8240]/25 active:scale-[0.98]"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              <span>Add Package</span>
            </button>
          ) : (
            <button
              onClick={openAssignModal}
              className="flex items-center justify-center gap-2 px-4 py-2.5 sm:py-2 bg-gradient-to-r from-[#ff8240] to-[#00f99d] text-white font-medium rounded-xl hover:opacity-90 transition-opacity shadow-lg shadow-[#ff8240]/25 active:scale-[0.98]"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              <span>Assign Package</span>
            </button>
          )}
        </div>
        
        {/* View Toggle */}
        <div className="relative">
          <div className="absolute -inset-1 bg-gradient-to-r from-[#ff8240]/10 via-[#00f99d]/10 to-[#ff8240]/10 rounded-2xl blur-lg opacity-50"></div>
          <div className="relative bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-xl p-1.5 border border-slate-700/50">
            <div className="flex gap-1">
              <button
                onClick={() => setActiveView('packages')}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg transition-all duration-300 ${
                  activeView === 'packages'
                    ? 'bg-gradient-to-r from-[#ff8240] to-[#00f99d] text-white shadow-lg'
                    : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
                }`}
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
                <span>Packages</span>
              </button>
              <button
                onClick={() => setActiveView('assignments')}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg transition-all duration-300 ${
                  activeView === 'assignments'
                    ? 'bg-gradient-to-r from-[#ff8240] to-[#00f99d] text-white shadow-lg'
                    : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
                }`}
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                <span>Assignments</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Packages View */}
      {activeView === 'packages' && (
        packages.length === 0 ? (
          <div className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-xl sm:rounded-2xl border border-slate-700/50 p-6 sm:p-8 text-center">
            <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-[#ff8240]/10 to-transparent rounded-full blur-2xl"></div>
            <div className="relative">
              <div className="w-16 h-16 mx-auto mb-4 bg-slate-800 rounded-2xl flex items-center justify-center">
                <svg className="w-8 h-8 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
              </div>
              <p className="text-slate-400 text-sm sm:text-base">No packages yet. Click &quot;Add Package&quot; to create one.</p>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {packages.map(pkg => (
              <div key={pkg.id} className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-xl sm:rounded-2xl border border-slate-700/50 transition-all duration-300 hover:border-slate-600/50">
                <div className="p-3 sm:p-4">
                  <div className="flex items-start gap-3">
                    {/* Package Icon */}
                    <div className="flex-shrink-0 w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-br from-orange-500/20 to-pink-500/20 flex items-center justify-center">
                      <svg className="w-5 h-5 sm:w-6 sm:h-6 text-orange-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                      </svg>
                    </div>
                    
                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-white text-sm sm:text-base truncate">{pkg.name}</h3>
                        <span className={`flex-shrink-0 px-2 py-0.5 text-xs font-medium rounded-full ${
                          pkg.is_active 
                            ? 'bg-green-500/20 text-green-400 border border-green-500/30' 
                            : 'bg-slate-700 text-slate-400'
                        }`}>
                          {pkg.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                      
                      {pkg.description && (
                        <p className="text-xs sm:text-sm text-slate-400 mt-0.5 line-clamp-1">{pkg.description}</p>
                      )}
                      
                      {/* Stats */}
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-xs text-slate-500">
                        <span className="flex items-center gap-1">
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          {pkg.price > 0 ? `${pkg.price}` : 'Free'}
                        </span>
                        <span className="flex items-center gap-1">
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          {pkg.duration_days} days
                        </span>
                        <span className="flex items-center gap-1">
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                          </svg>
                          {pkg.topics.length} topics
                        </span>
                      </div>
                      
                      {/* Topics */}
                      {pkg.topics.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {pkg.topics.map(topic => (
                            <span key={topic.id} className="px-2 py-0.5 text-xs bg-slate-700/50 text-slate-300 rounded-full">
                              {topic.name}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    
                    {/* Action Buttons */}
                    <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
                      <button
                        onClick={() => openEditPackageModal(pkg)}
                        className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-slate-800/80 flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-700 transition-all active:scale-95"
                        title="Edit package"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => openDeleteModal(pkg)}
                        className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-slate-800/80 flex items-center justify-center text-red-400 hover:text-red-300 hover:bg-red-500/20 transition-all active:scale-95"
                        title="Delete package"
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
        )
      )}

      {/* Assignments View */}
      {activeView === 'assignments' && (
        studentPackages.length === 0 ? (
          <div className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-xl sm:rounded-2xl border border-slate-700/50 p-6 sm:p-8 text-center">
            <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-[#ff8240]/10 to-transparent rounded-full blur-2xl"></div>
            <div className="relative">
              <div className="w-16 h-16 mx-auto mb-4 bg-slate-800 rounded-2xl flex items-center justify-center">
                <svg className="w-8 h-8 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <p className="text-slate-400 text-sm sm:text-base">No package assignments yet. Click &quot;Assign Package&quot; to assign a package to a student.</p>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {studentPackages.map(sp => {
              const daysRemaining = getDaysRemaining(sp.expires_at);
              return (
                <div key={sp.id} className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-xl sm:rounded-2xl border border-slate-700/50 transition-all duration-300 hover:border-slate-600/50">
                  <div className="p-3 sm:p-4">
                    <div className="flex items-start gap-3">
                      {/* Avatar */}
                      <div className="flex-shrink-0 w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-br from-orange-500/20 to-pink-500/20 flex items-center justify-center">
                        <span className="text-lg sm:text-xl font-bold text-orange-400">
                          {sp.student?.username?.charAt(0).toUpperCase() || '?'}
                        </span>
                      </div>
                      
                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-semibold text-white text-sm sm:text-base truncate">{sp.student?.username || 'Unknown'}</h3>
                          <span className={`flex-shrink-0 px-2 py-0.5 text-xs font-medium rounded-full ${
                            sp.is_active 
                              ? 'bg-green-500/20 text-green-400 border border-green-500/30' 
                              : 'bg-red-500/20 text-red-400 border border-red-500/30'
                          }`}>
                            {sp.is_active ? 'Active' : 'Expired'}
                          </span>
                        </div>
                        
                        <p className="text-xs sm:text-sm text-slate-400 truncate mt-0.5">{sp.student?.email || ''}</p>
                        
                        {/* Package & Dates */}
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-xs text-slate-500">
                          <span className="flex items-center gap-1 text-orange-400">
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                            </svg>
                            {sp.package?.name || 'Unknown'}
                          </span>
                          <span className="flex items-center gap-1">
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            {formatDate(sp.starts_at)} - {formatDate(sp.expires_at)}
                          </span>
                          {sp.is_active && (
                            <span className={`flex items-center gap-1 ${daysRemaining <= 7 ? 'text-orange-400' : 'text-slate-400'}`}>
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              {daysRemaining} days left
                            </span>
                          )}
                        </div>
                      </div>
                      
                      {/* Action Button */}
                      <button
                        onClick={() => openExtendModal(sp)}
                        className="flex-shrink-0 px-3 py-1.5 text-sm text-orange-400 hover:text-orange-300 hover:bg-orange-500/10 rounded-lg transition-all active:scale-95"
                      >
                        Extend
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )
      )}

      {/* Add/Edit Package Modal - Elegant Dark Theme */}
      {packageModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 z-50 animate-in fade-in duration-200">
          <div className="relative w-full max-w-lg max-h-[90vh] animate-in zoom-in-95 duration-200">
            <div className="absolute -inset-1 bg-gradient-to-r from-orange-500 via-pink-500 to-[#00f99d] rounded-2xl sm:rounded-3xl blur-lg opacity-30"></div>
            
            <div className="relative bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-xl sm:rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
              {/* Header */}
              <div className="relative p-4 sm:p-6 pb-0">
                <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-br from-orange-500/20 via-pink-500/10 to-transparent"></div>
                
                <div className="relative flex items-center justify-between">
                  <div className="flex items-center gap-3 sm:gap-4">
                    <div className="relative">
                      <div className="absolute inset-0 bg-gradient-to-r from-orange-500 to-pink-500 rounded-lg sm:rounded-xl blur-lg opacity-50"></div>
                      <div className="relative w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-orange-500 to-pink-600 rounded-lg sm:rounded-xl flex items-center justify-center shadow-lg">
                        <svg className="w-5 h-5 sm:w-6 sm:h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                        </svg>
                      </div>
                    </div>
                    <div>
                      <h2 className="text-lg sm:text-xl font-bold text-white">{editingPackage ? 'Edit Package' : 'Create Package'}</h2>
                      <p className="text-slate-400 text-xs sm:text-sm">{editingPackage ? 'Update package details' : 'Create a new subscription package'}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setPackageModalOpen(false)}
                    className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-slate-800/50 flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
                  >
                    <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Form Content */}
              <form onSubmit={handleSavePackage} className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 sm:space-y-5">
                {/* Package Name */}
                <div className="group">
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                    Package Name <span className="text-pink-400">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g., Basic, Premium, Pro"
                    value={packageForm.name}
                    onChange={(e) => setPackageForm({ ...packageForm, name: e.target.value })}
                    required
                    className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700/50 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500/50 transition-all text-sm sm:text-base"
                  />
                </div>

                {/* Description */}
                <div className="group">
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                    Description
                  </label>
                  <textarea
                    placeholder="Package description..."
                    value={packageForm.description}
                    onChange={(e) => setPackageForm({ ...packageForm, description: e.target.value })}
                    rows={2}
                    className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700/50 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500/50 transition-all resize-none text-sm sm:text-base"
                  />
                </div>

                {/* Price & Duration Row */}
                <div className="grid grid-cols-2 gap-3 sm:gap-4">
                  <div className="group">
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                      Price
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0.00"
                      value={packageForm.price}
                      onChange={(e) => setPackageForm({ ...packageForm, price: e.target.value })}
                      className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700/50 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500/50 transition-all text-sm sm:text-base"
                    />
                  </div>

                  <div className="group">
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                      Duration (days) <span className="text-pink-400">*</span>
                    </label>
                    <input
                      type="number"
                      min="1"
                      placeholder="30"
                      value={packageForm.duration_days}
                      onChange={(e) => setPackageForm({ ...packageForm, duration_days: e.target.value })}
                      required
                      className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700/50 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500/50 transition-all text-sm sm:text-base"
                    />
                  </div>
                </div>

                {/* Topics Selection */}
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                    Topics in this Package
                  </label>
                  <div className="bg-slate-800/30 rounded-xl p-3 max-h-32 overflow-y-auto space-y-2">
                    {topics.filter(t => !t.is_free).length === 0 ? (
                      <p className="text-sm text-slate-500 text-center py-2">No non-free topics available</p>
                    ) : (
                      topics.filter(t => !t.is_free).map(topic => (
                        <label
                          key={topic.id}
                          className="flex items-center gap-3 p-2 hover:bg-slate-700/50 rounded-lg cursor-pointer transition-colors"
                        >
                          <input
                            type="checkbox"
                            checked={packageForm.topic_ids.includes(topic.id)}
                            onChange={() => toggleTopicSelection(topic.id)}
                            className="w-4 h-4 rounded border-slate-600 bg-slate-700 text-orange-500 focus:ring-orange-500 focus:ring-offset-0"
                          />
                          <span className="text-sm text-slate-300">{topic.name}</span>
                        </label>
                      ))
                    )}
                  </div>
                  <p className="text-xs text-slate-500 mt-2">
                    Free topics are accessible to all students and don&apos;t need to be in packages.
                  </p>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setPackageModalOpen(false)}
                    className="flex-1 px-4 py-3 bg-slate-800 text-slate-300 font-medium rounded-xl hover:bg-slate-700 transition-colors text-sm sm:text-base"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={packageLoading}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-orange-500 to-pink-500 text-white font-semibold rounded-xl hover:shadow-lg hover:shadow-orange-500/25 transition-all disabled:opacity-50 text-sm sm:text-base"
                  >
                    {packageLoading ? (
                      <>
                        <div className="w-4 h-4 sm:w-5 sm:h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        <span>Saving...</span>
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={editingPackage ? "M5 13l4 4L19 7" : "M12 4v16m8-8H4"} />
                        </svg>
                        <span>{editingPackage ? 'Save Changes' : 'Create Package'}</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteModalOpen && packageToDelete && (
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
                    <h3 className="text-lg sm:text-xl font-bold text-white">Delete Package</h3>
                    <p className="text-slate-400 text-xs sm:text-sm">This action cannot be undone</p>
                  </div>
                </div>

                <p className="text-slate-300 mb-6 text-sm sm:text-base">
                  Are you sure you want to delete <span className="font-semibold text-white">{packageToDelete.name}</span>?
                  This will also remove all student assignments for this package.
                </p>

                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      setDeleteModalOpen(false);
                      setPackageToDelete(null);
                    }}
                    className="flex-1 px-4 py-3 bg-slate-800 text-slate-300 font-medium rounded-xl hover:bg-slate-700 transition-colors text-sm sm:text-base"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleDeletePackage}
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
                        <span>Delete Package</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Assign Package Modal */}
      {assignModalOpen && (
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
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                        </svg>
                      </div>
                    </div>
                    <div>
                      <h2 className="text-lg sm:text-xl font-bold text-white">Assign Package</h2>
                      <p className="text-slate-400 text-xs sm:text-sm">Assign a package to a student</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setAssignModalOpen(false)}
                    className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-slate-800/50 flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
                  >
                    <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Form Content */}
              <form onSubmit={handleAssignPackage} className="p-4 sm:p-6 space-y-4 sm:space-y-5">
                {/* Student Selection */}
                <div className="group">
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                    Student <span className="text-pink-400">*</span>
                  </label>
                  <select
                    value={assignForm.student_id}
                    onChange={(e) => setAssignForm({ ...assignForm, student_id: e.target.value })}
                    required
                    className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700/50 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500/50 transition-all appearance-none cursor-pointer text-sm sm:text-base"
                  >
                    <option value="" className="bg-slate-800">Select a student...</option>
                    {students.map(student => (
                      <option key={student.id} value={student.id} className="bg-slate-800">
                        {student.username} ({student.email})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Package Selection */}
                <div className="group">
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                    Package <span className="text-pink-400">*</span>
                  </label>
                  <select
                    value={assignForm.package_id}
                    onChange={(e) => {
                      const pkg = packages.find(p => p.id === e.target.value);
                      setAssignForm({
                        ...assignForm,
                        package_id: e.target.value,
                        duration_days: pkg ? pkg.duration_days.toString() : '',
                      });
                    }}
                    required
                    className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700/50 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500/50 transition-all appearance-none cursor-pointer text-sm sm:text-base"
                  >
                    <option value="" className="bg-slate-800">Select a package...</option>
                    {packages.filter(p => p.is_active).map(pkg => (
                      <option key={pkg.id} value={pkg.id} className="bg-slate-800">
                        {pkg.name} ({pkg.duration_days} days)
                      </option>
                    ))}
                  </select>
                </div>

                {/* Duration Override */}
                <div className="group">
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                    Duration (days) <span className="text-slate-500 text-xs normal-case">(leave empty for package default)</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    placeholder="Use package default"
                    value={assignForm.duration_days}
                    onChange={(e) => setAssignForm({ ...assignForm, duration_days: e.target.value })}
                    className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700/50 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500/50 transition-all text-sm sm:text-base"
                  />
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setAssignModalOpen(false)}
                    className="flex-1 px-4 py-3 bg-slate-800 text-slate-300 font-medium rounded-xl hover:bg-slate-700 transition-colors text-sm sm:text-base"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={assignLoading}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-orange-500 to-pink-500 text-white font-semibold rounded-xl hover:shadow-lg hover:shadow-orange-500/25 transition-all disabled:opacity-50 text-sm sm:text-base"
                  >
                    {assignLoading ? (
                      <>
                        <div className="w-4 h-4 sm:w-5 sm:h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        <span>Assigning...</span>
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                        <span>Assign Package</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Extend Subscription Modal */}
      {extendModalOpen && extendingSubscription && (
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
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                    </div>
                    <div>
                      <h2 className="text-lg sm:text-xl font-bold text-white">Extend Subscription</h2>
                      <p className="text-slate-400 text-xs sm:text-sm">Add more days to subscription</p>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setExtendModalOpen(false);
                      setExtendingSubscription(null);
                    }}
                    className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-slate-800/50 flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
                  >
                    <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Form Content */}
              <form onSubmit={handleExtendSubscription} className="p-4 sm:p-6 space-y-4 sm:space-y-5">
                {/* Current Subscription Info */}
                <div className="bg-slate-800/30 rounded-xl p-3 sm:p-4">
                  <p className="text-white text-sm sm:text-base">
                    <span className="font-semibold">{extendingSubscription.student?.username}</span>
                    <span className="text-slate-400"> - </span>
                    <span className="text-orange-400">{extendingSubscription.package?.name}</span>
                  </p>
                  <p className="text-xs sm:text-sm text-slate-400 mt-1">
                    Current expiry: <span className="text-slate-300">{formatDate(extendingSubscription.expires_at)}</span>
                  </p>
                </div>

                {/* Days to Add */}
                <div className="group">
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                    Add Days <span className="text-pink-400">*</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    placeholder="30"
                    value={extendDays}
                    onChange={(e) => setExtendDays(e.target.value)}
                    required
                    className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700/50 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500/50 transition-all text-sm sm:text-base"
                  />
                  <p className="text-xs text-slate-500 mt-2">
                    Days will be added from current expiry date (or today if expired)
                  </p>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setExtendModalOpen(false);
                      setExtendingSubscription(null);
                    }}
                    className="flex-1 px-4 py-3 bg-slate-800 text-slate-300 font-medium rounded-xl hover:bg-slate-700 transition-colors text-sm sm:text-base"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={extendLoading}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-orange-500 to-pink-500 text-white font-semibold rounded-xl hover:shadow-lg hover:shadow-orange-500/25 transition-all disabled:opacity-50 text-sm sm:text-base"
                  >
                    {extendLoading ? (
                      <>
                        <div className="w-4 h-4 sm:w-5 sm:h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        <span>Extending...</span>
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span>Extend Subscription</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
