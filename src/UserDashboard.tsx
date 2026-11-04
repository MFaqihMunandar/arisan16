import { useState, useEffect } from 'react';
import { supabase } from './lib/supabase';
import { 
  Users, 
  Wallet, 
  CheckCircle, 
  AlertCircle, 
  Trophy, 
  Clock,
  Layers,
  Receipt
} from 'lucide-react';

interface UserDashboardProps {
  currentUserId?: string;
}

export default function UserDashboard({ currentUserId }: UserDashboardProps) {
  const [loading, setLoading] = useState<boolean>(true);
  
  // Stats
  const [joinedGroupsCount, setJoinedGroupsCount] = useState<number>(0);
  const [totalPaidAmount, setTotalPaidAmount] = useState<number>(0);
  const [unpaidCount, setUnpaidCount] = useState<number>(0);

  // Data State
  const [myArisanGroups, setMyArisanGroups] = useState<any[]>([]);
  const [paymentsByGroup, setPaymentsByGroup] = useState<{ [groupId: string]: any[] }>({});

  useEffect(() => {
    fetchUserDashboardData();
  }, [currentUserId]);

  const fetchUserDashboardData = async () => {
    setLoading(true);
    try {
      // 1. Dapatkan User ID Target
      let targetUserId = currentUserId;

      if (!targetUserId) {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          setLoading(false);
          return;
        }
        targetUserId = user.id;
      }

      // 2. Fetch Keanggotaan Kelompok Arisan (group_members -> arisan_groups)
      const { data: memberships, error: memberErr } = await supabase
        .from('group_members')
        .select(`
          id,
          group_id,
          is_winner,
          has_won,
          arisan_groups (
            id,
            code,
            name,
            contribution_amount,
            cycle_schedule,
            cycle_count,
            is_active
          )
        `)
        .eq('user_id', targetUserId);

      if (memberErr) throw memberErr;

      // 3. Fetch Riwayat Pembayaran User dari tabel payments
      const { data: paymentsData, error: payErr } = await supabase
        .from('payments')
        .select('*')
        .eq('user_id', targetUserId)
        .order('created_at', { ascending: false });

      if (payErr) throw payErr;

      const userPayments = paymentsData || [];
      const totalPaid = userPayments.reduce((sum, p) => sum + Math.abs(Number(p.amount) || 0), 0);
      setTotalPaidAmount(totalPaid);

      // Grouping Transaksi berdasarkan group_id
      const groupedPayments: { [groupId: string]: any[] } = {};
      userPayments.forEach((p) => {
        const key = p.group_id || 'umum';
        if (!groupedPayments[key]) groupedPayments[key] = [];
        groupedPayments[key].push(p);
      });
      setPaymentsByGroup(groupedPayments);

      // Process Kelompok Arisan & Status Tagihan
      let pendingSetoranCount = 0;
      const formattedGroups = (memberships || []).map((m: any) => {
        const group = m.arisan_groups;
        if (!group) return null;

        const currentCycle = String(group?.cycle_schedule || '1');
        
        // Cek apakah user sudah membayar setoran pada ronde berjalan ini
        const hasPaidCurrentCycle = userPayments.some(
          (p) => p.group_id === group?.id && 
                 p.category === 'setoran_arisan' && 
                 String(p.cycle_schedule) === currentCycle
        );

        if (!hasPaidCurrentCycle && group?.is_active) {
          pendingSetoranCount += 1;
        }

        return {
          id: group?.id,
          memberId: m.id,
          groupCode: group?.code || 'ARS',
          groupName: group?.name || 'Tanpa Nama',
          nominal: Number(group?.contribution_amount) || 0,
          currentCycle: currentCycle,
          totalCycles: group?.cycle_count || 0,
          isWinner: m.is_winner || m.has_won,
          hasPaidCurrentCycle: hasPaidCurrentCycle,
          isActive: group?.is_active,
        };
      }).filter(Boolean);

      setJoinedGroupsCount(formattedGroups.length);
      setUnpaidCount(pendingSetoranCount);
      setMyArisanGroups(formattedGroups);

    } catch (err) {
      console.error('Error fetching user dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="w-full text-center py-12 text-gray-500 font-medium">
        Memuat Dashboard Anggota...
      </div>
    );
  }

  return (
    <div className="w-full space-y-6">
      {/* Header */}
      <div className="border-b border-gray-200 pb-4">
        <h2 className="text-2xl font-extrabold text-gray-900 flex items-center gap-2">
          <Users className="w-7 h-7 text-indigo-600" />
          Dashboard Saya
        </h2>
        <p className="text-sm text-gray-500 mt-1">
          Informasi kelompok arisan, tagihan berjalan, dan rincian setoran Anda.
        </p>
      </div>

      {/* Overview Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-gray-200 p-5 rounded-2xl shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Arisan Diikuti[cite: 1]</span>
            <Users className="w-5 h-5 text-indigo-600" />
          </div>
          <p className="text-2xl font-black text-indigo-900 mt-2">
            {joinedGroupsCount} <span className="text-sm font-normal text-gray-500">Kelompok</span>
          </p>
        </div>

        <div className="bg-white border border-gray-200 p-5 rounded-2xl shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Total Setoran Saya</span>
            <Wallet className="w-5 h-5 text-emerald-600" />
          </div>
          <p className="text-2xl font-black text-emerald-600 mt-2">
            Rp {totalPaidAmount.toLocaleString('id-ID')}
          </p>
        </div>

        <div className="bg-white border border-gray-200 p-5 rounded-2xl shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Tagihan Periode Ini[cite: 1]</span>
            {unpaidCount > 0 ? (
              <AlertCircle className="w-5 h-5 text-amber-500" />
            ) : (
              <CheckCircle className="w-5 h-5 text-emerald-500" />
            )}
          </div>
          <p className={`text-2xl font-black mt-2 ${unpaidCount > 0 ? 'text-amber-600' : 'text-gray-800'}`}>
            {unpaidCount > 0 ? `${unpaidCount} Perlu Dibayar` : 'Semua Lunas'}
          </p>
        </div>
      </div>

      {/* 1. BAGIAN: ARISAN DIikuti & 3. TAGIHAN PERIODE INI */}
      <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm space-y-4">
        <h3 className="font-bold text-gray-900 text-base flex items-center gap-2">
          <Trophy className="w-5 h-5 text-amber-500" />
          1. Kelompok Arisan Saya & Tagihan Periode Ini
        </h3>

        {myArisanGroups.length === 0 ? (
          <div className="text-center py-6 text-gray-400 text-sm">
            Anda belum terdaftar dalam kelompok arisan manapun.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {myArisanGroups.map((g) => (
              <div 
                key={g.id} 
                className={`border rounded-xl p-4 transition space-y-3 ${
                  !g.hasPaidCurrentCycle && g.isActive 
                    ? 'border-amber-300 bg-amber-50/30' 
                    : 'border-gray-200 bg-gray-50/50'
                }`}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <span className="text-[10px] font-extrabold uppercase bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded">
                      {g.groupCode}
                    </span>
                    <h4 className="font-bold text-gray-900 text-base mt-1">{g.groupName}</h4>
                  </div>
                  <span className={`text-xs px-2.5 py-1 rounded-full font-bold ${
                    g.isActive ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-200 text-gray-700'
                  }`}>
                    {g.isActive ? 'Aktif' : 'Selesai'}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs border-y border-gray-200/60 py-2">
                  <div>
                    <span className="text-gray-500 block">Nominal Setoran:</span>
                    <span className="font-bold text-gray-800">Rp {g.nominal.toLocaleString('id-ID')}</span>
                  </div>
                  <div>
                    <span className="text-gray-500 block">Kocokan Saat Ini:</span>
                    <span className="font-bold text-indigo-600">
                      Ronde #{g.currentCycle} {g.totalCycles ? `/ ${g.totalCycles}` : ''}
                    </span>
                  </div>
                </div>

                {/* Status Kemenangan & Tagihan Periode Ini */}
                <div className="space-y-2 pt-1">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-gray-500">Status Pemenang:</span>
                    {g.isWinner ? (
                      <span className="inline-flex items-center gap-1 font-bold text-amber-700 bg-amber-100 border border-amber-300 px-2 py-0.5 rounded-md">
                        <Trophy className="w-3 h-3" /> Sudah Menang
                      </span>
                    ) : (
                      <span className="text-gray-600 font-medium">Belum Menang</span>
                    )}
                  </div>

                  <div className="flex justify-between items-center text-xs border-t border-dashed border-gray-200 pt-2">
                    <span className="text-gray-600 font-semibold">Tagihan Ronde #{g.currentCycle}:</span>
                    {g.hasPaidCurrentCycle ? (
                      <span className="inline-flex items-center gap-1 font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-md">
                        <CheckCircle className="w-3 h-3" /> Lunas (Rp {g.nominal.toLocaleString('id-ID')})
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 font-bold text-amber-800 bg-amber-200 px-2 py-0.5 rounded-md">
                        <Clock className="w-3 h-3" /> Wajib Bayar: Rp {g.nominal.toLocaleString('id-ID')}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 2. BAGIAN: SETORAN GROUP BY EACH ARISAN */}
      <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm space-y-6">
        <h3 className="font-bold text-gray-900 text-base flex items-center gap-2">
          <Layers className="w-5 h-5 text-indigo-600" />
          2. Riwayat Setoran per Kelompok Arisan[cite: 1]
        </h3>

        {myArisanGroups.length === 0 ? (
          <div className="text-center py-4 text-gray-400 text-sm">
            Belum ada kelompok arisan.
          </div>
        ) : (
          myArisanGroups.map((group) => {
            const groupLogs = paymentsByGroup[group.id] || [];
            return (
              <div key={group.id} className="border border-gray-200 rounded-xl overflow-hidden">
                {/* Header Sub-Tabel Kelompok */}
                <div className="bg-indigo-50/70 border-b border-gray-200 px-4 py-3 flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <Receipt className="w-4 h-4 text-indigo-600" />
                    <span className="font-bold text-gray-900 text-sm">{group.groupName}</span>
                    <span className="text-[10px] font-bold bg-indigo-200 text-indigo-800 px-2 py-0.5 rounded">
                      {group.groupCode}
                    </span>
                  </div>
                  <span className="text-xs font-semibold text-gray-600">
                    Total Transaksi: {groupLogs.length} Kali
                  </span>
                </div>

                {/* Tabel Transaksi Per Kelompok */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-gray-50 text-gray-600 border-b border-gray-200 font-bold uppercase">
                      <tr>
                        <th className="py-2.5 px-4">No. Resi / Tanggal</th>
                        <th className="py-2.5 px-4">Kategori</th>
                        <th className="py-2.5 px-4">Ronde / Ket</th>
                        <th className="py-2.5 px-4 text-right">Nominal Setoran</th>
                        <th className="py-2.5 px-4 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {groupLogs.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="text-center py-4 text-gray-400 italic">
                            Belum ada riwayat setoran untuk kelompok ini.
                          </td>
                        </tr>
                      ) : (
                        groupLogs.map((p) => (
                          <tr key={p.id} className="hover:bg-gray-50 transition">
                            <td className="py-2.5 px-4">
                              <p className="font-bold text-gray-800">{p.receipt_number || '-'}</p>
                              <p className="text-[10px] text-gray-400">
                                {new Date(p.created_at).toLocaleDateString('id-ID', {
                                  day: '2-digit',
                                  month: 'short',
                                  year: 'numeric',
                                })}
                              </p>
                            </td>
                            <td className="py-2.5 px-4 font-semibold text-indigo-600">
                              {p.category === 'setoran_arisan' ? 'Setoran Arisan' : p.category}
                            </td>
                            <td className="py-2.5 px-4 text-gray-600">
                              {p.cycle_schedule ? `Kocokan Ke-${p.cycle_schedule}` : p.description || '-'}
                            </td>
                            <td className="py-2.5 px-4 text-right font-mono font-bold text-gray-900">
                              Rp {Math.abs(Number(p.amount) || 0).toLocaleString('id-ID')}
                            </td>
                            <td className="py-2.5 px-4 text-center">
                              <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                                <CheckCircle className="w-3 h-3" /> Sukses
                              </span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}