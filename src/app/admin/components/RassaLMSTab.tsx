'use client';

import { useState } from 'react';
import { LMSStudentsSubTab } from './lms/LMSStudentsSubTab';
import { LMSTopicsSubTab } from './lms/LMSTopicsSubTab';
import { LMSPackagesSubTab } from './lms/LMSPackagesSubTab';
import { LMSSubscriptionsSubTab } from './lms/LMSSubscriptionsSubTab';

type SubTab = 'students' | 'topics' | 'packages' | 'subscriptions';

export function RassaLMSTab() {
  const [activeSubTab, setActiveSubTab] = useState<SubTab>('students');
  const [error, setError] = useState('');

  const subTabs = [
    { id: 'students' as const, label: 'Students', shortLabel: 'Students', icon: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z' },
    { id: 'topics' as const, label: 'Topics', shortLabel: 'Topics', icon: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253' },
    { id: 'packages' as const, label: 'Packages', shortLabel: 'Packs', icon: 'M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4' },
    { id: 'subscriptions' as const, label: 'Subscriptions', shortLabel: 'Subs', icon: 'M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z' },
  ];

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Error Alert */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 sm:p-4 flex items-start gap-2 sm:gap-3">
          <svg className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
          </svg>
          <p className="text-sm text-red-700 flex-1">{error}</p>
          <button onClick={() => setError('')} className="text-red-500 hover:text-red-700 p-1">
            <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* Sub-tabs Navigation - Modern Mobile-First Design */}
      <div className="relative">
        {/* Gradient glow effect */}
        <div className="absolute -inset-1 bg-gradient-to-r from-[#ff8240]/20 via-[#00f99d]/20 to-[#ff8240]/20 rounded-2xl sm:rounded-3xl blur-lg opacity-50"></div>
        
        <div className="relative bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-xl sm:rounded-2xl p-1.5 sm:p-2 border border-slate-700/50">
          <nav className="flex gap-1 sm:gap-2">
            {subTabs.map((tab) => {
              const isActive = activeSubTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveSubTab(tab.id)}
                  className={`relative flex-1 flex items-center justify-center gap-1.5 sm:gap-2 px-2 sm:px-4 py-2.5 sm:py-3 text-xs sm:text-sm font-medium rounded-lg sm:rounded-xl transition-all duration-300 ${
                    isActive
                      ? 'text-white'
                      : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
                  }`}
                >
                  {/* Active Background */}
                  {isActive && (
                    <div className="absolute inset-0 bg-gradient-to-r from-[#ff8240] to-[#00f99d] rounded-lg sm:rounded-xl shadow-lg shadow-[#ff8240]/25"></div>
                  )}
                  
                  {/* Content */}
                  <div className="relative flex items-center gap-1.5 sm:gap-2">
                    <svg className={`w-4 h-4 sm:w-5 sm:h-5 transition-transform ${isActive ? 'scale-110' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={isActive ? 2.5 : 2} d={tab.icon} />
                    </svg>
                    {/* Show short label on mobile, full label on larger screens */}
                    <span className="sm:hidden">{tab.shortLabel}</span>
                    <span className="hidden sm:inline">{tab.label}</span>
                  </div>
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Sub-tab Content */}
      <div className="animate-in fade-in duration-300">
        {activeSubTab === 'students' && <LMSStudentsSubTab onError={setError} />}
        {activeSubTab === 'topics' && <LMSTopicsSubTab onError={setError} />}
        {activeSubTab === 'packages' && <LMSPackagesSubTab onError={setError} />}
        {activeSubTab === 'subscriptions' && <LMSSubscriptionsSubTab onError={setError} />}
      </div>
    </div>
  );
}
