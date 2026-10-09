import React, { useState, useEffect } from 'react';
import { supabase } from './lib/supabase';
import { 
  Users, 
  Wallet, 
  CheckCircle, 
  AlertCircle, 
  Trophy, 
  Calendar, 
  Clock, 
  ArrowUpRight 
} from 'lucide-react';

export default function UserDashboard() {
  const [loading, setLoading] = useState<boolean>(true);
  const [_currentUser, setCurrentUser] = useState<any>(null);
  
  // Stats
  const [joinedGroupsCount, setJoinedGroupsCount] = useState<number>(0);
  const [totalPaidAmount, setTotalPaidAmount] = useState<number>(0);
  const [unpaidCount, setUnpaidCount] = useState<number>(0);

  // Lists
  const [myArisanGroups, setMyArisanGroups] = useState<any[]>([]);
  const [myPayments, setMyPayments] = useState<any[]>([]);

  useEffect(() => {
    fetchUserDashboardData();
  }, []);

  const fetchUserDashboardData = async () => {
    setLoading(true);
    try {
      // 1. Get Logged-in User
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }
      setCurrentUser(user);

      // 2. Fetch User's Arisan Group Memberships
      const { data: memberships, error: memberErr } = await supabase
        .from('group_members')
        .select(`
          id,
          group_id,
          member_number,
          is_winner,
          arisan_groups (
            id,
            group_code,
            group_name,
            nominal,
            cycle_schedule,
            cycle_count,
            status
          )
        `)
        .eq('user_id', user.id);

      if (memberErr) throw memberErr;

      // 3. Fetch User's Payments History (Both Arisan and Kas)
      const { data: paymentsData, error: payErr } = await supabase
        .from('payments')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (payErr) throw payErr;

      // Calculate Totals & Group Details
      const userPayments = paymentsData || [];
      const totalPaid = userPayments.reduce((sum, p) => sum + Math.abs(Number(p.amount) || 0), 0);
      setTotalPaidAmount(totalPaid);
      setMyPayments(userPayments);

      // Process Arisan Groups
      let pendingSetoranCount = 0;
      const formattedGroups = (memberships || []).map((m: any) => {
        const group = m.arisan_groups;
        const currentCycle = parseInt(group?.cycle_schedule || '1');
        
        // Check if user has paid for current cycle
        const hasPaidCurrentCycle = userPayments.some(
          (p) => p.group_id === group?.id && 
                 p.category === 'setoran_arisan' && 
                 p.cycle_schedule === group?.cycle_schedule
        );

        if (!hasPaidCurrentCycle && group?.status === 'aktif') {
          pendingSetoranCount += 1;
        }

        return {
          id: group?.id,
          memberId: m.id,
          groupCode: group?.group_code,
          groupName: group?.group_name,
          nominal: group?.nominal || 0,
          currentCycle: currentCycle,
          totalCycles: group?.cycle_count || 0,
          isWinner: m.is_winner,
          hasPaidCurrentCycle: hasPaidCurrentCycle,
          status: group?.status,
        };
      });

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
          Dashboard Anggota
        </h2>
        <p className="text-sm text-gray-500 mt-1">
          Pantau status keikutsertaan arisan, jadwal setoran, dan riwayat pembayaran Anda.
        </p>
      </div>

      {/* KPI Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Joined Groups */}
        <div className="bg-white border border-gray-200 p-5 rounded-2xl shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Arisan Diikuti</span>
            <Users className="w-5 h-5 text-indigo-600" />
          </div>
          <p className="text-2xl font-black text-indigo-900 mt-2">
            {joinedGroupsCount} <span className="text-sm font-normal text-gray-500">Kelompok</span>
          </p>
        </div>

        {/* Total Setoran */}
        <div className="bg-white border border-gray-200 p-5 rounded-2xl shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Total Setoran Saya</span>
            <Wallet className="w-5 h-5 text-emerald-600" />
          </div>
          <p className="text-2xl font-black text-emerald-600 mt-2">
            Rp {totalPaidAmount.toLocaleString('id-ID')}
          </p>
        </div>

        {/* Pending Setoran Alert */}
        <div className="bg-white border border-gray-200 p-5 rounded-2xl shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Tagihan Periode Ini</span>
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

      {/* SECTION 1: MY ARISAN GROUPS */}
      <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm space-y-4">
        <h3 className="font-bold text-gray-900 text-base flex items-center gap-2">
          <Trophy className="w-5 h-5 text-amber-500" />
          Kelompok Arisan Saya
        </h3>

        {myArisanGroups.length === 0 ? (
          <div className="text-center py-6 text-gray-400 text-sm">
            Anda belum bergabung dalam kelompok arisan manapun.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {myArisanGroups.map((g) => (
              <div 
                key={g.id} 
                className="border border-gray-200 rounded-xl p-4 bg-gray-50/50 hover:bg-gray-50 transition space-y-3"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <span className="text-[10px] font-extrabold uppercase bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded">
                      {g.groupCode}
                    </span>
                    <h4 className="font-bold text-gray-900 text-base mt-1">{g.groupName}</h4>
                  </div>
                  <span className={`text-xs px-2.5 py-1 rounded-full font-bold ${
                    g.status === 'aktif' ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-200 text-gray-700'
                  }`}>
                    {g.status === 'aktif' ? 'Aktif' : 'Selesai'}
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
                      Ronde #{g.currentCycle} / {g.totalCycles}
                    </span>
                  </div>
                </div>

                <div className="flex justify-between items-center text-xs">
                  {/* Winner Badge */}
                  <div>
                    {g.isWinner ? (
                      <span className="inline-flex items-center gap-1 font-bold text-amber-600 bg-amber-50 border border-amber-200 px-2 py-1 rounded-lg">
                        <Trophy className="w-3.5 h-3.5" /> Sudah Menang
                      </span>
                    ) : (
                      <span className="text-gray-500 italic">Belum Menang</span>
                    )}
                  </div>

                  {/* Payment Status for current cycle */}
                  <div>
                    {g.hasPaidCurrentCycle ? (
                      <span className="inline-flex items-center gap-1 font-bold text-emerald-700 bg-emerald-100 px-2 py-1 rounded-lg">
                        <CheckCircle className="w-3.5 h-3.5" /> Setoran Lunas
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 font-bold text-amber-700 bg-amber-100 px-2 py-1 rounded-lg">
                        <Clock className="w-3.5 h-3.5" /> Belum Setor (Ronde #{g.currentCycle})
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* SECTION 2: PAYMENT HISTORY LOGS */}
      <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm space-y-4">
        <h3 className="font-bold text-gray-900 text-base flex items-center gap-2">
          <Calendar className="w-5 h-5 text-indigo-600" />
          Riwayat Transaksi & Setoran Saya
        </h3>

        <div className="overflow-x-auto border border-gray-200 rounded-xl">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-gray-100 text-gray-700 border-b border-gray-200 font-bold uppercase">
              <tr>
                <th className="py-3 px-4">No. Resi / Tanggal</th>
                <th className="py-3 px-4">Kategori</th>
                <th className="py-3 px-4">Kocokan / Ket</th>
                <th className="py-3 px-4 text-right">Nominal</th>
                <th className="py-3 px-4 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {myPayments.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-6 text-gray-400">
                    Belum ada riwayat transaksi setoran.
                  </td>
                </tr>
              ) : (
                myPayments.map((p) => (
                  <tr key={p.id} className="hover:bg-gray-50 transition">
                    <td className="py-3 px-4">
                      <p className="font-bold text-gray-800">{p.receipt_number || '-'}</p>
                      <p className="text-[10px] text-gray-400">
                        {new Date(p.created_at).toLocaleDateString('id-ID', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </p>
                    </td>
                    <td className="py-3 px-4">
                      <span className={`font-semibold ${
                        p.category === 'setoran_arisan' ? 'text-indigo-600' : 'text-emerald-600'
                      }`}>
                        {p.category === 'setoran_arisan' ? 'Setoran Arisan' : 'Kas Operasional'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-gray-600">
                      {p.cycle_schedule ? `Kocokan Ke-${p.cycle_schedule}` : p.description || '-'}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-gray-900">
                      Rp {Math.abs(Number(p.amount) || 0).toLocaleString('id-ID')}
                    </td>
                    <td className="py-3 px-4 text-center">
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
    </div>
  );
}