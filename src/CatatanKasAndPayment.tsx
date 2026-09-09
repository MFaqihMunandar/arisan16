import React, { useState, useEffect } from 'react';
import { supabase } from './lib/supabase';

const generateReceiptNumber = () => {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const randomSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `KWT-${dateStr}-${randomSuffix}`;
};

//export default function CatatanKasAndPayment({ currentUserId }: CatatanKasAndPaymentProps) {
export default function CatatanKasAndPayment() {
  // Active Groups state for Arisan
  const [activeGroups, setActiveGroups] = useState<any[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string>('');
  //const [selectedGroup, setSelectedGroup] = useState<any>(null);

  // Active Kas Groups state for Kas
  const [activeKasGroups, setActiveKasGroups] = useState<any[]>([]);
  const [selectedKasGroupId, setSelectedKasGroupId] = useState<string>('');
  //const [selectedKasGroup, setSelectedKasGroup] = useState<any>(null);

  // Modal specific selections
  const [modalGroupId, setModalGroupId] = useState<string>('');
  const [modalSelectedGroup, setModalSelectedGroup] = useState<any>(null);
  const [modalKasGroupId, setModalKasGroupId] = useState<string>('');

  // User lists
  const [allUsers, setAllUsers] = useState<any[]>([]); 
  const [groupMembers, setGroupMembers] = useState<any[]>([]); 

  // Split payment lists
  const [arisanPayments, setArisanPayments] = useState<any[]>([]);
  const [kasPayments, setKasPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Browser-style Table Tab state
  const [activeTableTab, setActiveTableTab] = useState<'arisan' | 'kas'>('arisan');

  // Filter and Search states
  const [searchName, setSearchName] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Payment Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [paymentType, setPaymentType] = useState<'arisan' | 'kas'>('arisan');
  const [selectedMember, setSelectedMember] = useState<any>(null);
  const [memberSearchTerm, setMemberSearchTerm] = useState('');
  const [isBrowsingMembers, setIsBrowsingMembers] = useState(false);
  const [nominal, setNominal] = useState<string>('');
  const [description, setDescription] = useState('');
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState('');

  // Receipt Modal
  const [selectedReceipt, setSelectedReceipt] = useState<any>(null);

  useEffect(() => {
    // Set default date range to past 3 months
    const end = new Date();
    const start = new Date();
    start.setMonth(start.getMonth() - 3);

    setEndDate(end.toISOString().slice(0, 10));
    setStartDate(start.toISOString().slice(0, 10));

    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    setLoading(true);

    // 1. Fetch active Arisan groups
    const { data: groupsData } = await supabase
      .from('arisan_groups')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (groupsData && groupsData.length > 0) {
      setActiveGroups(groupsData);
      setSelectedGroupId(groupsData[0].id);
      //setSelectedGroup(groupsData[0]);
    } else {
      setActiveGroups([]);
    }

    // 2. Fetch Kas groups (For search default limit max 2 years ago)
    const twoYearsAgo = new Date();
    twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
    const twoYearsAgoStr = twoYearsAgo.toISOString();

    const { data: kasGroupsData } = await supabase
      .from('kas_groups')
      .select('*')
      .gte('created_at', twoYearsAgoStr)
      .order('created_at', { ascending: false });

    if (kasGroupsData && kasGroupsData.length > 0) {
      setActiveKasGroups(kasGroupsData);
      setSelectedKasGroupId(kasGroupsData[0].id);
      //setSelectedKasGroup(kasGroupsData[0]);
    } else {
      setActiveKasGroups([]);
    }

    // 3. Fetch all system profiles
    const { data: profilesData } = await supabase
      .from('profiles')
      .select('id, full_name, email')
      .order('full_name', { ascending: true });

    if (profilesData) {
      const mappedProfiles = profilesData.map((p: any) => ({
        id: p.id,
        user_id: p.id,
        full_name: p.full_name || 'Tanpa Nama',
        email: p.email || '-',
      }));
      setAllUsers(mappedProfiles);
    }

    setLoading(false);
  };

  // Fetch Arisan payments whenever top Arisan group changes
  useEffect(() => {
    if (selectedGroupId) {
      //const group = activeGroups.find((g) => g.id === selectedGroupId);
      //setSelectedGroup(group || null);
      fetchArisanPayments(selectedGroupId);
    }
  }, [selectedGroupId, activeGroups]);

  // Fetch Kas payments whenever top Kas group changes
  useEffect(() => {
    if (selectedKasGroupId) {
      //const kasGroup = activeKasGroups.find((g) => g.id === selectedKasGroupId);
      //setSelectedKasGroup(kasGroup || null);
      fetchKasPayments(selectedKasGroupId);
    }
  }, [selectedKasGroupId, activeKasGroups]);

  // Fetch group specific members when modal arisan group changes
  useEffect(() => {
    if (modalGroupId) {
      const group = activeGroups.find((g) => g.id === modalGroupId);
      setModalSelectedGroup(group || null);
      fetchGroupMembersOnly(modalGroupId);
      if (paymentType === 'arisan' && group) {
        setNominal(group.contribution_amount?.toString() || '0');
      }
    } else {
      setModalSelectedGroup(null);
      setGroupMembers([]);
    }
  }, [modalGroupId]);

  const fetchArisanPayments = async (groupId: string) => {
    setLoading(true);
    // For arisan, query based on the currently active group selected
    const { data: paymentsData, error } = await supabase
      .from('payments')
      .select('*')
      .eq('group_id', groupId)
      .eq('category', 'setoran_arisan')
      .order('created_at', { ascending: false });

    if (error || !paymentsData) {
      setArisanPayments([]);
      setLoading(false);
      return;
    }

    await enrichAndSetPayments(paymentsData, setArisanPayments);
    setLoading(false);
  };

  const fetchKasPayments = async (kasGroupId: string) => {
    setLoading(true);
    const twoYearsAgo = new Date();
    twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
	twoYearsAgo.setHours(0, 0, 0, 0);

    const { data: paymentsData, error } = await supabase
      .from('payments')
      .select('*')
      .not('kas_group_id', 'is', null)
      .eq('kas_group_id', kasGroupId)
      .eq('category', 'kas_kolektif')
      .gte('created_at', twoYearsAgo.toISOString())
      .order('created_at', { ascending: false });
	  
	console.log('--- SUPABASE KAS QUERY RESULT ---');
console.log('Error:', error);
console.log('Data returned:', paymentsData);
console.log('Kas Group ID :', kasGroupId);
console.log('created at :', twoYearsAgo.toISOString());

    if (error || !paymentsData) {
      setKasPayments([]);
      setLoading(false);
      return;
    }

    await enrichAndSetPayments(paymentsData, setKasPayments);
    setLoading(false);
  };

  const enrichAndSetPayments = async (paymentsData: any[], setter: Function) => {
    const userIds = [...new Set(paymentsData.map((p: any) => p.user_id))];
    if (userIds.length > 0) {
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .in('id', userIds);

      const profileMap = new Map();
      profilesData?.forEach((p: any) => profileMap.set(p.id, p));

      const enrichedPayments = paymentsData.map((p: any) => ({
        ...p,
        profile: profileMap.get(p.user_id) || { full_name: 'Tanpa Nama', email: '-' }
      }));

      setter(enrichedPayments);
    } else {
      setter(paymentsData);
    }
  };

  const fetchGroupMembersOnly = async (groupId: string) => {
    const { data: memberRelData, error: relError } = await supabase
      .from('group_members')
      .select('user_id')
      .eq('group_id', groupId);

    if (relError || !memberRelData || memberRelData.length === 0) {
      setGroupMembers([]);
      return;
    }

    const userIds = memberRelData.map((m: any) => m.user_id);

    const { data: profilesData, error: profError } = await supabase
      .from('profiles')
      .select('id, full_name, email')
      .in('id', userIds);

    if (profError || !profilesData) {
      setGroupMembers([]);
      return;
    }

    const membersList = profilesData.map((p: any) => ({
      id: p.id,
      user_id: p.id,
      full_name: p.full_name || 'Tanpa Nama',
      email: p.email || '-',
    }));

    setGroupMembers(membersList);
  };

  const handleOpenPaymentModal = async () => {
    setFormError('');
    setSelectedMember(null);
    setMemberSearchTerm('');
    setIsBrowsingMembers(false);
    setPaymentType('arisan');

    const defaultGroup = activeGroups.length > 0 ? activeGroups[0] : null;
    const defaultGroupId = defaultGroup?.id || '';
    setModalGroupId(defaultGroupId);
    setModalSelectedGroup(defaultGroup);

    const defaultKasGroup = activeKasGroups.length > 0 ? activeKasGroups[0] : null;
    setModalKasGroupId(defaultKasGroup?.id || '');

    if (defaultGroupId) {
      await fetchGroupMembersOnly(defaultGroupId);
    }

    // Ensure all users are fetched for Kas dropdown fallback
    if (allUsers.length === 0) {
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .order('full_name', { ascending: true });
	console.log("LOG - All Profiles from DB:", profilesData);

      if (profilesData) {
        const mappedProfiles = profilesData.map((p: any) => ({
          id: p.id,
          user_id: p.id,
          full_name: p.full_name || 'Tanpa Nama',
          email: p.email || '-',
        }));
        setAllUsers(mappedProfiles);
      }
    }

    setNominal(defaultGroup?.contribution_amount?.toString() || '0');
    setDescription('');
    setIsModalOpen(true);
  };

  const handleTypeChange = (type: 'arisan' | 'kas') => {
    setPaymentType(type);
    setSelectedMember(null);
    setMemberSearchTerm('');
    setIsBrowsingMembers(false);

    if (type === 'arisan') {
      setNominal(modalSelectedGroup?.contribution_amount?.toString() || '0');
    } else {
      setNominal('');
    }
  };

  const handleSelectMember = async (member: any) => {
    setSelectedMember(member);

    if (paymentType === 'arisan' && modalGroupId) {
      const { data: userPayments, error } = await supabase
        .from('payments')
        .select('cycle_schedule, category')
        .eq('group_id', modalGroupId)
        .eq('user_id', member.user_id)
        .eq('category', 'setoran_arisan');

      if (error) return;

      const totalMembers = groupMembers.length > 0 ? groupMembers.length : (modalSelectedGroup?.cycle_count || 1);
      const paidCount = userPayments?.length || 0;

      if (paidCount >= totalMembers) {
        setFormError(`Peserta ${member.full_name} sudah mencapai batas maksimal setoran (${paidCount}/${totalMembers} kocokan).`);
        setSelectedMember(null);
        return;
      } else {
        setFormError('');
      }

      let maxCycle = 0;
      userPayments?.forEach((p: any) => {
        const cycleNum = parseInt(p.cycle_schedule) || 0;
        if (cycleNum > maxCycle) maxCycle = cycleNum;
      });

      const nextCycle = maxCycle + 1;

      setModalSelectedGroup((prev: any) => ({
        ...prev,
        cycle_schedule: nextCycle.toString(),
        cycle_count: totalMembers
      }));
    }
  };

  const handleSavePayment = async (e: React.FormEvent) => {
    e.preventDefault();

    const targetGroupId = paymentType === 'arisan' ? modalGroupId : modalKasGroupId;

    if (!targetGroupId) {
      setFormError(`Silakan pilih ${paymentType === 'arisan' ? 'grup arisan' : 'kelompok kas'} terlebih dahulu.`);
      return;
    }

    if (!selectedMember) {
      setFormError('Silakan pilih peserta penyetor terlebih dahulu.');
      return;
    }

    if (!nominal || Number(nominal) <= 0) {
      setFormError('Nominal pembayaran wajib diisi dengan benar.');
      return;
    }

    setFormLoading(true);
    setFormError('');

    const receiptNum = generateReceiptNumber();
    const totalMembers = groupMembers.length > 0 ? groupMembers.length : (modalSelectedGroup?.cycle_count || 1);
    const currentCycle = Number(modalSelectedGroup?.cycle_schedule || 1);

    const newPayment = {
      receipt_number: receiptNum,
      group_id: paymentType === 'arisan' ? modalGroupId : null,
      kas_group_id: paymentType === 'kas' ? modalKasGroupId : null,
      user_id: selectedMember.user_id,
      category: paymentType === 'arisan' ? 'setoran_arisan' : 'kas_kolektif',
      amount: Number(nominal),
      cycle_count: paymentType === 'arisan' ? totalMembers : 1,
      cycle_schedule: paymentType === 'arisan' ? currentCycle.toString() : '1',
      description: description.trim() || null,
    };

    const { error } = await supabase
      .from('payments')
      .insert([newPayment]);

    setFormLoading(false);

    if (error) {
      setFormError('Gagal menyimpan transaksi: ' + error.message);
    } else {
      setIsModalOpen(false);
      
      // Force sync main tab view to match what was just saved
      if (paymentType === 'arisan') {
        setSelectedGroupId(modalGroupId);
        fetchArisanPayments(modalGroupId);
      } else {
        setSelectedKasGroupId(modalKasGroupId);
        fetchKasPayments(modalKasGroupId);
      }
      
      setSelectedReceipt({
        ...newPayment,
        profile: { 
          full_name: selectedMember.full_name, 
          email: selectedMember.email 
        }
      });
    }
  };

  const currentParticipantPool = paymentType === 'arisan' ? groupMembers : allUsers;

  const filteredMembers = currentParticipantPool.filter((m) => {
    const term = memberSearchTerm.toLowerCase().trim();
    if (!term) return true;
    
    const searchTokens = term.split(/\s+/);
    const fullName = (m.full_name || '').toLowerCase();
    const email = (m.email || '').toLowerCase();

    return searchTokens.every(token => 
      fullName.includes(token) || email.includes(token)
    );
  });
  

  // Filter Payments based on Date Range and Name Search
  const filterPaymentsList = (payments: any[]) => {
    return payments.filter((p) => {
      // Name Search filter
      const matchesName = searchName
        ? p.profile?.full_name?.toLowerCase().includes(searchName.toLowerCase().trim())
        : true;

      // Date filter
      const paymentDate = p.created_at ? new Date(p.created_at).toISOString().slice(0, 10) : '';
      const matchesStartDate = startDate ? paymentDate >= startDate : true;
      const matchesEndDate = endDate ? paymentDate <= endDate : true;

      return matchesName && matchesStartDate && matchesEndDate;
    });
  };

  const filteredArisanPayments = filterPaymentsList(arisanPayments);
  const filteredKasPayments = filterPaymentsList(kasPayments);
  //console.log('kas payment : ', kasPayments);
  //console.log('filtered kas payment : ', filteredKasPayments);

  return (
    <div className="w-full">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between mb-6 gap-4 border-b border-gray-100 pb-4">
        <div className="min-w-0">
          <h2 className="text-xl font-bold text-gray-800 leading-tight">Catatan Kas & Payment Arisan</h2>
          <p className="text-sm text-gray-500 mt-1">
            Pencatatan setoran arisan, kas kolektif bebas aturan, dan Digital Kuitansi.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={handleOpenPaymentModal}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 transition text-sm whitespace-nowrap"
          >
            + Setoran
          </button>
        </div>
      </div>

      {/* Filter and Search Controls Bar */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 mb-6 shadow-sm flex flex-col md:flex-row items-center gap-4">
        <div className="w-full md:w-1/3">
          <label className="block text-xs font-semibold text-gray-600 mb-1 uppercase">Cari Nama Penyetor</label>
          <input
            type="text"
            placeholder="Ketik nama peserta..."
            value={searchName}
            onChange={(e) => setSearchName(e.target.value)}
            className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="w-full md:w-1/3">
          <label className="block text-xs font-semibold text-gray-600 mb-1 uppercase">Dari Tanggal</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="w-full md:w-1/3">
          <label className="block text-xs font-semibold text-gray-600 mb-1 uppercase">Sampai Tanggal</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Browser-style Tab Switcher Section */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        {/* Tab Headers */}
        <div className="flex border-b border-gray-200 bg-gray-50/70">
          <button
            onClick={() => setActiveTableTab('arisan')}
            className={`flex items-center gap-2.5 px-6 py-3 text-xs font-bold border-b-2 transition-all ${
              activeTableTab === 'arisan'
                ? 'border-blue-600 text-blue-600 bg-white shadow-sm'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-100/50'
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${activeTableTab === 'arisan' ? 'bg-indigo-600' : 'bg-gray-300'}`}></span>
            Arisan
          </button>
          
          <button
            onClick={() => setActiveTableTab('kas')}
            className={`flex items-center gap-2.5 px-6 py-3 text-xs font-bold border-b-2 transition-all ${
              activeTableTab === 'kas'
                ? 'border-blue-600 text-blue-600 bg-white shadow-sm'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-100/50'
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${activeTableTab === 'kas' ? 'bg-green-600' : 'bg-gray-300'}`}></span>
            Kas
          </button>
        </div>

        {/* Tab Content Body with Scrollable Area */}
        <div className="p-4">
          
          {/* 1. ARISAN TABLE TAB CONTENT */}
          {activeTableTab === 'arisan' && (
            <div>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                <h3 className="font-bold text-gray-800 text-sm flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-indigo-600"></span>
                  Riwayat Transaksi Setoran Arisan (Grup Aktif)
                </h3>
                <select
                  value={selectedGroupId}
                  onChange={(e) => setSelectedGroupId(e.target.value)}
                  className="px-3 py-1.5 bg-white border border-gray-300 rounded-lg text-xs font-medium focus:ring-2 focus:ring-blue-500 max-w-xs"
                >
                  {activeGroups.length === 0 ? (
                    <option value="">-- Tidak Ada Grup Arisan Aktif --</option>
                  ) : (
                    activeGroups.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.name} (Periode {g.cycle_count || 1} - Kocokan {g.cycle_schedule || 1})
                      </option>
                    ))
                  )}
                </select>
              </div>

              {/* Scrollable container for table */}
              <div className="max-h-[400px] overflow-y-auto overflow-x-auto border border-gray-100 rounded-lg">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-gray-50 text-gray-600 border-b border-gray-200 sticky top-0 z-10">
                    <tr>
                      <th className="py-2.5 px-3 font-semibold bg-gray-50">No. Kuitansi</th>
                      <th className="py-2.5 px-3 font-semibold bg-gray-50">Nama Peserta</th>
                      <th className="py-2.5 px-3 font-semibold bg-gray-50">Kocokan</th>
                      <th className="py-2.5 px-3 font-semibold bg-gray-50">Nominal</th>
                      <th className="py-2.5 px-3 font-semibold bg-gray-50">Tanggal</th>
                      <th className="py-2.5 px-3 font-semibold bg-gray-50">Deskripsi</th>
                      <th className="py-2.5 px-3 font-semibold text-center bg-gray-50">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {loading ? (
                      <tr>
                        <td colSpan={7} className="text-center py-6 text-gray-400">Memuat data...</td>
                      </tr>
                    ) : filteredArisanPayments.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="text-center py-6 text-gray-400">Belum ada transaksi arisan sesuai filter.</td>
                      </tr>
                    ) : (
                      filteredArisanPayments.map((p) => (
                        <tr key={p.id} className="hover:bg-gray-50">
                          <td className="py-2.5 px-3 font-mono font-semibold text-blue-600">{p.receipt_number || 'N/A'}</td>
                          <td className="py-2.5 px-3 font-medium text-gray-800">{p.profile?.full_name || 'Tanpa Nama'}</td>
                          <td className="py-2.5 px-3">
                            <span className="px-2 py-0.5 text-[10px] font-semibold rounded bg-indigo-50 text-indigo-600">
                              Kocokan {p.cycle_schedule || 1}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 font-bold text-gray-900">Rp {Number(p.amount).toLocaleString('id-ID')}</td>
                          <td className="py-2.5 px-3 text-gray-500">
                            {p.created_at ? new Date(p.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '-'}
                          </td>
                          <td className="py-2.5 px-3 text-gray-500 max-w-[180px] truncate">{p.description || '-'}</td>
                          <td className="py-2.5 px-3 text-center">
                            <button
                              onClick={() => setSelectedReceipt(p)}
                              className="px-2.5 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 text-[11px] font-medium rounded transition"
                            >
                              Lihat Kuitansi
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 2. KAS TABLE TAB CONTENT */}
          {activeTableTab === 'kas' && (
            <div>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                <h3 className="font-bold text-gray-800 text-sm flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-green-600"></span>
                  Riwayat Transaksi Kas Kolektif (Maksimal 2 Tahun Terakhir)
                </h3>
                <select
                  value={selectedKasGroupId}
                  onChange={(e) => setSelectedKasGroupId(e.target.value)}
                  className="px-3 py-1.5 bg-white border border-gray-300 rounded-lg text-xs font-medium focus:ring-2 focus:ring-blue-500 max-w-xs"
                >
                  {activeKasGroups.length === 0 ? (
                    <option value="">-- Tidak Ada Kelompok Kas --</option>
                  ) : (
                    activeKasGroups.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.name}
                      </option>
                    ))
                  )}
                </select>
              </div>

              {/* Scrollable container for table */}
              <div className="max-h-[400px] overflow-y-auto overflow-x-auto border border-gray-100 rounded-lg">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-gray-50 text-gray-600 border-b border-gray-200 sticky top-0 z-10">
                    <tr>
                      <th className="py-2.5 px-3 font-semibold bg-gray-50">No. Kuitansi</th>
                      <th className="py-2.5 px-3 font-semibold bg-gray-50">Nama Penyetor</th>
                      <th className="py-2.5 px-3 font-semibold bg-gray-50">Nominal</th>
                      <th className="py-2.5 px-3 font-semibold bg-gray-50">Tanggal</th>
                      <th className="py-2.5 px-3 font-semibold bg-gray-50">Deskripsi</th>
                      <th className="py-2.5 px-3 font-semibold text-center bg-gray-50">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {loading ? (
                      <tr>
                        <td colSpan={6} className="text-center py-6 text-gray-400">Memuat data...</td>
                      </tr>
                    ) : filteredKasPayments.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="text-center py-6 text-gray-400">Belum ada transaksi kas kolektif sesuai filter.</td>
                      </tr>
                    ) : (
                      filteredKasPayments.map((p) => (
                        <tr key={p.id} className="hover:bg-gray-50">
                          <td className="py-2.5 px-3 font-mono font-semibold text-blue-600">{p.receipt_number || 'N/A'}</td>
                          <td className="py-2.5 px-3 font-medium text-gray-800">{p.profile?.full_name || 'Tanpa Nama'}</td>
                          <td className="py-2.5 px-3 font-bold text-gray-900">Rp {Number(p.amount).toLocaleString('id-ID')}</td>
                          <td className="py-2.5 px-3 text-gray-500">
                            {p.created_at ? new Date(p.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '-'}
                          </td>
                          <td className="py-2.5 px-3 text-gray-500 max-w-[180px] truncate">{p.description || '-'}</td>
                          <td className="py-2.5 px-3 text-center">
                            <button
                              onClick={() => setSelectedReceipt(p)}
                              className="px-2.5 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 text-[11px] font-medium rounded transition"
                            >
                              Lihat Kuitansi
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

        </div>
      </div>

      {/* Payment Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 relative">
            <h3 className="text-lg font-bold text-gray-800 mb-1">Catat Pembayaran Offline</h3>
            <p className="text-xs text-gray-500 mb-4">Pilih jenis pembayaran, pilih penyetor, dan simpan.</p>

            {formError && (
              <div className="mb-4 p-2.5 bg-red-50 text-red-600 text-xs rounded-lg">{formError}</div>
            )}

            <form onSubmit={handleSavePayment} className="space-y-4 text-xs">
              {/* Type Switcher */}
              <div>
                <label className="block font-semibold text-gray-600 mb-1 uppercase">JENIS PEMBAYARAN *</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => handleTypeChange('arisan')}
                    className={`py-2 px-3 rounded-lg border font-semibold text-center transition ${
                      paymentType === 'arisan'
                        ? 'bg-blue-50 border-blue-600 text-blue-600'
                        : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    Setoran Arisan
                  </button>
                  <button
                    type="button"
                    onClick={() => handleTypeChange('kas')}
                    className={`py-2 px-3 rounded-lg border font-semibold text-center transition ${
                      paymentType === 'kas'
                        ? 'bg-blue-50 border-blue-600 text-blue-600'
                        : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    Kas Kolektif
                  </button>
                </div>
              </div>

              {/* Group Arisan Selector (Show ONLY if Payment Type is Setoran Arisan) */}
              {paymentType === 'arisan' && (
                <div>
                  <label className="block font-semibold text-gray-600 mb-1 uppercase">PILIH GRUP ARISAN AKTIF *</label>
                  <select
                    value={modalGroupId}
                    onChange={(e) => {
                      setModalGroupId(e.target.value);
                      setSelectedMember(null);
                    }}
                    className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-xs font-semibold focus:ring-2 focus:ring-blue-500"
                  >
                    {activeGroups.length === 0 ? (
                      <option value="">-- Tidak ada grup arisan aktif --</option>
                    ) : (
                      activeGroups.map((g) => (
                        <option key={g.id} value={g.id}>
                          {g.name} (Target Kocokan berikutnya: ke-{modalSelectedGroup?.cycle_schedule || 1})
                        </option>
                      ))
                    )}
                  </select>
                </div>
              )}

              {/* Group Kas Selector (Show ONLY if Payment Type is Kas) */}
              {paymentType === 'kas' && (
                <div>
                  <label className="block font-semibold text-gray-600 mb-1 uppercase">PILIH KELOMPOK KAS *</label>
                  <select
                    value={modalKasGroupId}
                    onChange={(e) => setModalKasGroupId(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-xs font-semibold focus:ring-2 focus:ring-blue-500"
                  >
                    {activeKasGroups.length === 0 ? (
                      <option value="">-- Tidak ada kelompok kas --</option>
                    ) : (
                      activeKasGroups.map((g) => (
                        <option key={g.id} value={g.id}>
                          {g.name}
                        </option>
                      ))
                    )}
                  </select>
                </div>
              )}

              {/* Participant Dropdown Selector */}
              <div>
                <label className="block font-semibold text-gray-600 mb-1 uppercase">
                  {paymentType === 'arisan' ? 'PILIH PESERTA ARISAN *' : 'PILIH PENYETOR (SEMUA PENGGUNA) *'}
                </label>
                {selectedMember ? (
                  <div className="flex items-center justify-between p-2.5 bg-blue-50 border border-blue-200 rounded-lg">
                    <div>
                      <p className="font-bold text-gray-800">{selectedMember.full_name}</p>
                      <p className="text-[11px] text-gray-500">{selectedMember.email}</p>
                      {paymentType === 'arisan' && modalSelectedGroup && (
                        <p className="text-[10px] font-semibold text-indigo-600 mt-0.5">
                          Akan dicatat untuk Kocokan Ke-{modalSelectedGroup.cycle_schedule || 1}
                        </p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedMember(null)}
                      className="text-xs text-red-600 font-semibold hover:underline"
                    >
                      Ubah
                    </button>
                  </div>
                ) : (
                  <div>
                    <button
                      type="button"
                      onClick={() => setIsBrowsingMembers(!isBrowsingMembers)}
                      className="w-full py-2 px-3 border border-gray-300 rounded-lg bg-gray-50 text-left text-gray-600 flex justify-between items-center"
                    >
                      <span>-- Cari & Pilih Penyetor --</span>
                      <span>▼</span>
                    </button>

                    {isBrowsingMembers && (
                      <div className="mt-1 border border-gray-200 rounded-lg bg-white shadow-lg p-2 max-h-48 overflow-y-auto z-10">
                        <input
                          type="text"
                          placeholder="Ketik nama atau email..."
                          value={memberSearchTerm}
                          onChange={(e) => setMemberSearchTerm(e.target.value)}
                          className="w-full px-2 py-1.5 border border-gray-200 rounded text-xs mb-2 focus:outline-none"
                        />
                        {filteredMembers.length === 0 ? (
                          <p className="text-center text-gray-400 py-2">
                            {paymentType === 'arisan'
                              ? 'Peserta tidak ditemukan pada grup ini.'
                              : 'Pengguna tidak ditemukan.'}
                          </p>
                        ) : (
                          filteredMembers.map((m) => (
                            <div
                              key={m.id}
                              onClick={() => {
                                handleSelectMember(m);
                                setIsBrowsingMembers(false);
                              }}
                              className="p-2 hover:bg-blue-50 rounded cursor-pointer border-b border-gray-50 flex justify-between items-center"
                            >
                              <div>
                                <p className="font-semibold text-gray-800">{m.full_name}</p>
                                <p className="text-[10px] text-gray-400">{m.email}</p>
                              </div>
                              <span className="text-[10px] text-blue-600 font-bold">Pilih</span>
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Nominal Field - Locked for Arisan, Free/Unlocked for Kas */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="block font-semibold text-gray-600 uppercase">NOMINAL SETORAN (RP) *</label>
                  {paymentType === 'arisan' && (
                    <span className="text-[10px] text-indigo-600 font-semibold bg-indigo-50 px-1.5 py-0.5 rounded">
                      Otomatis Pas (Arisan)
                    </span>
                  )}
                  {paymentType === 'kas' && (
                    <span className="text-[10px] text-green-600 font-semibold bg-green-50 px-1.5 py-0.5 rounded">
                      Bebas / Tanpa Batas
                    </span>
                  )}
                </div>
                <input
                  type="number"
                  value={nominal}
                  onChange={(e) => setNominal(e.target.value)}
                  readOnly={paymentType === 'arisan'}
                  disabled={paymentType === 'arisan'}
                  placeholder="masukkan nominal..."
                  className={`w-full px-3 py-2 border rounded-lg text-sm font-bold ${
                    paymentType === 'arisan'
                      ? 'bg-gray-100 border-gray-300 text-gray-700 cursor-not-allowed'
                      : 'bg-white border-gray-300 text-gray-900 focus:ring-2 focus:ring-blue-500'
                  }`}
                />
              </div>

              {/* Description Field */}
              <div>
                <label className="block font-semibold text-gray-600 mb-1 uppercase">DESKRIPSI / CATATAN (OPSIONAL)</label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="misal: Titip cash melalui pengurus..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 bg-gray-100 text-gray-700 font-medium rounded-lg hover:bg-gray-200"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={formLoading}
                  className="px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {formLoading ? 'Menyimpan...' : 'Simpan & Menerbitkan Kuitansi'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Digital Receipt Modal */}
      {selectedReceipt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 border-2 border-blue-600 relative">
            <button
              onClick={() => setSelectedReceipt(null)}
              className="absolute top-3 right-3 text-gray-400 hover:text-gray-600 font-bold text-lg"
            >
              &times;
            </button>

            <div className="text-center pb-4 border-b border-dashed border-gray-300 mb-4">
              <div className="w-10 h-10 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-2 font-bold text-lg">
                ✓
              </div>
              <h4 className="font-extrabold text-gray-800 text-base">KUITANSI DIGITAL</h4>
              <p className="text-[11px] text-gray-500 font-mono">{selectedReceipt.receipt_number || 'N/A'}</p>
            </div>

            <div className="space-y-2.5 text-xs">
              <div className="flex justify-between">
                <span className="text-gray-500">Nama Penyetor:</span>
                <span className="font-bold text-gray-900">{selectedReceipt.profile?.full_name || 'Anggota'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Dicatat Oleh (Admin):</span>
                <span className="font-medium text-gray-800">Mohammad Faqih Munandar</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Jenis Pembayaran:</span>
                <span className="font-medium text-gray-800">
                  {selectedReceipt.category === 'setoran_arisan'
                    ? `Setoran Arisan (Kocokan Ke-${selectedReceipt.cycle_schedule || 1})`
                    : 'Kas Kolektif'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Tanggal:</span>
                <span className="font-medium text-gray-800">
                  {new Date(selectedReceipt.created_at || Date.now()).toLocaleDateString('id-ID', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </div>
              {selectedReceipt.description && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Catatan:</span>
                  <span className="font-medium text-gray-800">{selectedReceipt.description}</span>
                </div>
              )}
              <div className="pt-3 border-t border-gray-200 flex justify-between items-center">
                <span className="font-bold text-gray-700">TOTAL DIBAYAR:</span>
                <span className="text-base font-extrabold text-green-600">
                  Rp {Number(selectedReceipt.amount).toLocaleString('id-ID')}
                </span>
              </div>
            </div>

            <div className="mt-5 p-2 bg-green-50 border border-green-200 text-green-700 text-center rounded-lg font-bold text-xs uppercase">
              Status: TERCATAT & LUNAS
            </div>

            <button
              onClick={() => window.print()}
              className="mt-4 w-full py-2 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700 transition"
            >
              Cetak Kuitansi
            </button>
          </div>
        </div>
      )}
    </div>
  );
}