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

  const fetchGroups = async () => {
    setLoadingGroups(true);
    const { data, error } = await supabase
      .from('kas_groups')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && data) {
      setGroups(data);
    }
    setLoadingGroups(false);
  };

  useEffect(() => {
    fetchGroups();
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
        fetchGroups();
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
        fetchGroups();
      }
    }
  };

  const handleDeleteGroup = async (group: any) => {
    const confirmDelete = window.confirm(
      `HAPUS KELOMPOK KAS?\n\nKelompok "${group.name}" akan dihapus permanen.`
    );

    if (!confirmDelete) return;

    setActionLoading(`delete-${group.id}`);

    const { error } = await supabase
      .from('kas_groups')
      .delete()
      .eq('id', group.id);

    setActionLoading(null);

    if (error) {
      alert('Gagal menghapus kelompok: ' + error.message);
    } else {
      alert(`Kelompok "${group.name}" telah dihapus.`);
      fetchGroups();
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
          {groups.map((group) => (
            <div key={group.id} className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm hover:shadow transition flex flex-col justify-between">
              <div>
                <div className="flex justify-between items-start mb-2 gap-1 flex-wrap">
                  <span className="text-xs font-mono font-bold bg-green-50 text-green-600 px-2 py-1 rounded">
                    {group.code || 'KAS-GROUP'}
                  </span>
                </div>

                <h3 className="font-bold text-gray-800 text-lg mb-1">{group.name}</h3>
                <p className="text-sm text-gray-600 mb-4 line-clamp-3">{group.description}</p>
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
                  disabled={actionLoading === `delete-${group.id}`}
                  className="py-1.5 px-2 bg-red-50 text-red-600 hover:bg-red-100 border border-red-200 text-xs font-medium rounded-lg transition"
                >
                  {actionLoading === `delete-${group.id}` ? '...' : 'Hapus'}
                </button>
              </div>
            </div>
          ))}
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