import React, { useState } from 'react';
import { User } from '@supabase/supabase-js';
import { UserProfile, UserRole } from './types/database';
import { 
  Users, 
  Wallet, 
  Shuffle, 
  FileText, 
  Settings, 
  LogOut, 
  ShieldCheck,
  Menu,
  X
} from 'lucide-react';

export type TabType = 'kelola_pengguna' | 'grup_arisan' | 'kas' | 'pengocokan' | 'laporan' | 'pengaturan';

interface SidebarLayoutProps {
  user: User | null;
  profile: UserProfile | null;
  handleLogout: () => Promise<void>;
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
  children: React.ReactNode;
}

export default function SidebarLayout({ 
  user, 
  profile, 
  handleLogout, 
  activeTab, 
  setActiveTab, 
  children 
}: SidebarLayoutProps) {
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  const handleTabClick = (tab: TabType) => {
    setActiveTab(tab);
    setIsMobileOpen(false); // Close mobile menu after selecting tab
  };

  const getRoleBadge = (role?: UserRole) => {
    switch (role) {
      case 'super_admin':
        return <span className="bg-purple-100 text-purple-800 text-xs px-2 py-0.5 rounded font-bold">Super Admin</span>;
      case 'sekretaris':
        return <span className="bg-blue-100 text-blue-800 text-xs px-2 py-0.5 rounded font-bold">Sekretaris</span>;
      case 'bendahara':
        return <span className="bg-emerald-100 text-emerald-800 text-xs px-2 py-0.5 rounded font-bold">Bendahara</span>;
      case 'pengurus':
        return <span className="bg-amber-100 text-amber-800 text-xs px-2 py-0.5 rounded font-bold">Pengurus</span>;
      default:
        return <span className="bg-gray-100 text-gray-800 text-xs px-2 py-0.5 rounded font-bold">Anggota</span>;
    }
  };

  const initials = profile?.full_name
    ? profile.full_name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .slice(0, 2)
        .toUpperCase()
    : 'U';

  return (
    <div className="flex flex-col md:flex-row h-screen bg-gray-100 overflow-hidden">
      {/* Mobile Top Navigation Bar */}
      <div className="md:hidden bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between z-20">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-extrabold text-base shadow">
            A
          </div>
          <span className="font-bold text-base text-gray-900">Arisan 1/6</span>
        </div>
        <button
          onClick={() => setIsMobileOpen(!isMobileOpen)}
          className="p-2 text-gray-600 hover:text-gray-900 focus:outline-none rounded-lg hover:bg-gray-100"
          aria-label="Toggle Navigation Menu"
        >
          {isMobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* Backdrop Overlay for Mobile */}
      {isMobileOpen && (
        <div
          onClick={() => setIsMobileOpen(false)}
          className="fixed inset-0 bg-black/40 z-30 md:hidden"
        />
      )}

      {/* Sidebar Drawer */}
      <aside
        className={`fixed md:static inset-y-0 left-0 z-40 w-64 bg-white border-r border-gray-200 flex flex-col h-full shadow-sm transition-transform duration-300 ease-in-out ${
          isMobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
        {/* App Title Header (Desktop) */}
        <div className="p-4 border-b border-gray-100 hidden md:flex items-center gap-3">
          <div className="w-9 h-9 bg-blue-600 rounded-lg flex items-center justify-center text-white font-extrabold text-lg shadow">
            A
          </div>
          <div>
            <h1 className="font-bold text-lg text-gray-900 leading-tight">Arisan 1/6</h1>
            <p className="text-xs text-gray-500">Manajemen Tabungan</p>
          </div>
        </div>

        {/* Profile Section (Fixed on Top) */}
        {user && (
          <div className="p-4 bg-gray-50 border-b border-gray-100 flex items-start gap-3">
            <div className="w-11 h-11 rounded-full bg-blue-500 text-white flex-shrink-0 flex items-center justify-center font-bold text-base shadow-sm ring-2 ring-blue-100 mt-0.5">
              {initials}
            </div>
            <div className="flex-1 min-w-0 break-words">
              <p className="font-semibold text-sm text-gray-800 leading-snug">
                {profile?.full_name || 'Pengguna'}
              </p>
              <p className="text-xs text-gray-500 truncate mb-1.5">{user.email}</p>
              <div>{getRoleBadge(profile?.role)}</div>
            </div>
          </div>
        )}

        {/* Scrollable Navigation Menu */}
        <nav className="flex-1 overflow-y-auto p-3 space-y-1">
          {profile?.role === 'super_admin' && (
            <button 
              onClick={() => handleTabClick('kelola_pengguna')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-lg transition ${
                activeTab === 'kelola_pengguna'
                  ? 'bg-blue-50 text-blue-600 font-semibold'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              <ShieldCheck className={`w-4 h-4 ${activeTab === 'kelola_pengguna' ? 'text-blue-600' : 'text-gray-500'}`} />
              Kelola Pengguna
            </button>
          )}

          <button
            onClick={() => handleTabClick('grup_arisan')}
            className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-lg transition ${
              activeTab === 'grup_arisan'
                ? 'bg-blue-50 text-blue-600 font-semibold'
                : 'text-gray-700 hover:bg-gray-100'
            }`}
          >
            <Users className={`w-4 h-4 ${activeTab === 'grup_arisan' ? 'text-blue-600' : 'text-gray-500'}`} />
            Grup Arisan
          </button>

          <button 
            onClick={() => handleTabClick('kas')}
            className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-lg transition ${
              activeTab === 'kas'
                ? 'bg-blue-50 text-blue-600 font-semibold'
                : 'text-gray-700 hover:bg-gray-100'
            }`}
          >
            <Wallet className={`w-4 h-4 ${activeTab === 'kas' ? 'text-blue-600' : 'text-gray-500'}`} />
            Catatan Kas & Payment
          </button>

          <button 
            onClick={() => handleTabClick('pengocokan')}
            className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-lg transition ${
              activeTab === 'pengocokan'
                ? 'bg-blue-50 text-blue-600 font-semibold'
                : 'text-gray-700 hover:bg-gray-100'
            }`}
          >
            <Shuffle className={`w-4 h-4 ${activeTab === 'pengocokan' ? 'text-blue-600' : 'text-gray-500'}`} />
            Pengocokan Arisan
          </button>

          <button 
            onClick={() => handleTabClick('laporan')}
            className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-lg transition ${
              activeTab === 'laporan'
                ? 'bg-blue-50 text-blue-600 font-semibold'
                : 'text-gray-700 hover:bg-gray-100'
            }`}
          >
            <FileText className={`w-4 h-4 ${activeTab === 'laporan' ? 'text-blue-600' : 'text-gray-500'}`} />
            Laporan Pengurus
          </button>

          <div className="pt-2 border-t border-gray-100 mt-2">
            <button 
              onClick={() => handleTabClick('pengaturan')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-lg transition ${
                activeTab === 'pengaturan'
                  ? 'bg-blue-50 text-blue-600 font-semibold'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              <Settings className={`w-4 h-4 ${activeTab === 'pengaturan' ? 'text-blue-600' : 'text-gray-500'}`} />
              Pengaturan Profil
            </button>
          </div>
        </nav>

        {/* Logout (Fixed on Bottom) */}
        {user && (
          <div className="p-3 border-t border-gray-200">
            <button
              onClick={handleLogout}
              className="w-full flex items-center justify-center gap-2 px-3 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-50 rounded-lg transition border border-red-200"
            >
              <LogOut className="w-4 h-4" />
              Keluar (Logout)
            </button>
          </div>
        )}
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto p-4 md:p-8 w-full">
        <div className="w-full">
          {children}
        </div>
      </main>
    </div>
  );
}