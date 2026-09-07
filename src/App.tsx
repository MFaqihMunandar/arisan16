import { Routes, Route, Link } from 'react-router-dom';
import { useState, useEffect, useRef } from 'react';
import { supabase } from './lib/supabase';
import { User } from '@supabase/supabase-js';
import { UserProfile, UserRole } from './types/database';
import Daftar from './Daftar';
import Masuk from './Masuk';
import AdminUserManagement from './AdminUserManagement';

const INACTIVITY_LIMIT_MS = 30 * 60 * 1000;

function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleLogout = async () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
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
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user);
      if (user) fetchProfile(user.id);
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

  const getRoleBadge = (role?: UserRole) => {
    switch (role) {
      case 'super_admin':
        return <span className="bg-purple-100 text-purple-800 text-xs px-2.5 py-0.5 rounded font-bold">Super Admin</span>;
      case 'sekretaris':
        return <span className="bg-blue-100 text-blue-800 text-xs px-2.5 py-0.5 rounded font-bold">Sekretaris</span>;
      case 'bendahara':
        return <span className="bg-emerald-100 text-emerald-800 text-xs px-2.5 py-0.5 rounded font-bold">Bendahara</span>;
      case 'pengurus':
        return <span className="bg-amber-100 text-amber-800 text-xs px-2.5 py-0.5 rounded font-bold">Pengurus</span>;
      default:
        return <span className="bg-gray-100 text-gray-800 text-xs px-2.5 py-0.5 rounded font-bold">Anggota</span>;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100">
        <p className="text-gray-500">Memuat...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 p-4">
      <div className="bg-white p-8 rounded-xl shadow-md text-center max-w-lg w-full">
        <h1 className="text-3xl font-bold text-blue-600 mb-2">APP Arisan</h1>
        <p className="text-gray-600 mb-6">Manajemen Arisan & Tabungan Kelompok</p>

        {user ? (
          <div className="space-y-4">
            <div className="p-4 bg-gray-50 border rounded-lg text-left space-y-2">
              <div className="flex justify-between items-center">
                <p className="font-semibold text-gray-800">{profile?.full_name || 'Pengguna'}</p>
                {getRoleBadge(profile?.role)}
              </div>
              <p className="text-sm text-gray-600 truncate">{user.email}</p>
            </div>

            {profile?.role === 'super_admin' && (
              <div className="p-3 bg-purple-50 text-purple-900 border border-purple-200 rounded-lg text-sm text-left">
                <p className="font-bold">Akses Super Admin:</p>
                <p>Anda memiliki hak akses penuh untuk mengelola pengguna, menghapus akun, dan mengatur pengurus arisan.</p>
              </div>
            )}

            {profile?.role === 'pengurus' && (
              <div className="p-3 bg-blue-50 text-blue-900 border border-blue-200 rounded-lg text-sm text-left">
                <p className="font-bold">Akses Pengurus Arisan:</p>
                <p>Anda dapat membuat kelompok arisan, mengocok pemenang, dan mencatat pembayaran anggota.</p>
              </div>
            )}

            {profile?.role === 'anggota' && (
              <div className="p-3 bg-green-50 text-green-900 border border-green-200 rounded-lg text-sm text-left">
                <p className="font-bold">Akses Anggota:</p>
                <p>Anda dapat melihat status grup arisan, jadwal pengocokan, dan riwayat pembayaran Anda.</p>
              </div>
            )}

            <button
              onClick={handleLogout}
              className="w-full bg-red-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-red-700 transition"
            >
              Keluar (Logout)
            </button>
          </div>
        ) : (
          <div className="flex justify-center gap-4">
            <Link
              to="/daftar"
              className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 transition"
            >
              Daftar Akun
            </Link>
            <Link
              to="/login"
              className="bg-gray-200 text-gray-800 px-4 py-2 rounded-lg font-medium hover:bg-gray-300 transition"
            >
              Masuk
            </Link>
          </div>
        )}
      </div>

      {/* Render Management Table if User is Super Admin */}
      {user && profile?.role === 'super_admin' && <AdminUserManagement />}
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/daftar" element={<Daftar />} />
      <Route path="/login" element={<Masuk />} />
    </Routes>
  );
}