import { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { supabase } from './lib/supabase';
import { PiggyBank, Printer, Download, ChevronDown, ChevronRight, AlertTriangle, UserX } from 'lucide-react';

interface MemberUnpaidSummary {
  userId: string;
  fullName: string;
  email: string;
  groupName: string;
  unpaidCycles: number[];
  unpaidCount: number;
  contributionAmount: number;
  totalUnpaidAmount: number;
}

interface LaporanArisanProps {
  currentUserId?: string;
}

export default function LaporanArisan({ currentUserId }: LaporanArisanProps) {
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const [selectedArisanGroupId, setSelectedArisanGroupId] = useState<string>('all');

  const [arisanGroups, setArisanGroups] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [drawHistory, setDrawHistory] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<any[]>([]);
  const [groupMembers, setGroupMembers] = useState<any[]>([]);
  const [unpaidSummaries, setUnpaidSummaries] = useState<MemberUnpaidSummary[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  const [expandedUnpaid, setExpandedUnpaid] = useState<Record<string, boolean>>({});

  const yearOptions = Array.from({ length: 5 }, (_, index) => currentYear - index);

  useEffect(() => {
    fetchArisanData();
  }, [selectedYear]);

  const fetchArisanData = async () => {
    setLoading(true);
    const startOfYear = new Date(`${selectedYear}-01-01T00:00:00.000Z`).toISOString();
    const endOfYear = new Date(`${selectedYear}-12-31T23:59:59.999Z`).toISOString();

    try {
      const { data: arisanData } = await supabase.from('arisan_groups').select('*').order('created_at', { ascending: false });
      setArisanGroups(arisanData || []);

      if (arisanData && arisanData.length > 0) {
        setExpandedGroups((prev) => ({ ...prev, [arisanData[0].id]: true }));
      }

      const { data: profilesData } = await supabase.from('profiles').select('id, full_name, email');
      setProfiles(profilesData || []);
      const profileMap = new Map((profilesData || []).map((p: any) => [p.id, p]));

      const { data: paymentsData } = await supabase
        .from('payments')
        .select('*')
        .gte('created_at', startOfYear)
        .lte('created_at', endOfYear)
        .order('created_at', { ascending: false });

      const enrichedPayments = (paymentsData || []).map((p: any) => ({
        ...p,
        profile: profileMap.get(p.user_id) || { full_name: 'Tanpa Nama', email: '-' },
      }));
      setPayments(enrichedPayments);

      const { data: drawData } = await supabase
        .from('draw_history')
        .select('*')
        .gte('created_at', startOfYear)
        .lte('created_at', endOfYear)
        .order('created_at', { ascending: false });

      const enrichedDraws = (drawData || []).map((d: any) => ({
        ...d,
        profile: profileMap.get(d.winner_id) || { full_name: 'Tanpa Nama', email: '-' },
      }));
      setDrawHistory(enrichedDraws);

      const { data: membersData } = await supabase.from('group_members').select('*');
      setGroupMembers(membersData || []);

      calculateUnpaidSetoran(arisanData || [], membersData || [], enrichedPayments, profileMap);
    } catch (err) {
      console.error('Error loading arisan report data:', err);
    } finally {
      setLoading(false);
    }
  };

  const calculateUnpaidSetoran = (
    groups: any[],
    members: any[],
    allPayments: any[],
    profileMap: Map<string, any>
  ) => {
    const summaries: MemberUnpaidSummary[] = [];

    groups.forEach((group) => {
      const currentCycleNum = parseInt(group.cycle_schedule || '1', 10);
      const currentGroupMembers = members.filter((m) => m.group_id === group.id);

      currentGroupMembers.forEach((member) => {
        const userProfile = profileMap.get(member.user_id) || { full_name: 'Tanpa Nama', email: '-' };
        const paidCycles = new Set<number>(
          allPayments
            .filter((p) => p.group_id === group.id && p.user_id === member.user_id && p.category === 'setoran_arisan')
            .map((p) => parseInt(p.cycle_schedule || '0', 10))
        );

        const missedCycles: number[] = [];
        const limitCycle = group.is_active ? currentCycleNum : (group.total_periods || currentCycleNum);

        for (let cycle = 1; cycle <= limitCycle; cycle++) {
          if (!paidCycles.has(cycle)) {
            missedCycles.push(cycle);
          }
        }

        if (missedCycles.length > 0) {
          const nominal = group.contribution_amount || 0;
          summaries.push({
            userId: member.user_id,
            fullName: userProfile.full_name,
            email: userProfile.email,
            groupName: group.name,
            unpaidCycles: missedCycles,
            unpaidCount: missedCycles.length,
            contributionAmount: nominal,
            totalUnpaidAmount: missedCycles.length * nominal,
          });
        }
      });
    });

    setUnpaidSummaries(summaries);
  };

  const handleExportExcel = () => {
    if (displayArisanGroups.length === 0) return;

    const wb = XLSX.utils.book_new();
    const usedSheetNames = new Set<string>();

    displayArisanGroups.forEach((group, index) => {
      const currentMembers = groupMembers.filter((m) => m.group_id === group.id);
      const totalCyclesCount = currentMembers.length > 0 ? currentMembers.length : (group.total_periods || 1);
      const cyclesList = Array.from({ length: totalCyclesCount }, (_, i) => i + 1);

      const rows = currentMembers.map((member, idx) => {
        const profile = profiles.find((p) => p.id === member.user_id);
        const rowObj: Record<string, any> = {
          'No': idx + 1,
          'Nama Anggota': profile?.full_name || 'Tanpa Nama',
        };

        cyclesList.forEach((cycleNum) => {
          const hasPaid = payments.some(
            (p) =>
              p.group_id === group.id &&
              p.user_id === member.user_id &&
              parseInt(p.cycle_schedule || '0', 10) === cycleNum &&
              p.category === 'setoran_arisan'
          );
          rowObj[`Kocokan ${cycleNum}`] = hasPaid ? 'O' : 'X';
        });

        return rowObj;
      });

      const ws = XLSX.utils.json_to_sheet(rows);

      // Clean invalid characters and limit length for Excel sheet names
      let baseName = (group.name || `Arisan_${index + 1}`)
        .replace(/[\\/?*:[\]]/g, '')
        .trim();
      
      if (!baseName) baseName = `Arisan_${index + 1}`;
      
      let sheetName = baseName.slice(0, 30);
      let counter = 1;

      // Ensure sheet name is unique across the workbook
      while (usedSheetNames.has(sheetName.toLowerCase())) {
        const suffix = `_${counter}`;
        sheetName = `${baseName.slice(0, 30 - suffix.length)}${suffix}`;
        counter++;
      }

      usedSheetNames.add(sheetName.toLowerCase());
      XLSX.utils.book_append_sheet(wb, ws, sheetName);
    });

    XLSX.writeFile(wb, `Laporan_Arisan_Matrix_${selectedYear}.xlsx`);
  };

  const toggleGroupExpand = (groupId: string) => {
    setExpandedGroups((prev) => ({ ...prev, [groupId]: !prev[groupId] }));
  };

  const toggleUnpaidExpand = (groupId: string) => {
    setExpandedUnpaid((prev) => ({ ...prev, [groupId]: !prev[groupId] }));
  };

  const displayArisanGroups = arisanGroups.filter((g) =>
    selectedArisanGroupId === 'all' || g.id === selectedArisanGroupId
  );

  const arisanSetoranTotal = payments
    .filter((p) => (selectedArisanGroupId === 'all' || p.group_id === selectedArisanGroupId) && p.category === 'setoran_arisan')
    .reduce((sum, p) => sum + Math.abs(Number(p.amount) || 0), 0);

  const arisanPencairanTotal = payments
    .filter((p) => (selectedArisanGroupId === 'all' || p.group_id === selectedArisanGroupId) && p.category === 'pencairan_arisan')
    .reduce((sum, p) => sum + Math.abs(Number(p.amount) || 0), 0);

  return (
    <div className="w-full space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-200 pb-4">
        <div>
          <h2 className="text-2xl font-extrabold text-gray-900 flex items-center gap-2">
            <PiggyBank className="w-7 h-7 text-blue-600" />
            Laporan Arisan per Periode
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            Rekapitulasi status pembayaran setoran anggota arisan per kocokan.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start md:self-auto">
          <button
            onClick={handleExportExcel}
            className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-xl font-bold text-xs transition flex items-center gap-2 shadow-md active:scale-95"
          >
            <Download className="w-4 h-4" />
            Download Data (Excel)
          </button>

          <button
            onClick={() => window.print()}
            className="bg-gray-900 hover:bg-black text-white px-4 py-2.5 rounded-xl font-bold text-xs transition flex items-center gap-2 shadow-md active:scale-95"
          >
            <Printer className="w-4 h-4" />
            Cetak Laporan
          </button>
        </div>
      </div>

      {/* Filter Controls */}
      <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-bold text-gray-600 mb-1 uppercase">Tahun Laporan</label>
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-xl text-xs font-bold text-gray-800 focus:ring-2 focus:ring-blue-500"
          >
            {yearOptions.map((year) => (
              <option key={year} value={year}>
                Tahun {year}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-bold text-gray-600 mb-1 uppercase">Filter Kode / Grup Arisan</label>
          <select
            value={selectedArisanGroupId}
            onChange={(e) => setSelectedArisanGroupId(e.target.value)}
            className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-xl text-xs font-semibold text-gray-800 focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">-- Semua Kode / Grup Arisan --</option>
            {arisanGroups.map((g) => (
              <option key={g.id} value={g.id}>
                [{g.code || g.id.slice(0, 6)}] {g.name} {!g.is_active ? '(Selesai)' : ''}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-white border border-gray-200 p-5 rounded-2xl shadow-sm">
          <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Total Setoran Arisan</span>
          <p className="text-2xl font-black text-blue-600 mt-2">
            Rp {arisanSetoranTotal.toLocaleString('id-ID')}
          </p>
        </div>
        <div className="bg-white border border-gray-200 p-5 rounded-2xl shadow-sm">
          <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Total Pencairan Arisan</span>
          <p className="text-2xl font-black text-emerald-600 mt-2">
            Rp {arisanPencairanTotal.toLocaleString('id-ID')}
          </p>
        </div>
      </div>

      {/* Main Content */}
      {loading ? (
        <div className="py-12 text-center text-gray-400 text-xs">Memuat data laporan arisan...</div>
      ) : displayArisanGroups.length === 0 ? (
        <div className="text-center py-12 text-gray-400 text-xs">Tidak ada data arisan ditemukan.</div>
      ) : (
        <div className="space-y-6">
          {displayArisanGroups.map((group) => {
            const isExpanded = !!expandedGroups[group.id];
            const currentMembers = groupMembers.filter((m) => m.group_id === group.id);

            const groupPayments = payments.filter((p) => p.group_id === group.id);
            const totalCollected = groupPayments
              .filter((p) => p.category === 'setoran_arisan')
              .reduce((sum, p) => sum + Math.abs(Number(p.amount) || 0), 0);

            const totalDisbursed = groupPayments
              .filter((p) => p.category === 'pencairan_arisan')
              .reduce((sum, p) => sum + Math.abs(Number(p.amount) || 0), 0);

            const groupBalance = totalCollected - totalDisbursed;
            const isCompleted = !group.is_active;
            const hasDiscrepancy = isCompleted && groupBalance !== 0;

            const groupUnpaidMembers = unpaidSummaries.filter((u) => u.groupName === group.name);

            // Calculate total cycles according to total member count
            const totalCyclesCount = currentMembers.length > 0 ? currentMembers.length : (group.total_periods || 1);
            const cyclesList = Array.from({ length: totalCyclesCount }, (_, i) => i + 1);

            return (
              <div key={group.id} className="border border-gray-200 rounded-2xl overflow-hidden bg-white shadow-sm">
                {/* Header */}
                <div
                  onClick={() => toggleGroupExpand(group.id)}
                  className="p-4 bg-gray-50 hover:bg-gray-100/80 cursor-pointer transition flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-gray-200"
                >
                  <div className="flex items-center gap-3">
                    {isExpanded ? (
                      <ChevronDown className="w-5 h-5 text-gray-500 shrink-0" />
                    ) : (
                      <ChevronRight className="w-5 h-5 text-gray-500 shrink-0" />
                    )}
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold bg-blue-100 text-blue-800 px-2 py-0.5 rounded">
                          {group.code || group.id.slice(0, 6)}
                        </span>
                        <h3 className="font-bold text-gray-900 text-base">{group.name}</h3>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          isCompleted ? 'bg-gray-200 text-gray-700' : 'bg-emerald-100 text-emerald-800'
                        }`}>
                          {isCompleted ? 'Selesai' : 'Aktif'}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">
                        Setoran: Rp {(group.contribution_amount || 0).toLocaleString('id-ID')} / Orang | {currentMembers.length} Peserta
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 text-right">
                    <div>
                      <div className="text-[10px] uppercase font-bold text-gray-400">Total Masuk / Keluar</div>
                      <div className="text-xs font-extrabold text-gray-800">
                        Rp {totalCollected.toLocaleString('id-ID')} / Rp {totalDisbursed.toLocaleString('id-ID')}
                      </div>
                    </div>
                    {hasDiscrepancy ? (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleUnpaidExpand(group.id);
                        }}
                        className="bg-amber-100 hover:bg-amber-200 border border-amber-300 text-amber-900 px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition animate-pulse"
                      >
                        <AlertTriangle className="w-4 h-4 text-amber-600" />
                        Selisih: Rp {groupBalance.toLocaleString('id-ID')}
                      </button>
                    ) : (
                      <div className="bg-gray-100 px-3 py-1.5 rounded-xl text-xs font-bold text-gray-700">
                        Saldo: Rp {groupBalance.toLocaleString('id-ID')}
                      </div>
                    )}
                  </div>
                </div>

                {/* Body Content */}
                {isExpanded && (
                  <div className="p-4 space-y-4 bg-gray-50/30">
                    {/* Unpaid Warning Box */}
                    {hasDiscrepancy && expandedUnpaid[group.id] && (
                      <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-xs space-y-2">
                        <h5 className="font-bold text-red-900 flex items-center gap-1.5">
                          <UserX className="w-4 h-4 text-red-600" />
                          Daftar Anggota Belum Lunas:
                        </h5>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                          {groupUnpaidMembers.map((m) => (
                            <div key={m.userId} className="bg-white border border-red-100 rounded-lg p-2.5 flex justify-between items-center shadow-sm">
                              <div>
                                <p className="font-bold text-gray-800">{m.fullName}</p>
                                <p className="text-[10px] text-gray-400">Kocokan late: #{m.unpaidCycles.join(', #')}</p>
                              </div>
                              <p className="font-black text-red-600">Rp {m.totalUnpaidAmount.toLocaleString('id-ID')}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Matrix Table View */}
                    <div className="overflow-x-auto border border-gray-200 rounded-xl bg-white shadow-sm">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead className="bg-gray-100 text-gray-700 font-bold border-b border-gray-200">
                          <tr>
                            <th className="py-3 px-3 text-center border-r border-gray-200 w-12">nomor</th>
                            <th className="py-3 px-4 border-r border-gray-200 min-w-[160px]">nama</th>
                            {cyclesList.map((cycleNum) => (
                              <th key={cycleNum} className="py-3 px-2 text-center border-r border-gray-200 min-w-[70px]">
                                kocokan {cycleNum}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 text-gray-800 font-medium">
                          {currentMembers.length === 0 ? (
                            <tr>
                              <td colSpan={2 + cyclesList.length} className="text-center py-6 text-gray-400">
                                Belum ada anggota terdaftar pada grup ini.
                              </td>
                            </tr>
                          ) : (
                            currentMembers.map((member, idx) => {
                              const profile = profiles.find((p) => p.id === member.user_id);
                              const memberName = profile?.full_name || 'Tanpa Nama';

                              return (
                                <tr key={member.id} className="hover:bg-gray-50 transition">
                                  <td className="py-2.5 px-3 text-center border-r border-gray-200 font-mono text-gray-500 font-semibold">
                                    {idx + 1}
                                  </td>
                                  <td className="py-2.5 px-4 border-r border-gray-200 font-bold text-gray-900">
                                    {memberName}
                                  </td>
                                  {cyclesList.map((cycleNum) => {
                                    const hasPaid = groupPayments.some(
                                      (p) =>
                                        p.user_id === member.user_id &&
                                        parseInt(p.cycle_schedule || '0', 10) === cycleNum &&
                                        p.category === 'setoran_arisan'
                                    );

                                    return (
                                      <td key={cycleNum} className="py-2.5 px-2 text-center border-r border-gray-200 font-mono font-black text-xs">
                                        {hasPaid ? (
                                          <span className="text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">O</span>
                                        ) : (
                                          <span className="text-red-600 bg-red-50 px-2 py-0.5 rounded border border-red-200">X</span>
                                        )}
                                      </td>
                                    );
                                  })}
                                </tr>
                              );
                            })
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}