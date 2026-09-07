import { useEffect, useState } from 'react';
import { supabase } from './lib/supabase';
import { UserProfile, UserRole } from './types/database';

export default function AdminUserManagement() {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fetchAllProfiles = async () => {
    setLoading(true);

    // Get current logged-in user ID
    const { data: { user } } = await supabase.auth.getUser();
    if (user) setCurrentUserId(user.id);

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .order('full_name', { ascending: true });

    if (error) {
      setErrorMsg('Gagal mengambil data pengguna: ' + error.message);
    } else {
      setUsers((data as UserProfile[]) || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchAllProfiles();
  }, []);

  const handleRoleChange = async (userId: string, newRole: UserRole) => {
    const superAdminCount = users.filter((u) => u.role === 'super_admin').length;
    const targetUser = users.find((u) => u.id === userId);

    if (targetUser?.role === 'super_admin' && newRole !== 'super_admin' && superAdminCount <= 1) {
      alert('Gagal: Harus ada setidaknya 1 Super Admin di dalam sistem.');
      return;
    }

    const { error } = await supabase
      .from('profiles')
      .update({ role: newRole })
      .eq('id', userId);

    if (error) {
      alert('Gagal memperbarui jabatan/peran: ' + error.message);
    } else {
      fetchAllProfiles();
    }
  };

  const handleDeleteUser = async (userId: string, name: string, role: UserRole) => {
    if (userId === currentUserId) {
      alert('Anda tidak dapat menghapus akun Anda sendiri.');
      return;
    }

    const superAdminCount = users.filter((u) => u.role === 'super_admin').length;
    if (role === 'super_admin' && superAdminCount <= 1) {
      alert('Gagal: Tidak dapat menghapus Super Admin terakhir.');
      return;
    }

    if (!confirm(`Apakah Anda yakin ingin menghapus pengguna "${name}"?`)) return;

    const { error } = await supabase
      .from('profiles')
      .delete()
      .eq('id', userId);

    if (error) {
      alert('Gagal menghapus pengguna: ' + error.message);
    } else {
      fetchAllProfiles();
    }
  };

  const getRoleBadgeColor = (role: UserRole) => {
    switch (role) {
      case 'super_admin':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'sekretaris':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'bendahara':
        return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 'pengurus':
        return 'bg-amber-100 text-amber-800 border-amber-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  if (loading) return <p className="text-gray-500 text-sm py-4">Memuat data pengguna...</p>;

  const superAdminCount = users.filter((u) => u.role === 'super_admin').length;

  return (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 w-full">
      <div className="flex justify-between items-center mb-4">
        <div>
          <h2 className="text-xl font-bold text-gray-800">Manajemen Pengguna & Pengurus</h2>
          <p className="text-xs text-gray-500">Kelola Jabatan (Sekretaris, Bendahara) dan hapus Peserta/Pengurus</p>
        </div>
        <button
          onClick={fetchAllProfiles}
          className="text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1 rounded transition"
        >
          Refresh Data
        </button>
      </div>

      {errorMsg && (
        <div className="p-3 bg-red-100 text-red-700 rounded-lg text-sm mb-4">
          {errorMsg}
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left text-gray-600 border-collapse">
          <thead className="bg-gray-100 text-gray-700 uppercase text-xs">
            <tr>
              <th className="p-3 border-b">Nama Lengkap</th>
              <th className="p-3 border-b">Email</th>
              <th className="p-3 border-b">Jabatan / Role</th>
              <th className="p-3 border-b text-center">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {users.map((item) => {
              const isSelf = item.id === currentUserId;
              const isOnlySuperAdmin = item.role === 'super_admin' && superAdminCount <= 1;
              const disableDelete = isSelf || isOnlySuperAdmin;

              return (
                <tr key={item.id} className="border-b hover:bg-gray-50">
                  <td className="p-3 font-medium text-gray-800">{item.full_name || '-'}</td>
                  <td className="p-3">{item.email}</td>
                  <td className="p-3">
                    <select
                      value={item.role}
                      disabled={isOnlySuperAdmin}
                      onChange={(e) => handleRoleChange(item.id, e.target.value as UserRole)}
                      className={`border text-xs rounded-md p-1.5 font-medium focus:ring-2 focus:ring-blue-500 ${getRoleBadgeColor(
                        item.role
                      )} ${isOnlySuperAdmin ? 'opacity-60 cursor-not-allowed' : ''}`}
                    >
                      <option value="anggota">Anggota / Peserta</option>
                      <option value="sekretaris">Sekretaris</option>
                      <option value="bendahara">Bendahara</option>
                      <option value="pengurus">Pengurus Umum</option>
                      <option value="super_admin">Super Admin</option>
                    </select>
                  </td>
                  <td className="p-3 text-center">
                    <button
                      onClick={() => handleDeleteUser(item.id, item.full_name || item.email, item.role)}
                      disabled={disableDelete}
                      title={
                        isSelf
                          ? 'Anda tidak dapat menghapus akun sendiri'
                          : isOnlySuperAdmin
                          ? 'Tidak dapat menghapus Super Admin terakhir'
                          : ''
                      }
                      className={`text-xs font-semibold px-3 py-1.5 rounded transition border ${
                        disableDelete
                          ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
                          : 'bg-red-50 hover:bg-red-100 text-red-600 border-red-200'
                      }`}
                    >
                      Hapus
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}