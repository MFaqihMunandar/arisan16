import { useState } from 'react';
import GroupArisanManagement from './GroupArisanManagement';
import GroupKasManagement from './GroupKasManagement';

interface GroupManagementPageProps {
  currentUserId?: string;
}

export default function GroupManagementPage({ currentUserId }: GroupManagementPageProps) {
  const [activeTab, setActiveTab] = useState<'arisan' | 'kas'>('arisan');

  return (
    <div className="w-full">
      {/* Browser-like Tab Navigation Header */}
      <div className="flex border-b border-gray-200 mb-6">
        <button
          onClick={() => setActiveTab('arisan')}
          className={`py-3 px-6 text-sm font-semibold border-b-2 transition flex items-center gap-2 ${
            activeTab === 'arisan'
              ? 'border-blue-600 text-blue-600 bg-blue-50/50 rounded-t-lg'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
          }`}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
          Grup Arisan
        </button>

        <button
          onClick={() => setActiveTab('kas')}
          className={`py-3 px-6 text-sm font-semibold border-b-2 transition flex items-center gap-2 ${
            activeTab === 'kas'
              ? 'border-blue-600 text-blue-600 bg-blue-50/50 rounded-t-lg'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
          }`}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          </svg>
          Grup Kas
        </button>
      </div>

      {/* Tab Content Display */}
      <div>
        {activeTab === 'arisan' ? (
          <GroupArisanManagement currentUserId={currentUserId} />
        ) : (
          <GroupKasManagement currentUserId={currentUserId} />
        )}
      </div>
    </div>
  );
}