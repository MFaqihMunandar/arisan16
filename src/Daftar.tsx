import { useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from './lib/supabase';

export default function Daftar() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
        },
      },
    });

    setLoading(false);

    if (error) {
      setMessage({ type: 'error', text: error.message || 'Terjadi kesalahan saat pendaftaran' });
    } else if (data?.user && data.user.identities && data.user.identities.length === 0) {
      // Handles duplicate email when User Enumeration Protection is enabled in Supabase
      setMessage({
        type: 'error',
        text: 'Email ini sudah terdaftar. Silakan gunakan email lain atau masuk ke akun Anda.',
      });
    } else {
      setMessage({
        type: 'success',
        text: 'Registrasi berhasil! Silakan cek email Anda untuk konfirmasi.',
      });
      setEmail('');
      setPassword('');
      setFullName('');
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 p-4">
      <div className="bg-white p-8 rounded-xl shadow-md max-w-md w-full">
        <h2 className="text-2xl font-bold mb-2 text-center text-gray-800">Daftar Akun Arisan</h2>
        <p className="text-sm text-gray-500 mb-6 text-center">Buat akun baru untuk mulai bergabung</p>

        {message && (
          <div
            className={`p-3 rounded-lg text-sm mb-4 ${
              message.type === 'error' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
            }`}
          >
            {message.text}
          </div>
        )}

        <form onSubmit={handleRegister} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nama Lengkap</label>
            <input
              type="text"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Contoh: Ahmad"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="nama@email.com"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white py-2 rounded-lg font-medium hover:bg-blue-700 transition disabled:opacity-50"
          >
            {loading ? 'Memproses...' : 'Daftar Sekarang'}
          </button>
        </form>

        <p className="text-sm text-center text-gray-600 mt-6">
          Sudah punya akun?{' '}
          <Link to="/login" className="text-blue-600 font-medium hover:underline">
            Masuk
          </Link>
        </p>
      </div>
    </div>
  );
}