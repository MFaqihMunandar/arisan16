import React, { useState, useEffect } from 'react';
import { supabase } from './lib/supabase';

interface GroupKasManagementProps {
  currentUserId?: string;
}

const generateUniqueCode = () => {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const randomSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `KAS-${dateStr}-${randomSuffix}`;
};

export default function GroupKasManagement({ currentUserId }: GroupKasManagementProps) {
  const [groups, setGroups] = useState<any[]>([]);
  const [balances, setBalances] = useState<{ [groupId: string]: number }>({});
  const [loadingGroups, setLoadingGroups] = useState(true);

  // Group Creation/Edit Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [currentId, setCurrentId] = useState<string | null>(null);
  
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchGroupsAndBalances = async () => {
    setLoadingGroups(true);

    // 1. Fetch Kas Groups
    const { data: kasData, error: kasErr } = await supabase
      .from('kas_groups')
      .select('*')
      .order('created_at', { ascending: true });

    if (!kasErr && kasData) {
      setGroups(kasData);

      // 2. Fetch all payment entries (including category) grouped by kas_group_id
      const { data: payData, error: payErr } = await supabase
        .from('payments')
        .select('kas_group_id, amount, category');

      if (!payErr && payData) {
        const balanceMap: { [key: string]: number } = {};
        
        payData.forEach((payment) => {
          if (payment.kas_group_id) {
            const rawAmount = Math.abs(Number(payment.amount) || 0);
            
            // Check category: subtract if withdrawal, add if deposit
            if (payment.category === 'penarikan_kas') {
              balanceMap[payment.kas_group_id] = (balanceMap[payment.kas_group_id] || 0) - rawAmount;
            } else {
              balanceMap[payment.kas_group_id] = (balanceMap[payment.kas_group_id] || 0) + rawAmount;
            }
          }
        });

        setBalances(balanceMap);
      }
    }
    setLoadingGroups(false);
  };

  useEffect(() => {
    fetchGroupsAndBalances();
  }, []);

  const openCreateModal = () => {
    setIsEditing(false);
    setCurrentId(null);
    setCode(generateUniqueCode());
    setName('');
    setDescription('');
    setErrorMsg('');
    setIsModalOpen(true);
  };

  const openEditModal = (group: any) => {
    setIsEditing(true);
    setCurrentId(group.id);
    setCode(group.code || generateUniqueCode());
    setName(group.name || '');
    setDescription(group.description || '');
    setErrorMsg('');
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !description.trim()) {
      setErrorMsg('Nama kas dan deskripsi wajib diisi.');
      return;
    }

    setLoading(true);
    setErrorMsg('');

    const userId = currentUserId || (await supabase.auth.getUser()).data.user?.id;

    if (isEditing && currentId) {
      const { error } = await supabase
        .from('kas_groups')
        .update({
          name: name,
          description: description,
        })
        .eq('id', currentId);

      setLoading(false);

      if (error) {
        setErrorMsg(error.message);
      } else {
        setIsModalOpen(false);
        fetchGroupsAndBalances();
      }
    } else {
      const { error } = await supabase.from('kas_groups').insert([
        {
          code: code,
          name: name,
          description: description,
          contribution_amount: 0,
          admin_id: userId,
        },
      ]);

      setLoading(false);

      if (error) {
        setErrorMsg(error.message);
      } else {
        setIsModalOpen(false);
        fetchGroupsAndBalances();
      }
    }
  };

  const handleDeleteGroup = async (group: any) => {
    const isMainKas = group.name.toLowerCase().includes('kas umum') || group.code === 'KAS-20260908-CS2U';
    if (isMainKas) {
      alert('Kas Utama (Kas Umum) tidak dapat dihapus!');
      return;
    }

    const currentSaldo = balances[group.id] || 0;

    const confirmDelete = window.confirm(
      `HAPUS KELOMPOK KAS?\n\nKelompok "${group.name}" akan dihapus.${currentSaldo > 0 ? ` Sisa saldo (Rp ${currentSaldo.toLocaleString('id-ID')}) akan otomatis ditransfer ke Kas Umum.` : ''}`
    );

    if (!confirmDelete) return;

    setActionLoading(`delete-${group.id}`);
    const userId = currentUserId || (await supabase.auth.getUser()).data.user?.id;

    try {
      // 1. Fetch Kas Umum
      const { data: mainKas, error: mainKasErr } = await supabase
        .from('kas_groups')
        .select('id, name')
        .ilike('name', '%Kas Umum%')
        .limit(1)
        .single();

      if (mainKasErr || !mainKas) {
        alert('Gagal menemukan Kas Umum sebagai tujuan transfer saldo.');
        setActionLoading(null);
        return;
      }

      // 2. Transfer remaining positive balance if > 0
      if (currentSaldo > 0) {
        const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
        const randomSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();
        const receiptNum = `TRF-${dateStr}-${randomSuffix}`;

        const { error: transferErr } = await supabase.from('payments').insert([
          {
            receipt_number: receiptNum,
            kas_group_id: mainKas.id,
            user_id: userId,
            amount: Math.abs(currentSaldo), // Stored as positive
            category: 'kas_transfer',
            description: `Transfer sisa saldo dari penutupan kas "${group.name}"`,
            created_at: new Date().toISOString()
          }
        ]);

        if (transferErr) {
          alert('Gagal mentransfer saldo ke Kas Umum: ' + transferErr.message);
          setActionLoading(null);
          return;
        }
      }

      // 3. Delete group
      const { error: deleteErr } = await supabase
        .from('kas_groups')
        .delete()
        .eq('id', group.id);

      setActionLoading(null);

      if (deleteErr) {
        alert('Gagal menghapus kelompok kas: ' + deleteErr.message);
      } else {
        alert(`Kelompok "${group.name}" berhasil dihapus.${currentSaldo > 0 ? ` Sisa saldo (Rp ${currentSaldo.toLocaleString('id-ID')}) telah ditransfer ke Kas Umum.` : ''}`);
        fetchGroupsAndBalances();
      }
    } catch (err: any) {
      alert('Terjadi kesalahan: ' + err.message);
      setActionLoading(null);
    }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-xl font-bold text-gray-800">Manajemen Grup Kas</h2>
          <p className="text-sm text-gray-500">Buat dan kelola kelompok kas (Kas 1, Kas 2, dan seterusnya).</p>
        </div>
        <button
          onClick={openCreateModal}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 transition text-sm"
        >
          + Buat Kas Baru
        </button>
      </div>

      {loadingGroups ? (
        <div className="p-8 text-center text-gray-500">Memuat data kelompok kas...</div>
      ) : groups.length === 0 ? (
        <div className="p-8 text-center text-gray-500 bg-white rounded-xl border border-gray-200">
          Belum ada kelompok kas. Klik "+ Buat Kas Baru" untuk membuat grup pertama.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {groups.map((group) => {
            const isMainKas = group.name?.toLowerCase().includes('kas umum') || group.code === 'KAS-20260908-CS2U';
            const saldo = balances[group.id] || 0;

            return (
              <div key={group.id} className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm hover:shadow transition flex flex-col justify-between">
                <div>
                  <div className="flex justify-between items-start mb-2 gap-1 flex-wrap">
                    <span className="text-xs font-mono font-bold bg-green-50 text-green-600 px-2 py-1 rounded">
                      {group.code || 'KAS-GROUP'}
                    </span>
                    {isMainKas && (
                      <span className="text-xs font-bold bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full">
                        Kas Utama
                      </span>
                    )}
                  </div>

                  <h3 className="font-bold text-gray-800 text-lg mb-1">{group.name}</h3>
                  <p className="text-sm text-gray-600 mb-3 line-clamp-2">{group.description}</p>

                  {/* Real-time Saldo Indicator */}
                  <div className="mb-4 p-2.5 bg-gray-50 rounded-lg border border-gray-100 flex justify-between items-center">
                    <span className="text-xs text-gray-500 font-medium">Saldo Kas Saat Ini:</span>
                    <span className={`text-sm font-bold ${saldo < 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                      Rp {saldo.toLocaleString('id-ID')}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-3 border-t border-gray-100">
                  <button
                    onClick={() => openEditModal(group)}
                    className="py-1.5 px-2 bg-gray-100 text-gray-700 hover:bg-gray-200 text-xs font-medium rounded-lg transition"
                  >
                    Edit
                  </button>

                  <button
                    onClick={() => handleDeleteGroup(group)}
                    disabled={isMainKas || actionLoading === `delete-${group.id}`}
                    title={isMainKas ? "Kas Umum tidak dapat dihapus" : ""}
                    className={`py-1.5 px-2 text-xs font-medium rounded-lg transition ${
                      isMainKas
                        ? 'bg-gray-100 text-gray-400 border border-gray-200 cursor-not-allowed opacity-60'
                        : 'bg-red-50 text-red-600 hover:bg-red-100 border border-red-200'
                    }`}
                  >
                    {actionLoading === `delete-${group.id}` ? '...' : 'Hapus'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Creation/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 relative">
            <h3 className="text-lg font-bold text-gray-800 mb-4">
              {isEditing ? 'Edit Kelompok Kas' : 'Buat Kelompok Kas Baru'}
            </h3>

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
                  {!isEditing && (
                    <button
                      type="button"
                      onClick={() => setCode(generateUniqueCode())}
                      className="px-3 py-2 bg-gray-200 text-gray-700 text-xs rounded-lg hover:bg-gray-300 font-medium"
                    >
                      Acak
                    </button>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1 uppercase">
                  Nama Kas <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="misal: Kas 1 - Kebersihan"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1 uppercase">
                  Deskripsi <span className="text-red-500">*</span>
                </label>
                <textarea
                  placeholder="Keterangan mengenai peruntukan kas ini..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
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