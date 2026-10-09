import { useState } from 'react';
import LaporanArisan from './LaporanArisan';
import LaporanKas from './LaporanKas';
import { PiggyBank, Wallet } from 'lucide-react';

interface LaporanPengurusProps {
  currentUserId?: string;
}

export default function LaporanPengurus({ currentUserId }: LaporanPengurusProps) {
  const [activeTab, setActiveTab] = useState<'arisan' | 'kas'>('arisan');

  return (
    <div className="w-full space-y-6">
      {/* Browser-like Navigation Header */}
      <div className="flex border-b border-gray-200 bg-white rounded-t-2xl shadow-sm px-2 pt-2">
        <button
          onClick={() => setActiveTab('arisan')}
          className={`py-3 px-6 text-xs font-bold border-b-2 transition flex items-center gap-2 rounded-t-xl ${
            activeTab === 'arisan'
              ? 'border-blue-600 text-blue-600 bg-blue-50/60'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
          }`}
        >
          <PiggyBank className="w-4 h-4" />
          Laporan Arisan per Kocokan
        </button>

        <button
          onClick={() => setActiveTab('kas')}
          className={`py-3 px-6 text-xs font-bold border-b-2 transition flex items-center gap-2 rounded-t-xl ${
            activeTab === 'kas'
              ? 'border-indigo-600 text-indigo-600 bg-indigo-50/60'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
          }`}
        >
          <Wallet className="w-4 h-4" />
          Laporan Kas & Mutasi Operasional
        </button>
      </div>

      {/* Tab Content Rendering */}
      <div className="w-full">
        {activeTab === 'arisan' ? (
          <LaporanArisan currentUserId={currentUserId} />
        ) : (
          <LaporanKas currentUserId={currentUserId} />
        )}
      </div>
    </div>
  );
}