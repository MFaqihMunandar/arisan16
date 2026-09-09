import React, { useState, useEffect, useRef } from 'react';
import { supabase } from './lib/supabase';
import { Sparkles, Trophy, RotateCw, CheckCircle2, XCircle, Award, Trash2, Search, AlertCircle } from 'lucide-react';

interface ArisanGroup {
  id: string;
  name: string;
  description: string;
  contribution_amount: number;
  cycle_schedule: string; // Current active cycle number
  cycle_count?: number;
  is_active: boolean;
}

interface GroupMember {
  id: string;
  user_id: string;
  has_won: boolean;
  profiles: {
    full_name: string;
    email: string;
  };
}

interface UnpaidMemberInfo {
  member: GroupMember;
  lastPaidCycle: number;
  gapCount: number; // Number of missed cycles
}

interface PengocokanArisanProps {
  currentUserId?: string;
  onNavigateToGroupManagement?: () => void;
}

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EC4899', '#8B5CF6', '#06B6D4', '#F97316', '#14B8A6'];

export const PengocokanArisan: React.FC<PengocokanArisanProps> = ({ 
  currentUserId, 
  onNavigateToGroupManagement 
}) => {
  const [activeGroups, setActiveGroups] = useState<ArisanGroup[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string>('');
  const [selectedGroup, setSelectedGroup] = useState<ArisanGroup | null>(null);

  const [groupMembers, setGroupMembers] = useState<GroupMember[]>([]);
  const [eligibleMembers, setEligibleMembers] = useState<GroupMember[]>([]);
  const [unpaidMembersInfo, setUnpaidMembersInfo] = useState<UnpaidMemberInfo[]>([]);

  const [paidSearchTerm, setPaidSearchTerm] = useState<string>('');
  const [unpaidSearchTerm, setUnpaidSearchTerm] = useState<string>('');

  const [isSpinning, setIsSpinning] = useState<boolean>(false);
  const [winner, setWinner] = useState<GroupMember | null>(null);
  const [showWinnerModal, setShowWinnerModal] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [rotationAngle, setRotationAngle] = useState<number>(0);

  useEffect(() => {
    fetchActiveGroups();
  }, []);

  useEffect(() => {
    if (selectedGroupId) {
      const group = activeGroups.find((g) => g.id === selectedGroupId) || null;
      setSelectedGroup(group);
      if (group) {
        fetchGroupData(group);
      }
    } else {
      setSelectedGroup(null);
      setGroupMembers([]);
      setEligibleMembers([]);
      setUnpaidMembersInfo([]);
    }
  }, [selectedGroupId, activeGroups]);

  useEffect(() => {
    drawWheel();
  }, [eligibleMembers, rotationAngle]);

  const fetchActiveGroups = async () => {
    setErrorMsg('');
    const { data, error } = await supabase
      .from('arisan_groups')
      .select('*')
      .eq('is_active', true);

    if (error) {
      console.error('Error fetching active groups:', error);
      setErrorMsg('Gagal mengambil data grup arisan aktif.');
      setActiveGroups([]);
    } else {
      setActiveGroups(data || []);
    }
  };

  const fetchGroupData = async (group: ArisanGroup) => {
    setErrorMsg('');
    setWinner(null);
    setShowWinnerModal(false);

    try {
      const currentCycleNum = parseInt(group.cycle_schedule, 10) || 1;

      // 1. Fetch group members
      const { data: members, error: membersError } = await supabase
        .from('group_members')
        .select('id, user_id, has_won')
        .eq('group_id', group.id);

      if (membersError) throw membersError;

      if (!members || members.length === 0) {
        setGroupMembers([]);
        setEligibleMembers([]);
        setUnpaidMembersInfo([]);
        return;
      }

      // 2. Fetch profiles
      const userIds = members.map((m) => m.user_id);
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .in('id', userIds);

      if (profilesError) throw profilesError;

      const profileMap = new Map(profilesData?.map((p) => [p.id, p]));
      const fullMembers: GroupMember[] = members.map((m) => ({
        id: m.id,
        user_id: m.user_id,
        has_won: m.has_won ?? false,
        profiles: profileMap.get(m.user_id) || { full_name: 'Tanpa Nama', email: '-' },
      }));

      // 3. Fetch all setoran payments for this group to trace payment history
      const { data: allPayments, error: paymentsError } = await supabase
        .from('payments')
        .select('user_id, cycle_schedule')
        .eq('group_id', group.id)
        .eq('category', 'setoran_arisan');

      if (paymentsError) throw paymentsError;

      // Map last paid cycle per user and track current paid users
      const paidThisCycleUserIds = new Set<string>();
      const userLastPaidMap = new Map<string, number>();

      if (allPayments) {
        allPayments.forEach((p) => {
          const cycleVal = parseInt(p.cycle_schedule, 10) || 0;
          if (cycleVal === currentCycleNum) {
            paidThisCycleUserIds.add(p.user_id);
          }
          const prevHighest = userLastPaidMap.get(p.user_id) || 0;
          if (cycleVal > prevHighest) {
            userLastPaidMap.set(p.user_id, cycleVal);
          }
        });
      }

      setGroupMembers(fullMembers);

      // Split 1: Eligible members (Paid current cycle AND hasn't won yet)
      const eligible = fullMembers.filter(
        (m) => !m.has_won && paidThisCycleUserIds.has(m.user_id)
      );

      // Split 2: Unpaid members + gap calculation
      const unpaidInfoList: UnpaidMemberInfo[] = fullMembers
        .filter((m) => !paidThisCycleUserIds.has(m.user_id))
        .map((m) => {
          const lastPaidCycle = userLastPaidMap.get(m.user_id) || 0;
          const gapCount = currentCycleNum - lastPaidCycle; // Gap count from last paid to current
          return {
            member: m,
            lastPaidCycle,
            gapCount: gapCount > 0 ? gapCount : 1,
          };
        });

      setEligibleMembers(eligible);
      setUnpaidMembersInfo(unpaidInfoList);
    } catch (err: any) {
      console.error('Error fetching group data:', err);
      setErrorMsg('Gagal memuat data anggota dan status pembayaran: ' + err.message);
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    if (!confirm('Apakah Anda yakin ingin mengeluarkan anggota ini dari kelompok?')) return;

    const { error } = await supabase
      .from('group_members')
      .delete()
      .eq('id', memberId);

    if (error) {
      alert('Gagal mengeluarkan anggota: ' + error.message);
    } else if (selectedGroup) {
      fetchGroupData(selectedGroup);
    }
  };

  const drawWheel = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const numSlices = eligibleMembers.length;
    const width = canvas.width;
    const height = canvas.height;
    const centerX = width / 2;
    const centerY = height / 2;
    const radius = Math.min(centerX, centerY) - 15;

    ctx.clearRect(0, 0, width, height);

    if (numSlices === 0) {
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
      ctx.fillStyle = '#E5E7EB';
      ctx.fill();
      ctx.fillStyle = '#9CA3AF';
      ctx.font = 'bold 16px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Belum Ada Peserta Siap Kocok', centerX, centerY);
      return;
    }

    const sliceAngle = (2 * Math.PI) / numSlices;

    for (let i = 0; i < numSlices; i++) {
      const angle = rotationAngle + i * sliceAngle;
      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.arc(centerX, centerY, radius, angle, angle + sliceAngle);
      ctx.closePath();

      ctx.fillStyle = COLORS[i % COLORS.length];
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#FFFFFF';
      ctx.stroke();

      ctx.save();
      ctx.translate(centerX, centerY);
      ctx.rotate(angle + sliceAngle / 2);
      ctx.textAlign = 'right';
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 14px sans-serif';
      const name = eligibleMembers[i]?.profiles?.full_name || 'Peserta';
      ctx.fillText(name.length > 15 ? name.slice(0, 13) + '..' : name, radius - 20, 5);
      ctx.restore();
    }

    ctx.beginPath();
    ctx.arc(centerX, centerY, 30, 0, 2 * Math.PI);
    ctx.fillStyle = '#FFFFFF';
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#2563EB';
    ctx.stroke();
  };

  const handleSpinWheel = () => {
    if (eligibleMembers.length === 0 || isSpinning) return;

    setIsSpinning(true);
    setErrorMsg('');
    setShowWinnerModal(false);

    const winnerIndex = Math.floor(Math.random() * eligibleMembers.length);
    const selectedWinner = eligibleMembers[winnerIndex];

    const numSlices = eligibleMembers.length;
    const sliceAngle = (2 * Math.PI) / numSlices;

    const extraRounds = 5;
    const targetSliceCenter = winnerIndex * sliceAngle + sliceAngle / 2;
    const finalAngle = (3 * Math.PI / 2) - targetSliceCenter + (extraRounds * 2 * Math.PI);

    const spinDuration = 4500;
    const startTime = performance.now();
    const initialAngle = rotationAngle % (2 * Math.PI);

    const animateSpin = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / spinDuration, 1);

      const easeOut = 1 - Math.pow(1 - progress, 3);
      const currentAngle = initialAngle + (finalAngle - initialAngle) * easeOut;

      setRotationAngle(currentAngle);

      if (progress < 1) {
        requestAnimationFrame(animateSpin);
      } else {
        setIsSpinning(false);
        finalizeWinner(selectedWinner);
      }
    };

    requestAnimationFrame(animateSpin);
  };

  const finalizeWinner = async (selectedWinner: GroupMember) => {
    if (!selectedGroup) return;

    const currentCycleStr = selectedGroup.cycle_schedule || '1';
    const currentCycleNum = parseInt(currentCycleStr, 10) || 1;
    const nextCycleNum = currentCycleNum + 1;

    setWinner(selectedWinner);
    setShowWinnerModal(true);

    try {
      // 1. Mark winning member in group_members
      const { error: updateMemberError } = await supabase
        .from('group_members')
        .update({ has_won: true })
        .eq('id', selectedWinner.id);

      if (updateMemberError) throw updateMemberError;

      // 2. Increment cycle_schedule in arisan_groups
      const { error: updateGroupError } = await supabase
        .from('arisan_groups')
        .update({ cycle_schedule: nextCycleNum.toString() })
        .eq('id', selectedGroup.id);

      if (updateGroupError) throw updateGroupError;

      // 3. Insert payout transaction record
      const setoranNominal = selectedGroup.contribution_amount || 0;
      const totalAnggota = groupMembers.length > 0 ? groupMembers.length : (selectedGroup.cycle_count || 1);
      const totalPencairan = setoranNominal * totalAnggota;
      const receiptNum = `KWT-OUT-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

      await supabase.from('payments').insert([
        {
          receipt_number: receiptNum,
          group_id: selectedGroup.id,
          user_id: selectedWinner.user_id,
          category: 'pencairan_arisan',
          amount: totalPencairan,
          cycle_count: totalAnggota,
          cycle_schedule: currentCycleStr,
          description: `Pencairan Arisan Periode Kocokan Ke-${currentCycleStr} untuk ${selectedWinner.profiles.full_name}`,
          submitted_by: currentUserId || selectedWinner.user_id,
        },
      ]);

      // 4. Record draw history
      await supabase.from('draw_history').insert({
        group_id: selectedGroup.id,
        winner_id: selectedWinner.user_id,
        payout_amount: totalPencairan,
        drawn_by: currentUserId || selectedWinner.user_id,
      });

      // 5. Local State Sync
      const updatedGroup = { ...selectedGroup, cycle_schedule: nextCycleNum.toString() };
      setSelectedGroup(updatedGroup);
      setActiveGroups((prev) =>
        prev.map((g) => (g.id === updatedGroup.id ? updatedGroup : g))
      );

      setGroupMembers((prev) =>
        prev.map((m) => (m.id === selectedWinner.id ? { ...m, has_won: true } : m))
      );
      setEligibleMembers((prev) => prev.filter((m) => m.id !== selectedWinner.id));
    } catch (err: any) {
      console.error('Error finalizing winner:', err);
      setErrorMsg('Gagal menyimpan data pemenang: ' + err.message);
    }
  };

  const currentCycle = selectedGroup?.cycle_schedule || '1';
  const currentCycleNum = parseInt(currentCycle, 10);
  const totalMembersCount = groupMembers.length > 0 
    ? groupMembers.length 
    : (selectedGroup?.cycle_count || 0);

  // Arisan selesai jika urutan kocokan melebihi total anggota kelompok
  const isArisanSelesai = totalMembersCount > 0 && currentCycleNum > totalMembersCount;

  const filteredPaidMembers = groupMembers.filter((m) => {
    const isPaid = eligibleMembers.some((e) => e.id === m.id) || m.has_won;
    const matchesSearch = m.profiles.full_name.toLowerCase().includes(paidSearchTerm.toLowerCase()) ||
                          m.profiles.email.toLowerCase().includes(paidSearchTerm.toLowerCase());
    return isPaid && matchesSearch;
  });

  const filteredUnpaidMembers = unpaidMembersInfo.filter((info) =>
    info.member.profiles.full_name.toLowerCase().includes(unpaidSearchTerm.toLowerCase()) ||
    info.member.profiles.email.toLowerCase().includes(unpaidSearchTerm.toLowerCase())
  );

  return (
    <div className="w-full min-h-screen bg-gray-50 p-4 md:p-6 space-y-6">
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900 flex items-center gap-2">
            <Sparkles className="w-7 h-7 text-yellow-500 animate-pulse" />
            Pengocokan Arisan Digital
          </h1>
          <p className="text-sm text-gray-500">Pilih kelompok dan kocok pemenang secara acak & adil</p>
        </div>

        <div className="w-full md:w-80">
          <select
            value={selectedGroupId}
            onChange={(e) => setSelectedGroupId(e.target.value)}
            className="w-full p-3 bg-gray-50 border border-gray-300 rounded-xl font-semibold text-gray-800 focus:ring-2 focus:ring-blue-500 focus:outline-none"
          >
            <option value="">-- Pilih Kelompok Arisan --</option>
            {activeGroups.map((group) => (
              <option key={group.id} value={group.id}>
                {group.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {errorMsg && (
        <div className="p-4 bg-red-100 text-red-700 rounded-xl font-semibold">
          {errorMsg}
        </div>
      )}

      {selectedGroup ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Wheel Picker */}
          <div className="lg:col-span-6 bg-white p-6 rounded-2xl shadow-sm border border-gray-200 flex flex-col items-center justify-center min-h-[500px] relative">
            <div className="text-center mb-4">
              <span className={`font-bold px-4 py-1.5 rounded-full text-sm inline-block mb-1 ${
                isArisanSelesai ? 'bg-emerald-100 text-emerald-800' : 'bg-blue-100 text-blue-800'
              }`}>
                {isArisanSelesai ? 'Status: Arisan Selesai' : `Kocokan Ke: ${currentCycle}`}
              </span>
              <h2 className="text-xl font-bold text-gray-800">{selectedGroup.name}</h2>
            </div>

            <div className="relative my-4 flex items-center justify-center">
              <div className="absolute -top-3 z-10 w-0 h-0 border-l-[16px] border-l-transparent border-r-[16px] border-r-transparent border-t-[28px] border-t-red-600 drop-shadow-md" />
              <canvas
                ref={canvasRef}
                width={380}
                height={380}
                className="max-w-full transition-transform"
              />
            </div>

            {/* Kondisional Tombol Aksi */}
            {isArisanSelesai ? (
              <div className="mt-4 flex flex-col items-center gap-3 w-full max-w-xs">
                <button
                  disabled
                  className="w-full py-4 text-lg font-black tracking-wider uppercase rounded-2xl shadow-md bg-emerald-600 text-white cursor-not-allowed text-center"
                >
                  ARISAN SELESAI
                </button>

                <button
                  onClick={() => {
                    if (onNavigateToGroupManagement) {
                      onNavigateToGroupManagement();
                    } else {
                      window.location.href = '/GroupManagementPage';
                    }
                  }}
                  className="w-full py-3 text-sm font-bold tracking-wider rounded-xl shadow-md bg-gray-800 hover:bg-gray-900 text-white transition-all active:scale-95 text-center flex items-center justify-center gap-2"
                >
                  <RotateCw className="w-4 h-4" />
                  Reset Arisan (Ke Group Management)
                </button>
              </div>
            ) : (
              <button
                onClick={handleSpinWheel}
                disabled={isSpinning || eligibleMembers.length === 0}
                className={`mt-4 px-10 py-4 text-lg font-black tracking-wider uppercase rounded-2xl shadow-lg transition-all flex items-center gap-3 ${
                  isSpinning || eligibleMembers.length === 0
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:from-blue-700 hover:to-indigo-700 active:scale-95 hover:shadow-xl'
                }`}
              >
                <RotateCw className={`w-6 h-6 ${isSpinning ? 'animate-spin' : ''}`} />
                {isSpinning ? 'Mengocok...' : 'PUTAR RODA ARISAN!'}
              </button>
            )}
          </div>

          {/* Member Tables */}
          <div className="lg:col-span-6 space-y-6">
            {/* Paid Table */}
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-200 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b pb-3">
                <h3 className="font-bold text-gray-800 flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                  Peserta Lunas Kocokan #{currentCycle} ({filteredPaidMembers.length})
                </h3>
                <div className="relative w-full sm:w-48">
                  <Search className="w-4 h-4 absolute left-3 top-2.5 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Cari anggota..."
                    value={paidSearchTerm}
                    onChange={(e) => setPaidSearchTerm(e.target.value)}
                    className="w-full pl-9 pr-3 py-1.5 text-xs bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div className="overflow-x-auto max-h-56">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-gray-50 text-[11px] font-bold text-gray-500 uppercase tracking-wider border-b">
                      <th className="py-2 px-3">Nama Anggota</th>
                      <th className="py-2 px-3 text-center">Status Menang</th>
                      <th className="py-2 px-3 text-center">Status Bayar</th>
                      {currentCycle === '1' && <th className="py-2 px-3 text-center">Aksi</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 text-xs">
                    {filteredPaidMembers.map((m) => (
                      <tr key={m.id} className="hover:bg-emerald-50/40 transition">
                        <td className="py-2.5 px-3 font-semibold text-gray-800">
                          {m.profiles?.full_name}
                          <div className="text-[10px] text-gray-400 font-normal">{m.profiles?.email}</div>
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          {m.has_won ? (
                            <span className="bg-amber-100 text-amber-800 font-bold px-2 py-0.5 rounded-full text-[10px] inline-flex items-center gap-1">
                              <Trophy className="w-3 h-3 text-amber-600" /> Sudah Menang
                            </span>
                          ) : (
                            <span className="bg-gray-100 text-gray-600 font-medium px-2 py-0.5 rounded-full text-[10px]">
                              Belum Menang
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-md">
                            Lunas
                          </span>
                        </td>
                        {currentCycle === '1' && (
                          <td className="py-2.5 px-3 text-center">
                            <button
                              onClick={() => handleRemoveMember(m.id)}
                              className="p-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded transition"
                              title="Hapus Anggota"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                    {filteredPaidMembers.length === 0 && (
                      <tr>
                        <td colSpan={currentCycle === '1' ? 4 : 3} className="text-center py-4 text-gray-400">
                          Tidak ada peserta lunas untuk kocokan ini.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Unpaid Table with Gap Count */}
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-200 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b pb-3">
                <h3 className="font-bold text-gray-800 flex items-center gap-2">
                  <XCircle className="w-5 h-5 text-red-500" />
                  Belum Bayar Kocokan #{currentCycle} ({filteredUnpaidMembers.length})
                </h3>
                <div className="relative w-full sm:w-48">
                  <Search className="w-4 h-4 absolute left-3 top-2.5 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Cari anggota..."
                    value={unpaidSearchTerm}
                    onChange={(e) => setUnpaidSearchTerm(e.target.value)}
                    className="w-full pl-9 pr-3 py-1.5 text-xs bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-red-500"
                  />
                </div>
              </div>

              <div className="overflow-x-auto max-h-56">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-gray-50 text-[11px] font-bold text-gray-500 uppercase tracking-wider border-b">
                      <th className="py-2 px-3">Nama Anggota</th>
                      <th className="py-2 px-3 text-center">Bayar Terakhir</th>
                      <th className="py-2 px-3 text-center">Tunggakan (Kocokan)</th>
                      {currentCycle === '1' && <th className="py-2 px-3 text-center">Aksi</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 text-xs">
                    {filteredUnpaidMembers.map(({ member, lastPaidCycle, gapCount }) => (
                      <tr key={member.id} className="hover:bg-red-50/40 transition">
                        <td className="py-2.5 px-3 font-semibold text-gray-800">
                          {member.profiles?.full_name}
                          <div className="text-[10px] text-gray-400 font-normal">{member.profiles?.email}</div>
                        </td>
                        <td className="py-2.5 px-3 text-center text-gray-600 font-medium">
                          {lastPaidCycle > 0 ? `Kocokan #${lastPaidCycle}` : 'Belum Pernah'}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <span className="bg-red-100 text-red-700 font-bold px-2 py-0.5 rounded-full text-[10px] inline-flex items-center gap-1">
                            <AlertCircle className="w-3 h-3 text-red-600" />
                            {gapCount} Periode
                          </span>
                        </td>
                        {currentCycle === '1' && (
                          <td className="py-2.5 px-3 text-center">
                            <button
                              onClick={() => handleRemoveMember(member.id)}
                              className="p-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded transition"
                              title="Hapus Anggota"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                    {filteredUnpaidMembers.length === 0 && (
                      <tr>
                        <td colSpan={currentCycle === '1' ? 4 : 3} className="text-center py-4 text-gray-400">
                          Semua peserta telah melunasi kocokan ini.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-white p-12 rounded-2xl border border-gray-200 text-center space-y-3">
          <Award className="w-12 h-12 text-blue-500 mx-auto opacity-50" />
          <h3 className="text-lg font-bold text-gray-700">Pilih Kelompok Arisan</h3>
          <p className="text-sm text-gray-400">Silakan pilih salah satu kelompok arisan aktif di atas untuk memulai kocokan.</p>
        </div>
      )}

      {showWinnerModal && winner && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-3xl p-8 max-w-md w-full text-center shadow-2xl border-4 border-yellow-400 relative overflow-hidden transform animate-bounce-short">
            <div className="absolute -top-24 -left-24 w-48 h-48 bg-yellow-300 rounded-full blur-3xl opacity-50" />
            <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-pink-300 rounded-full blur-3xl opacity-50" />

            <div className="relative z-10 space-y-4">
              <div className="w-20 h-20 bg-yellow-100 text-yellow-600 rounded-full flex items-center justify-center mx-auto shadow-inner ring-8 ring-yellow-50">
                <Trophy className="w-10 h-10 animate-pulse" />
              </div>

              <div>
                <span className="text-xs font-black uppercase tracking-widest text-yellow-600 bg-yellow-100 px-3 py-1 rounded-full">
                  PEMENANG KOCOKAN #{currentCycle}
                </span>
                <h2 className="text-3xl font-black text-gray-900 mt-2">🎉 SELAMAT! 🎉</h2>
              </div>

              <div className="py-4 bg-gradient-to-r from-yellow-50 via-amber-50 to-yellow-50 rounded-2xl border border-yellow-200">
                <p className="text-2xl font-black text-indigo-950">{winner.profiles?.full_name}</p>
                <p className="text-xs font-medium text-gray-500 mt-1">{winner.profiles?.email}</p>
              </div>

              <button
                onClick={() => setShowWinnerModal(false)}
                className="w-full py-3.5 bg-gradient-to-r from-yellow-400 to-amber-500 hover:from-yellow-500 hover:to-amber-600 text-slate-900 font-extrabold rounded-xl shadow-lg transition-all active:scale-95"
              >
                TUTUP & SIMPAN!
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};