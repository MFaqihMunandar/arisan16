import { Routes, Route, Link, Navigate, useNavigate } from 'react-router-dom';
import { useState, useEffect, useRef } from 'react';
import { supabase } from './lib/supabase';
import { User } from '@supabase/supabase-js';
import { UserProfile } from './types/database';
import Daftar from './Daftar';
import Masuk from './Masuk';
import AdminUserManagement from './AdminUserManagement';
import GroupArisanManagement from './GroupManagementPage';
import CatatanKasAndPayment from './CatatanKasAndPayment';
import SidebarLayout from './SidebarLayout';

const INACTIVITY_LIMIT_MS = 30 * 60 * 1000;

function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'kelola_pengguna' | 'grup_arisan' | 'kas' | 'pengocokan' | 'laporan' | 'pengaturan'>('kelola_pengguna');
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const navigate = useNavigate();

  const handleLogout = async () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
    navigate('/login');
  };

  const resetInactivityTimer = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);

    if (user) {
      timeoutRef.current = setTimeout(() => {
        handleLogout();
        alert('Sesi Anda telah berakhir karena tidak ada aktivitas selama 30 menit.');
      }, INACTIVITY_LIMIT_MS);
    }
  };

  const fetchProfile = async (userId: string) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (!error && data) {
      setProfile(data as UserProfile);
    }
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      const currentUser = session?.user ?? null;
      setUser(currentUser);
      if (currentUser) {
        fetchProfile(currentUser.id);
      }
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const currentUser = session?.user ?? null;
      setUser(currentUser);
      if (currentUser) {
        fetchProfile(currentUser.id);
      } else {
        setProfile(null);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;

    resetInactivityTimer();
    const activityEvents = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'];

    const handleUserActivity = () => {
      resetInactivityTimer();
    };

    activityEvents.forEach((event) => {
      window.addEventListener(event, handleUserActivity);
    });

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      activityEvents.forEach((event) => {
        window.removeEventListener(event, handleUserActivity);
      });
    };
  }, [user]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100">
        <p className="text-gray-500 font-medium">Memuat session...</p>
      </div>
    );
  }

  // Unauthenticated view
  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 p-4">
        <div className="bg-white p-8 rounded-xl shadow-md text-center max-w-lg w-full space-y-4">
          <h1 className="text-3xl font-bold text-blue-600">Arisan 1/6</h1>
          <p className="text-gray-600">Manajemen Arisan & Tabungan Kelompok</p>
          <div className="flex justify-center gap-4 pt-2">
            <Link
              to="/daftar"
              className="bg-blue-600 text-white px-5 py-2.5 rounded-lg font-medium hover:bg-blue-700 transition"
            >
              Daftar Akun
            </Link>
            <Link
              to="/login"
              className="bg-gray-200 text-gray-800 px-5 py-2.5 rounded-lg font-medium hover:bg-gray-300 transition"
            >
              Masuk
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Authenticated Dashboard
  return (
    <SidebarLayout 
      user={user} 
      profile={profile} 
      handleLogout={handleLogout}
      activeTab={activeTab}
      setActiveTab={setActiveTab}
    >
      {/* Header Card */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 w-full mb-6">
        <h2 className="text-2xl font-bold text-gray-800">
          Selamat datang, {profile?.full_name || 'Pengguna'}!
        </h2>
        <p className="text-xs font-semibold text-gray-500 mt-1 uppercase tracking-wider">
          {profile?.role ? profile.role.replace('_', ' ') : 'Anggota'}
        </p>
      </div>

      {/* Tab Switching Area */}
      <div className="w-full">
        {activeTab === 'kelola_pengguna' && profile?.role === 'super_admin' && (
          <AdminUserManagement />
        )}

        {activeTab === 'grup_arisan' && (
          <GroupArisanManagement currentUserId={user?.id} />
        )}

        {activeTab === 'kas' && (
          <CatatanKasAndPayment />
        )}

        {['pengocokan', 'laporan', 'pengaturan'].includes(activeTab) && (
          <div className="bg-white p-8 rounded-xl border border-gray-200 text-center text-gray-500">
            Fitur sedang dalam pengembangan.
          </div>
        )}
      </div>
    </SidebarLayout>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/daftar" element={<Daftar />} />
      <Route path="/login" element={<Masuk />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}