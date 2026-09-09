import React, { useState, useEffect } from 'react';
import { supabase } from './lib/supabase';
//import GroupKasManagement from './GroupKasManagement';

interface GroupArisanManagementProps {
  currentUserId?: string;
}

const generateUniqueCode = () => {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const randomSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `ARS-${dateStr}-${randomSuffix}`;
};

export default function GroupArisanManagement({ currentUserId }: GroupArisanManagementProps) {
  const [groups, setGroups] = useState<any[]>([]);
  const [loadingGroups, setLoadingGroups] = useState(true);

  // Group Creation Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [nominal, setNominal] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Member Modal State
  const [selectedGroup, setSelectedGroup] = useState<any>(null);
  const [isMemberModalOpen, setIsMemberModalOpen] = useState(false);
  const [members, setMembers] = useState<any[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [availableUsers, setAvailableUsers] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [addingUserId, setAddingUserId] = useState<string | null>(null);
  const [removingMemberId, setRemovingMemberId] = useState<string | null>(null);
  const [memberError, setMemberError] = useState('');

  // Action States
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchGroups = async () => {
    setLoadingGroups(true);
    // Fetch only active groups for management view
    const { data, error } = await supabase
      .from('arisan_groups')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (!error && data) {
      setGroups(data);
    }
    setLoadingGroups(false);
  };

  useEffect(() => {
    fetchGroups();
  }, []);

  const openMemberModal = async (group: any) => {
    setSelectedGroup(group);
    setIsMemberModalOpen(true);
    setMemberError('');
    setSearchTerm('');
    const usersMap = await fetchAvailableUsers();
    await fetchMembers(group.id, usersMap);
  };

  const closeMemberModal = () => {
    setIsMemberModalOpen(false);
    setSelectedGroup(null);
  };

  const fetchAvailableUsers = async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name, email')
      .order('full_name', { ascending: true });

    if (!error && data) {
      setAvailableUsers(data);
      const map: Record<string, any> = {};
      data.forEach((u) => {
        map[u.id] = u;
      });
      return map;
    }
    return {};
  };

  const fetchMembers = async (groupId: string, usersMap?: Record<string, any>) => {
    setLoadingMembers(true);

    const map = usersMap || availableUsers.reduce((acc, u) => ({ ...acc, [u.id]: u }), {});

    const { data, error } = await supabase
      .from('group_members')
      .select('id, user_id, is_winner')
      .eq('group_id', groupId);

    if (error) {
      setMemberError('Gagal memuat peserta: ' + error.message);
      setMembers([]);
    } else if (data) {
      const formatted = data.map((m) => ({
        ...m,
        profiles: map[m.user_id] || { full_name: 'Tanpa Nama', email: '-' },
      }));
      setMembers(formatted);
    }
    setLoadingMembers(false);
  };

  const handleAddMember = async (userId: string) => {
    setAddingUserId(userId);
    setMemberError('');

    const isAlreadyMember = members.some((m) => m.user_id === userId);
    if (isAlreadyMember) {
      setMemberError('Pengguna ini sudah terdaftar dalam peserta arisan.');
      setAddingUserId(null);
      return;
    }

    const { error } = await supabase.from('group_members').insert([
      {
        group_id: selectedGroup.id,
        user_id: userId,
        is_winner: false,
      },
    ]);

    setAddingUserId(null);

    if (error) {
      if (error.code === '23505' || error.message.includes('unique constraint')) {
        setMemberError('Pengguna sudah terdaftar di kelompok arisan ini.');
      } else {
        setMemberError('Gagal menambah peserta: ' + error.message);
      }
    }

    await fetchMembers(selectedGroup.id);
  };

  const handleRemoveMember = async (memberId: string) => {
    setRemovingMemberId(memberId);
    setMemberError('');

    const { error } = await supabase
      .from('group_members')
      .delete()
      .eq('id', memberId);

    setRemovingMemberId(null);

    if (error) {
      setMemberError('Gagal menghapus peserta: ' + error.message);
    } else {
      await fetchMembers(selectedGroup.id);
    }
  };

  // RESET PERIODE ARISAN
  const handleResetPeriod = async (group: any) => {
    const confirmReset = window.confirm(
      `Apakah Anda yakin ingin me-reset Periode untuk kelompok "${group.name}"?\n\nTindakan ini akan:\n1. Menambah Periode ke-${(group.cycle_count || 1) + 1}\n2. Mengembalikan Kocokan ke Ke-1\n3. Mengosongkan status Pemenang semua peserta.`
    );

    if (!confirmReset) return;

    setActionLoading(`reset-${group.id}`);

    // 1. Reset group_members winning status
    await supabase
      .from('group_members')
      .update({ is_winner: false })
      .eq('group_id', group.id);

    // 2. Increment cycle_count and reset cycle_schedule to 1
    const { error } = await supabase
      .from('arisan_groups')
      .update({
        cycle_count: (group.cycle_count || 1) + 1,
        cycle_schedule: '1',
      })
      .eq('id', group.id);

    setActionLoading(null);

    if (error) {
      alert('Gagal me-reset periode: ' + error.message);
    } else {
      alert(`Kelompok "${group.name}" berhasil di-reset ke Periode Ke-${(group.cycle_count || 1) + 1}!`);
      fetchGroups();
      if (selectedGroup && selectedGroup.id === group.id) {
        closeMemberModal();
      }
    }
  };

  // SOFT DELETE (ARCHIVE) ARISAN GROUP
  const handleDeleteGroup = async (group: any) => {
    const confirmDelete = window.confirm(
      `ARSIPKAN KELOMPOK ARISAN?\n\nKelompok "${group.name}" akan disembunyikan dari daftar aktif.\n\nData histori, peserta, dan transaksi akan TETAP TERSIMPAN untuk laporan tahunan (hingga 5 tahun).`
    );

    if (!confirmDelete) return;

    setActionLoading(`delete-${group.id}`);

    // Set is_active to false (Soft Delete)
    const { error } = await supabase
      .from('arisan_groups')
      .update({ is_active: false })
      .eq('id', group.id);

    setActionLoading(null);

    if (error) {
      alert('Gagal mengarsipkan kelompok: ' + error.message);
    } else {
      alert(`Kelompok "${group.name}" telah diarsipkan.`);
      fetchGroups();
      if (selectedGroup && selectedGroup.id === group.id) {
        closeMemberModal();
      }
    }
  };

  const openCreateModal = () => {
    setCode(generateUniqueCode());
    setName('');
    setDescription('');
    setNominal('');
    setErrorMsg('');
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !description.trim() || !nominal) {
      setErrorMsg('Nama kelompok, deskripsi, dan nominal per putaran wajib diisi.');
      return;
    }

    setLoading(true);
    setErrorMsg('');

    const userId = currentUserId || (await supabase.auth.getUser()).data.user?.id;

    const { error } = await supabase.from('arisan_groups').insert([
      {
        code: code,
        name: name,
        description: description,
        contribution_amount: Number(nominal),
        cycle_schedule: '1',
        cycle_count: 1,
        admin_id: userId,
        is_active: true,
      },
    ]);

    setLoading(false);

    if (error) {
      setErrorMsg(error.message);
    } else {
      setIsModalOpen(false);
      fetchGroups();
    }
  };

  const filteredUsers = availableUsers.filter((u) => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return true;
    const nameMatch = u.full_name?.toLowerCase().includes(term);
    const emailMatch = u.email?.toLowerCase().includes(term);
    return nameMatch || emailMatch;
  });

  const isKocokan1 = Number(selectedGroup?.cycle_schedule || 1) === 1;

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-xl font-bold text-gray-800">Manajemen Grup Arisan</h2>
          <p className="text-sm text-gray-500">Buat, atur nominal per putaran, dan kelola kelompok arisan.</p>
        </div>
        <button
          onClick={openCreateModal}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 transition text-sm"
        >
          + Buat Arisan Baru
        </button>
      </div>

      {loadingGroups ? (
        <div className="p-8 text-center text-gray-500">Memuat data kelompok arisan...</div>
      ) : groups.length === 0 ? (
        <div className="p-8 text-center text-gray-500 bg-white rounded-xl border border-gray-200">
          Belum ada kelompok arisan aktif. Klik "+ Buat Arisan Baru" untuk membuat grup pertama.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {groups.map((group) => {
            const currentKocokan = Number(group.cycle_schedule || 1);
            const cycleCount = group.cycle_count || 1;

            return (
              <div key={group.id} className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm hover:shadow transition flex flex-col justify-between">
                <div>
                  <div className="flex justify-between items-start mb-2 gap-1 flex-wrap">
                    <span className="text-xs font-mono font-bold bg-blue-50 text-blue-600 px-2 py-1 rounded">
                      {group.code || 'ARS-GROUP'}
                    </span>
                    <div className="flex gap-1">
                      <span className="text-xs font-semibold bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded">
                        Periode Ke-{cycleCount}
                      </span>
                      <span className="text-xs font-semibold bg-green-100 text-green-700 px-2 py-0.5 rounded">
                        Kocokan Ke-{currentKocokan}
                      </span>
                    </div>
                  </div>

                  <h3 className="font-bold text-gray-800 text-lg mb-1">{group.name}</h3>
                  <p className="text-sm text-gray-600 mb-4 line-clamp-2">{group.description}</p>
                  
                  <div className="pt-3 border-t border-gray-100 flex justify-between items-center text-sm mb-4">
                    <span className="text-gray-500">Nominal / Putaran:</span>
                    <span className="font-bold text-gray-900">
                      Rp {Number(group.contribution_amount || 0).toLocaleString('id-ID')}
                    </span>
                  </div>
                </div>

                <div className="space-y-2">
                  <button
                    onClick={() => openMemberModal(group)}
                    className="w-full py-2 px-3 bg-gray-100 text-gray-700 font-medium text-xs rounded-lg hover:bg-gray-200 transition flex items-center justify-center gap-1.5"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                    </svg>
                    Cek Peserta
                  </button>

                  <div className="grid grid-cols-2 gap-2 pt-1 border-t border-gray-100">
                    <button
                      onClick={() => handleResetPeriod(group)}
                      disabled={actionLoading === `reset-${group.id}`}
                      className="py-1.5 px-2 bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200 text-[11px] font-medium rounded-lg transition"
                    >
                      {actionLoading === `reset-${group.id}` ? '...' : 'Reset Periode'}
                    </button>
                    <button
                      onClick={() => handleDeleteGroup(group)}
                      disabled={actionLoading === `delete-${group.id}`}
                      className="py-1.5 px-2 bg-red-50 text-red-600 hover:bg-red-100 border border-red-200 text-[11px] font-medium rounded-lg transition"
                    >
                      {actionLoading === `delete-${group.id}` ? '...' : 'Arsipkan (Hapus)'}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Two-Column Table Modal for Members */}
      {isMemberModalOpen && selectedGroup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-5xl p-6 relative max-h-[90vh] flex flex-col">
            <div className="flex justify-between items-center mb-3">
              <div>
                <h3 className="text-lg font-bold text-gray-800">Peserta Kelompok - {selectedGroup.name}</h3>
                <p className="text-xs text-gray-500">
                  Periode Ke-{selectedGroup.cycle_count || 1} &bull; Kocokan Ke-{selectedGroup.cycle_schedule || 1}
                </p>
              </div>
              <button onClick={closeMemberModal} className="text-gray-400 hover:text-gray-600 text-xl font-bold">&times;</button>
            </div>

            {/* Banner Status */}
            {!isKocokan1 ? (
              <div className="p-2.5 mb-3 bg-amber-50 border border-amber-200 text-amber-800 rounded-lg text-xs flex justify-between items-center">
                <span>
                  <strong>Status Kocokan:</strong> Kocokan saat ini sudah berjalan (Kocokan Ke-{selectedGroup.cycle_schedule}). Penambahan dan penghapusan peserta hanya dapat dilakukan pada <strong>Kocokan Ke-1</strong>.
                </span>
                <button
                  onClick={() => handleResetPeriod(selectedGroup)}
                  className="px-2.5 py-1 bg-amber-600 text-white rounded text-[11px] font-bold hover:bg-amber-700 whitespace-nowrap ml-2"
                >
                  Reset Periode Baru
                </button>
              </div>
            ) : (
              <div className="p-2.5 mb-3 bg-blue-50 border border-blue-200 text-blue-800 rounded-lg text-xs">
                <strong>Status Kocokan Ke-1:</strong> Klik <strong>+ Tambah</strong> untuk memasukkan peserta, atau klik <strong>Hapus</strong> di tabel kanan untuk mengeluarkan peserta.
              </div>
            )}

            {memberError && (
              <div className="mb-3 p-2 bg-red-50 text-red-600 text-xs rounded-lg border border-red-100">{memberError}</div>
            )}

            {/* Split Tables Container */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 flex-1 overflow-hidden min-h-[360px]">
              
              {/* LEFT TABLE: App Users Directory */}
              <div className="flex flex-col border border-gray-200 rounded-xl bg-gray-50/50 p-3 overflow-hidden">
                <div className="flex justify-between items-center mb-2">
                  <h4 className="font-bold text-xs text-gray-700 uppercase">Daftar Pengguna Aplikasi</h4>
                  <span className="text-[11px] text-gray-500">{filteredUsers.length} Pengguna</span>
                </div>

                <input
                  type="text"
                  placeholder="Cari nama atau email..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full px-3 py-1.5 mb-2 border border-gray-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                />

                <div className="flex-1 overflow-y-auto border border-gray-200 rounded-lg bg-white">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-gray-100 sticky top-0 border-b border-gray-200 text-gray-600">
                      <tr>
                        <th className="py-2 px-3 font-semibold">Nama</th>
                        <th className="py-2 px-3 font-semibold">Email</th>
                        <th className="py-2 px-3 font-semibold text-center">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {filteredUsers.length === 0 ? (
                        <tr>
                          <td colSpan={3} className="text-center py-6 text-gray-400">Pengguna tidak ditemukan.</td>
                        </tr>
                      ) : (
                        filteredUsers.map((user) => {
                          const isAdded = members.some((m) => m.user_id === user.id);

                          return (
                            <tr key={user.id} className="hover:bg-gray-50">
                              <td className="py-2 px-3 font-medium text-gray-800">{user.full_name || '-'}</td>
                              <td className="py-2 px-3 text-gray-500 text-[11px] truncate max-w-[120px]">{user.email}</td>
                              <td className="py-2 px-3 text-center">
                                <button
                                  onClick={() => handleAddMember(user.id)}
                                  disabled={isAdded || !isKocokan1 || addingUserId === user.id}
                                  className={`px-2.5 py-1 rounded text-[11px] font-medium transition ${
                                    isAdded
                                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                      : !isKocokan1
                                      ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                                      : 'bg-blue-600 text-white hover:bg-blue-700'
                                  }`}
                                >
                                  {isAdded ? 'Terdaftar' : addingUserId === user.id ? '...' : '+ Tambah'}
                                </button>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* RIGHT TABLE: Arisan Participants */}
              <div className="flex flex-col border border-gray-200 rounded-xl bg-white p-3 overflow-hidden">
                <div className="flex justify-between items-center mb-2">
                  <h4 className="font-bold text-xs text-gray-700 uppercase">Peserta Arisan</h4>
                  <span className="text-[11px] font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
                    {members.length} Peserta
                  </span>
                </div>

                <div className="flex-1 overflow-y-auto border border-gray-200 rounded-lg">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-gray-100 sticky top-0 border-b border-gray-200 text-gray-600">
                      <tr>
                        <th className="py-2 px-3 font-semibold">Nama</th>
                        <th className="py-2 px-3 font-semibold">Email</th>
                        <th className="py-2 px-3 font-semibold text-center">Status / Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {loadingMembers ? (
                        <tr>
                          <td colSpan={3} className="text-center py-6 text-gray-400">Memuat data peserta...</td>
                        </tr>
                      ) : members.length === 0 ? (
                        <tr>
                          <td colSpan={3} className="text-center py-6 text-gray-400">Belum ada peserta di kelompok ini.</td>
                        </tr>
                      ) : (
                        members.map((m, index) => (
                          <tr key={m.id || index} className="hover:bg-gray-50">
                            <td className="py-2 px-3 font-medium text-gray-800">{m.profiles?.full_name || 'Tanpa Nama'}</td>
                            <td className="py-2 px-3 text-gray-500 text-[11px] truncate max-w-[120px]">{m.profiles?.email || '-'}</td>
                            <td className="py-2 px-3 text-center flex items-center justify-center gap-2">
                              {m.is_winner ? (
                                <span className="px-2 py-0.5 bg-green-100 text-green-700 text-[10px] font-bold rounded">Pemenang</span>
                              ) : (
                                <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-[10px] font-medium rounded">Belum Dapat</span>
                              )}

                              {isKocokan1 && (
                                <button
                                  onClick={() => handleRemoveMember(m.id)}
                                  disabled={removingMemberId === m.id}
                                  className="px-2 py-0.5 bg-red-50 text-red-600 hover:bg-red-100 text-[10px] font-medium rounded border border-red-200 transition"
                                  title="Hapus Peserta"
                                >
                                  {removingMemberId === m.id ? '...' : 'Hapus'}
                                </button>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>

            <div className="mt-4 pt-3 border-t border-gray-100 text-right">
              <button onClick={closeMemberModal} className="px-4 py-2 bg-gray-100 text-gray-700 text-xs font-medium rounded-lg hover:bg-gray-200">
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Group Creation Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 relative">
            <h3 className="text-lg font-bold text-gray-800 mb-4">Buat Kelompok Arisan Baru</h3>

            {errorMsg && (
              <div className="mb-4 p-2.5 bg-red-50 text-red-600 text-sm rounded-lg">{errorMsg}</div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1 uppercase">Kode Kelompok (Otomatis)</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={code}
                    readOnly
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-100 text-gray-700 font-mono text-sm cursor-not-allowed focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setCode(generateUniqueCode())}
                    className="px-3 py-2 bg-gray-200 text-gray-700 text-xs rounded-lg hover:bg-gray-300 font-medium"
                  >
                    Acak
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1 uppercase">
                  Nama Kelompok <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="misal: Arisan Pemuda RT 01"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1 uppercase">
                  Deskripsi Kelompok <span className="text-red-500">*</span>
                </label>
                <textarea
                  placeholder="Hanya diperuntukkan untuk Warga Pemuda..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1 uppercase">
                  Nominal per Putaran / Kocokan (Rp) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  placeholder="5000"
                  value={nominal}
                  onChange={(e) => setNominal(e.target.value)}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 transition"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
                >
                  {loading ? 'Menyimpan...' : 'Simpan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}