import { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { supabase } from './lib/supabase';
import { Wallet, Printer, Download, ArrowDownLeft, ArrowUpRight } from 'lucide-react';

interface LaporanKasProps {
  currentUserId?: string;
}

export default function LaporanKas({ currentUserId }: LaporanKasProps) {
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const [selectedKasGroupId, setSelectedKasGroupId] = useState<string>('all');

  const [kasGroups, setKasGroups] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const yearOptions = Array.from({ length: 5 }, (_, index) => currentYear - index);

  useEffect(() => {
    fetchKasData();
  }, [selectedYear]);

  const fetchKasData = async () => {
    setLoading(true);
    const startOfYear = new Date(`${selectedYear}-01-01T00:00:00.000Z`).toISOString();
    const endOfYear = new Date(`${selectedYear}-12-31T23:59:59.999Z`).toISOString();

    try {
      const { data: kasData } = await supabase.from('kas_groups').select('*').order('created_at', { ascending: false });
      setKasGroups(kasData || []);

      const { data: profilesData } = await supabase.from('profiles').select('id, full_name, email');
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
    } catch (err) {
      console.error('Error loading kas report data:', err);
    } finally {
      setLoading(false);
    }
  };

  const filteredPayments = payments.filter((p) => {
    const isKasTransaction = p.category !== 'setoran_arisan' && p.category !== 'pencairan_arisan';
    const matchesKasGroup = selectedKasGroupId === 'all' || p.kas_group_id === selectedKasGroupId;
    return isKasTransaction && matchesKasGroup;
  });

  const displayKasGroups = kasGroups.filter(
    (g) => selectedKasGroupId === 'all' || g.id === selectedKasGroupId
  );

  const setoranTransactions = filteredPayments.filter(
    (p) => p.category === 'kas_kolektif' || p.category === 'kas_transfer'
  );

  const penarikanTransactions = filteredPayments.filter(
    (p) => p.category === 'penarikan_kas'
  );

  const kasInflowTotal = setoranTransactions.reduce((sum, p) => sum + Math.abs(Number(p.amount) || 0), 0);
  const kasOutflowTotal = penarikanTransactions.reduce((sum, p) => sum + Math.abs(Number(p.amount) || 0), 0);
  const kasNetBalance = kasInflowTotal - kasOutflowTotal;

  const handleExportExcel = () => {
    const rows: Record<string, any>[] = [];

    rows.push({ 'Kategori / Kelompok Kas': 'SETORAN KAS', 'Keterangan': '', 'Jumlah Transactions': '', 'Total Nominal (Rp)': kasInflowTotal });

    displayKasGroups.forEach((group) => {
      const groupSetoran = setoranTransactions.filter((p) => p.kas_group_id === group.id);
      const groupSetoranTotal = groupSetoran.reduce((sum, p) => sum + Math.abs(Number(p.amount) || 0), 0);
      const descriptions = groupSetoran.map((p) => p.description).filter(Boolean).join('; ') || group.description || '-';

      rows.push({
        'Kategori / Kelompok Kas': `  ${group.name}`,
        'Keterangan': descriptions,
        'Jumlah Transactions': groupSetoran.length,
        'Total Nominal (Rp)': groupSetoranTotal,
      });
    });

    rows.push({ 'Kategori / Kelompok Kas': 'TOTAL SETORAN KAS', 'Keterangan': '', 'Jumlah Transactions': setoranTransactions.length, 'Total Nominal (Rp)': kasInflowTotal });
    rows.push({});

    rows.push({ 'Kategori / Kelompok Kas': 'PENARIKAN KAS', 'Keterangan': '', 'Jumlah Transactions': '', 'Total Nominal (Rp)': kasOutflowTotal });

    displayKasGroups.forEach((group) => {
      const groupPenarikan = penarikanTransactions.filter((p) => p.kas_group_id === group.id);
      const groupPenarikanTotal = groupPenarikan.reduce((sum, p) => sum + Math.abs(Number(p.amount) || 0), 0);
      const descriptions = groupPenarikan.map((p) => p.description).filter(Boolean).join('; ') || group.description || '-';

      rows.push({
        'Kategori / Kelompok Kas': `  ${group.name}`,
        'Keterangan': descriptions,
        'Jumlah Transactions': groupPenarikan.length,
        'Total Nominal (Rp)': groupPenarikanTotal,
      });
    });

    rows.push({ 'Kategori / Kelompok Kas': 'TOTAL PENARIKAN KAS', 'Keterangan': '', 'Jumlah Transactions': penarikanTransactions.length, 'Total Nominal (Rp)': kasOutflowTotal });
    rows.push({});
    rows.push({ 'Kategori / Kelompok Kas': 'SISA SALDO KAS BERSIH', 'Keterangan': '', 'Jumlah Transactions': '', 'Total Nominal (Rp)': kasNetBalance });

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Laporan_Kas');
    XLSX.writeFile(wb, `Laporan_Kas_${selectedYear}.xlsx`);
  };

  return (
    <div className="w-full space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-200 pb-4">
        <div>
          <h2 className="text-2xl font-extrabold text-gray-900 flex items-center gap-2">
            <Wallet className="w-7 h-7 text-indigo-600" />
            Laporan Kas & Mutasi Operasional
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            Rekapitulasi setoran kas kolektif, transfer, penarikan, dan mutasi saldo bersih per jenis transaksi.
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
            className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-xl text-xs font-bold text-gray-800 focus:ring-2 focus:ring-indigo-500"
          >
            {yearOptions.map((year) => (
              <option key={year} value={year}>
                Tahun {year}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-bold text-gray-600 mb-1 uppercase">Filter Produk / Kelompok Kas</label>
          <select
            value={selectedKasGroupId}
            onChange={(e) => setSelectedKasGroupId(e.target.value)}
            className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-xl text-xs font-semibold text-gray-800 focus:ring-2 focus:ring-indigo-500"
          >
            <option value="all">-- Semua Produk / Kelompok Kas --</option>
            {kasGroups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-gray-200 p-5 rounded-2xl shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Total Setoran Kas</span>
            <ArrowDownLeft className="w-5 h-5 text-emerald-600" />
          </div>
          <p className="text-2xl font-black text-emerald-600 mt-2">
            Rp {kasInflowTotal.toLocaleString('id-ID')}
          </p>
        </div>

        <div className="bg-white border border-gray-200 p-5 rounded-2xl shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Total Penarikan Kas</span>
            <ArrowUpRight className="w-5 h-5 text-amber-600" />
          </div>
          <p className="text-2xl font-black text-amber-600 mt-2">
            Rp {kasOutflowTotal.toLocaleString('id-ID')}
          </p>
        </div>

        <div className="bg-white border border-gray-200 p-5 rounded-2xl shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Sisa Saldo Kas</span>
            <Wallet className="w-5 h-5 text-indigo-600" />
          </div>
          <p className={`text-2xl font-black mt-2 ${kasNetBalance < 0 ? 'text-red-600' : 'text-indigo-700'}`}>
            Rp {kasNetBalance.toLocaleString('id-ID')}
          </p>
        </div>
      </div>

      {/* Main Grouped Report Table */}
      <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm space-y-4">
        <h3 className="font-bold text-gray-900 text-base">Rekapitulasi Kas Berdasarkan Jenis Transaksi</h3>
        <div className="overflow-x-auto border border-gray-200 rounded-xl">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-gray-100 text-gray-700 border-b border-gray-200 font-bold uppercase">
              <tr>
                <th className="py-3 px-4 w-1/3">Jenis Transaksi / Produk Kas</th>
                <th className="py-3 px-4">Keterangan / Deskripsi</th>
                <th className="py-3 px-4 text-center">Jml Trx</th>
                <th className="py-3 px-4 text-right">Total Nominal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan={4} className="text-center py-8 text-gray-400">
                    Memuat data rekapitulasi kas...
                  </td>
                </tr>
              ) : (
                <>
                  {/* SECTION 1: SETORAN KAS */}
                  <tr className="bg-emerald-50/70 border-y border-emerald-200">
                    <td colSpan={4} className="py-3 px-4 font-black text-emerald-900 uppercase tracking-wider">
                      SETORAN KAS (KAS MASUK)
                    </td>
                  </tr>

                  {displayKasGroups.map((group) => {
                    const groupSetoran = setoranTransactions.filter((p) => p.kas_group_id === group.id);
                    const groupSetoranTotal = groupSetoran.reduce((sum, p) => sum + Math.abs(Number(p.amount) || 0), 0);
                    const descs = groupSetoran.map((p) => p.description).filter(Boolean).join(', ');

                    return (
                      <tr key={`setoran-${group.id}`} className="hover:bg-gray-50 transition">
                        <td className="py-3 px-4 font-bold text-gray-800 pl-8">
                          Setoran {group.name}
                        </td>
                        <td className="py-3 px-4 text-gray-500 italic max-w-xs truncate">
                          {descs || group.description || 'Setoran kas rutin'}
                        </td>
                        <td className="py-3 px-4 text-center font-mono font-semibold text-gray-600">
                          {groupSetoran.length}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-emerald-600">
                          Rp {groupSetoranTotal.toLocaleString('id-ID')}
                        </td>
                      </tr>
                    );
                  })}

                  {/* SUM ALL SETORAN */}
                  <tr className="bg-emerald-100/60 font-black border-t-2 border-emerald-300">
                    <td className="py-3 px-4 text-emerald-900 uppercase" colSpan={2}>
                      TOTAL SUM SETORAN KAS
                    </td>
                    <td className="py-3 px-4 text-center font-mono text-emerald-900">
                      {setoranTransactions.length}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-emerald-700 text-sm">
                      Rp {kasInflowTotal.toLocaleString('id-ID')}
                    </td>
                  </tr>

                  {/* SECTION 2: PENARIKAN KAS */}
                  <tr className="bg-amber-50/70 border-y border-amber-200">
                    <td colSpan={4} className="py-3 px-4 font-black text-amber-900 uppercase tracking-wider">
                      PENARIKAN KAS (KAS KELUAR)
                    </td>
                  </tr>

                  {displayKasGroups.map((group) => {
                    const groupPenarikan = penarikanTransactions.filter((p) => p.kas_group_id === group.id);
                    const groupPenarikanTotal = groupPenarikan.reduce((sum, p) => sum + Math.abs(Number(p.amount) || 0), 0);
                    const descs = groupPenarikan.map((p) => p.description).filter(Boolean).join(', ');

                    return (
                      <tr key={`penarikan-${group.id}`} className="hover:bg-gray-50 transition">
                        <td className="py-3 px-4 font-bold text-gray-800 pl-8">
                          Penarikan {group.name}
                        </td>
                        <td className="py-3 px-4 text-gray-500 italic max-w-xs truncate">
                          {descs || group.description || 'Penarikan operasional kas'}
                        </td>
                        <td className="py-3 px-4 text-center font-mono font-semibold text-gray-600">
                          {groupPenarikan.length}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-red-600">
                          Rp {groupPenarikanTotal.toLocaleString('id-ID')}
                        </td>
                      </tr>
                    );
                  })}

                  {/* SUM ALL PENARIKAN */}
                  <tr className="bg-amber-100/60 font-black border-t-2 border-amber-300">
                    <td className="py-3 px-4 text-amber-900 uppercase" colSpan={2}>
                      TOTAL SUM PENARIKAN KAS
                    </td>
                    <td className="py-3 px-4 text-center font-mono text-amber-900">
                      {penarikanTransactions.length}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-red-700 text-sm">
                      Rp {kasOutflowTotal.toLocaleString('id-ID')}
                    </td>
                  </tr>

                  {/* SISA KAS */}
                  <tr className="bg-indigo-900 text-white font-black text-sm">
                    <td className="py-4 px-4 uppercase" colSpan={3}>
                      SISA KAS (SALDO BERSIH)
                    </td>
                    <td className="py-4 px-4 text-right font-mono text-base text-emerald-300">
                      Rp {kasNetBalance.toLocaleString('id-ID')}
                    </td>
                  </tr>
                </>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}