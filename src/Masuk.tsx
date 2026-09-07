import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from './lib/supabase';

export default function Masuk() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    setLoading(false);

    if (error) {
      setErrorMsg(error.message || 'Gagal masuk. Periksa kembali email dan password Anda.');
    } else {
      navigate('/');
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 p-4">
      <div className="bg-white p-8 rounded-xl shadow-md max-w-md w-full">
        <h2 className="text-2xl font-bold mb-2 text-center text-gray-800">Masuk Akun</h2>
        <p className="text-sm text-gray-500 mb-6 text-center">Masukkan email dan password untuk melanjutkan</p>

        {errorMsg && (
          <div className="p-3 rounded-lg text-sm mb-4 bg-red-100 text-red-700">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
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
            {loading ? 'Memproses...' : 'Masuk Sekarang'}
          </button>
        </form>

        <p className="text-sm text-center text-gray-600 mt-6">
          Belum punya akun?{' '}
          <Link to="/daftar" className="text-blue-600 font-medium hover:underline">
            Daftar
          </Link>
        </p>
      </div>
    </div>
  );
}