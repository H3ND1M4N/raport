import React, { useMemo, useState } from 'react';
import {
  Activity,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  Copy,
  Download,
  FileSpreadsheet,
  FileUp,
  Laptop,
  Lock,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Wifi,
} from 'lucide-react';
import { buildSampleDapodikXlsxBytes } from '../lib/dapodikExcel';
import {
  normalizeDapodikWebServiceUrl,
  type DapodikConnectionConfig,
  type DapodikSyncDiff,
  type EraporDataset,
} from '../lib/eraporCore';
import { PanduanSinkronisasi } from './PanduanSinkronisasi';

type ConnectMethod = 'upload_excel' | 'local_relay' | 'direct_live';

interface DapodikSyncViewProps {
  dataset: EraporDataset;
  connectionConfig: DapodikConnectionConfig | null;
  isOnline: boolean;
  onSyncLive: (params: {
    hostUrl: string;
    npsn: string;
    token: string;
    mode: 'live' | 'simulate_delta';
  }) => Promise<DapodikSyncDiff | null>;
  onSyncLocalRelay: () => Promise<DapodikSyncDiff | null>;
  onImportJson: (rawText: string) => Promise<DapodikSyncDiff | null>;
  onImportFile: (file: File) => Promise<DapodikSyncDiff | null>;
  onSaveConfig: (patch: {
    hostUrl?: string;
    token?: string;
    autoSyncEnabled?: boolean;
    autoSyncIntervalSec?: number;
  }) => Promise<DapodikConnectionConfig>;
}

export const DapodikSyncView: React.FC<DapodikSyncViewProps> = ({
  dataset,
  connectionConfig,
  isOnline,
  onSyncLive,
  onSyncLocalRelay,
  onImportJson,
  onImportFile,
  onSaveConfig,
}) => {
  const [connectMethod, setConnectMethod] = useState<ConnectMethod>('upload_excel');
  const [hostUrl, setHostUrl] = useState(
    connectionConfig?.sourceHost || dataset.school.sourceHost || 'http://localhost:5774/WebService'
  );
  const [token, setToken] = useState('');
  const [pasteDataText, setPasteDataText] = useState('');
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [savingConfig, setSavingConfig] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);
  const [copiedCmd, setCopiedCmd] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{
    type: 'ok' | 'err';
    text: string;
  } | null>(null);
  const [lastDiff, setLastDiff] = useState<DapodikSyncDiff | null>(null);
  const [showGuide, setShowGuide] = useState(false);

  const [selectedRombel, setSelectedRombel] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const npsn = dataset.school.npsn;
  const autoSyncEnabled = connectionConfig?.autoSyncEnabled ?? false;
  const autoSyncIntervalSec = connectionConfig?.autoSyncIntervalSec ?? 20;
  const bridgeKey = connectionConfig?.bridgeKey ?? '';

  const filteredStudents = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return dataset.students.filter((st) => {
      const matchRombel = selectedRombel === 'all' || st.rombelId === selectedRombel;
      const matchSearch =
        !q ||
        st.nama.toLowerCase().includes(q) ||
        st.nisn.includes(q) ||
        st.nipd.includes(q);
      return matchRombel && matchSearch;
    });
  }, [dataset.students, selectedRombel, searchQuery]);

  const handleOneClickDownloadConnector = async (format: 'bat' | 'ps1' | 'mjs') => {
    setSavingConfig(true);
    setStatusMsg(null);
    const normalizedHost = normalizeDapodikWebServiceUrl(hostUrl);
    setHostUrl(normalizedHost);
    try {
      await onSaveConfig({
        hostUrl: normalizedHost,
        token: token.trim() || undefined,
        autoSyncEnabled: true,
        autoSyncIntervalSec,
      });

      const appOrigin =
        typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
      const downloadUrl = `/api/dapodik/bridge-script?npsn=${encodeURIComponent(
        npsn
      )}&format=${format}&host=${encodeURIComponent(normalizedHost)}&origin=${encodeURIComponent(
        appOrigin
      )}`;

      const filename =
        format === 'bat'
          ? `Sambung-Dapodik-${npsn}.bat`
          : format === 'ps1'
            ? `Sambung-Dapodik-${npsn}.ps1`
            : `penyambung-dapodik-${npsn}.mjs`;

      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setStatusMsg({
        type: 'ok',
        text:
          format === 'bat'
            ? `File Sambung-Dapodik-${npsn}.bat berhasil diunduh. Klik ganda file tersebut di PC Dapodik (jika muncul Windows protected your PC, pilih More info -> Run anyway), lalu klik tombol hijau "2. Tarik dari Penyambung Lokal".`
            : format === 'ps1'
              ? `File Sambung-Dapodik-${npsn}.ps1 berhasil diunduh. Klik kanan file -> "Run with PowerShell", lalu klik tombol hijau "2. Tarik dari Penyambung Lokal".`
              : 'Script Node (.mjs) penyambung lokal (127.0.0.1:5775) siap dijalankan di komputer Dapodik.',
      });
    } catch (err) {
      setStatusMsg({
        type: 'err',
        text: err instanceof Error ? err.message : 'Gagal menyiapkan penyambung Dapodik.',
      });
    } finally {
      setSavingConfig(false);
    }
  };

  const cmdRunCommand = `cmd /k "%USERPROFILE%\\Downloads\\Sambung-Dapodik-${npsn}.bat"`;

  const handleCopyCmdCommand = async () => {
    try {
      await navigator.clipboard.writeText(cmdRunCommand);
      setCopiedCmd(true);
      setTimeout(() => setCopiedCmd(false), 2500);
    } catch {
      setStatusMsg({
        type: 'ok',
        text: `Salin perintah ini ke Win+R lalu tekan Enter: ${cmdRunCommand}`,
      });
    }
  };

  const handlePullFromLocalRelay = async () => {
    setSyncing(true);
    setStatusMsg(null);
    try {
      const diff = await onSyncLocalRelay();
      if (diff) {
        setLastDiff(diff);
        setStatusMsg({
          type: 'ok',
          text: `Sinkronisasi via Penyambung Lokal (127.0.0.1:5775) berhasil! (+${diff.addedStudents} siswa baru, ${diff.updatedStudents} diperbarui, ${diff.unchangedStudents} sudah sesuai).`,
        });
      }
    } catch (err) {
      const raw = err instanceof Error ? err.message : '';
      const friendly =
        raw.includes('Failed to fetch') || raw.includes('NetworkError')
          ? `Penyambung Lokal (127.0.0.1:5775) belum berjalan. Pastikan jendela CMD dari Sambung-Dapodik-${npsn}.bat tetap terbuka dan menampilkan "[SIAP] Relay lokal berjalan di http://127.0.0.1:5775". Jika CMD tidak terbuka saat diklik ganda, pakai tombol "Salin Perintah CMD" (Win+R) atau unduh versi .ps1 / Cara 1 (Upload Excel).`
          : raw || 'Gagal menarik data dari Penyambung Lokal.';
      setStatusMsg({ type: 'err', text: friendly });
    } finally {
      setSyncing(false);
    }
  };

  const handleRunDirectSync = async (mode: 'live' | 'simulate_delta') => {
    setSyncing(true);
    setStatusMsg(null);
    const normalizedHost = normalizeDapodikWebServiceUrl(hostUrl);
    setHostUrl(normalizedHost);
    try {
      if (mode === 'live') {
        await onSaveConfig({
          hostUrl: normalizedHost,
          token: token.trim() || undefined,
        }).catch(() => undefined);
      }
      const diff = await onSyncLive({
        hostUrl: normalizedHost,
        npsn,
        token: token.trim(),
        mode,
      });
      if (diff) {
        setLastDiff(diff);
        setStatusMsg({
          type: 'ok',
          text:
            mode === 'simulate_delta'
              ? `Uji simulasi berhasil (+${diff.addedStudents} siswa baru, ${diff.updatedStudents} diperbarui). Nilai guru tetap aman.`
              : `Berhasil terhubung langsung ke Dapodik (${diff.addedStudents} siswa baru, ${diff.updatedStudents} diperbarui, ${diff.unchangedStudents} sudah sesuai).`,
        });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Belum dapat terhubung langsung ke Dapodik.';
      setStatusMsg({
        type: 'err',
        text: msg,
      });
    } finally {
      setSyncing(false);
    }
  };

  const handleSaveSettings = async (patch?: {
    autoSyncEnabled?: boolean;
    autoSyncIntervalSec?: number;
  }) => {
    setSavingConfig(true);
    const normalizedHost = normalizeDapodikWebServiceUrl(hostUrl);
    setHostUrl(normalizedHost);
    try {
      await onSaveConfig({
        hostUrl: normalizedHost,
        token: token.trim() || undefined,
        autoSyncEnabled: patch?.autoSyncEnabled ?? autoSyncEnabled,
        autoSyncIntervalSec: patch?.autoSyncIntervalSec ?? autoSyncIntervalSec,
      });
      setStatusMsg({
        type: 'ok',
        text: 'Pengaturan koneksi otomatis tersimpan terenkripsi.',
      });
    } catch (err) {
      setStatusMsg({
        type: 'err',
        text: err instanceof Error ? err.message : 'Gagal menyimpan pengaturan.',
      });
    } finally {
      setSavingConfig(false);
    }
  };

  const processSelectedFile = async (file: File) => {
    setSyncing(true);
    setStatusMsg(null);
    try {
      const diff = await onImportFile(file);
      if (diff) {
        setLastDiff(diff);
        setStatusMsg({
          type: 'ok',
          text: `Data dari "${file.name}" berhasil disinkronkan (+${diff.addedStudents} siswa baru, ${diff.updatedStudents} diperbarui, ${diff.unchangedStudents} sesuai).`,
        });
      }
    } catch (err) {
      setStatusMsg({
        type: 'err',
        text:
          err instanceof Error
            ? err.message
            : 'Format file belum sesuai (gunakan .xlsx, .xls, .csv, atau .json dari Dapodik).',
      });
    } finally {
      setSyncing(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await processSelectedFile(file);
    e.target.value = '';
  };

  const handleFileDrop = async (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    setIsDraggingFile(false);
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    await processSelectedFile(file);
  };

  const handleImportPastedData = async () => {
    if (!pasteDataText.trim()) {
      setStatusMsg({
        type: 'err',
        text: 'Tempel daftar siswa dari Excel/CSV terlebih dahulu pada kotak di atas.',
      });
      return;
    }
    setSyncing(true);
    setStatusMsg(null);
    try {
      const diff = await onImportJson(pasteDataText);
      if (diff) {
        setLastDiff(diff);
        setPasteDataText('');
        setStatusMsg({
          type: 'ok',
          text: `Daftar siswa berhasil dimasukkan (+${diff.addedStudents} baru, ${diff.updatedStudents} diperbarui).`,
        });
      }
    } catch (err) {
      setStatusMsg({
        type: 'err',
        text: err instanceof Error ? err.message : 'Gagal membaca daftar siswa yang ditempel.',
      });
    } finally {
      setSyncing(false);
    }
  };

  const handleDownloadSampleExcel = () => {
    const bytes = buildSampleDapodikXlsxBytes();
    const copy = new Uint8Array(bytes.byteLength);
    copy.set(bytes);
    const blob = new Blob([copy.buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Contoh-Data-Siswa-Dapodik-${npsn}.xlsx`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleCopyBridgeKey = async () => {
    if (!bridgeKey || typeof navigator === 'undefined') return;
    await navigator.clipboard.writeText(bridgeKey).catch(() => undefined);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 1800);
  };

  const rombelNameMap = new Map(dataset.rombels.map((r) => [r.id, r.nama]));

  const isLiveConnected =
    connectionConfig?.lastLiveChannel === 'local_bridge' ||
    connectionConfig?.lastLiveChannel === 'browser_direct' ||
    connectionConfig?.lastLiveChannel === 'server_direct';

  const statusHeading = isLiveConnected
    ? 'Sudah Terhubung Otomatis ke Dapodik'
    : 'Pilih Cara Hubungkan ke Dapodik Sekolah';

  const statusDetail =
    connectionConfig?.lastLiveMessage ||
    'Cara 1 (Upload Excel .xlsx dari Dapodik) langsung berhasil tanpa Token WebService, tanpa instalasi, dan aman 100% Read-Only.';

  return (
    <div className="space-y-6">
      {/* Page Title & Calm Status Strip */}
      <div className="flex flex-col gap-3 border-b border-slate-200 pb-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">
            Hubungkan ke Dapodik Sekolah ({dataset.school.namaSekolah})
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            NPSN <span className="font-mono font-semibold text-slate-800">{npsn}</span> · Data nama siswa, rombel, dan wali kelas mengikuti Dapodik secara aman tanpa mengubah isi Dapodik.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={() => setShowGuide(true)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-800 hover:bg-blue-100 whitespace-nowrap cursor-pointer"
          >
            <BookOpen className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Panduan Sinkronisasi</span>
          </button>

          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 whitespace-nowrap">
            <Lock className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Hanya Baca (Aman untuk Dapodik)</span>
          </span>
        </div>
      </div>

      <PanduanSinkronisasi
        isOpen={showGuide}
        onClose={() => setShowGuide(false)}
        npsn={npsn}
        schoolName={dataset.school.namaSekolah}
        initialTrack={connectMethod === 'local_relay' ? 'bridge' : 'excel'}
        onJumpToMethod={(method) => setConnectMethod(method)}
        onDownloadSampleExcel={handleDownloadSampleExcel}
        onDownloadBat={() => void handleOneClickDownloadConnector('bat')}
      />

      {/* Main Guided Setup + Integrity Sidebar */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <section className="lg:col-span-2 rounded-xl border border-slate-200 bg-white p-6 space-y-5">
          {/* Plain Language Connection Status */}
          <div className="flex items-start gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3.5">
            <Activity
              className={`mt-0.5 h-4 w-4 shrink-0 ${
                isLiveConnected ? 'text-emerald-600' : 'text-blue-700'
              }`}
              aria-hidden="true"
            />
            <div>
              <p className="text-xs font-bold text-slate-900">{statusHeading}</p>
              <p className="mt-0.5 text-xs text-slate-600">{statusDetail}</p>
            </div>
          </div>

          {/* 3 Simple Method Tabs Ordered by Easiest Real-World Success */}
          <div
            className="grid grid-cols-1 gap-2 sm:grid-cols-3 bg-slate-100 p-1 rounded-lg"
            role="tablist"
            aria-label="Pilih cara menghubungkan Dapodik"
          >
            <button
              type="button"
              role="tab"
              aria-selected={connectMethod === 'upload_excel'}
              onClick={() => setConnectMethod('upload_excel')}
              className={`flex items-center justify-center gap-2 rounded-md px-3 py-2 text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                connectMethod === 'upload_excel'
                  ? 'bg-white text-blue-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <FileSpreadsheet className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span>1. Upload Excel (Termudah)</span>
            </button>

            <button
              type="button"
              role="tab"
              aria-selected={connectMethod === 'local_relay'}
              onClick={() => setConnectMethod('local_relay')}
              className={`flex items-center justify-center gap-2 rounded-md px-3 py-2 text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                connectMethod === 'local_relay'
                  ? 'bg-white text-blue-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Laptop className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span>2. Penyambung PC Dapodik</span>
            </button>

            <button
              type="button"
              role="tab"
              aria-selected={connectMethod === 'direct_live'}
              onClick={() => setConnectMethod('direct_live')}
              className={`flex items-center justify-center gap-2 rounded-md px-3 py-2 text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                connectMethod === 'direct_live'
                  ? 'bg-white text-blue-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Wifi className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span>3. URL WebService (LAN)</span>
            </button>
          </div>

          {/* MODE 1: Direct Dapodik Excel (.xlsx/.xls/.csv) or JSON Upload — 100% Zero-Failure Solution */}
          {connectMethod === 'upload_excel' && (
            <div className="space-y-4">
              <div className="rounded-lg border border-blue-100 bg-blue-50/70 p-4 space-y-1.5 text-xs text-slate-700">
                <p className="font-bold text-slate-900">
                  Paling Mudah &amp; Pasti Berhasil (Tanpa Token, Tanpa Script, Tanpa Pengaturan IP):
                </p>
                <ol className="space-y-1 list-decimal list-inside">
                  <li>
                    Buka aplikasi <strong>Dapodik</strong> sekolah &rarr; menu{' '}
                    <strong>Peserta Didik &rarr; Unduh (Excel .xlsx)</strong>.
                  </li>
                  <li>
                    Klik area unggah di bawah ini dan pilih langsung file <strong>.xlsx / .xls / .csv / .json</strong> hasil unduhan Dapodik tersebut — nama siswa &amp; rombel otomatis tersusun.
                  </li>
                </ol>
              </div>

              <label
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDraggingFile(true);
                }}
                onDragLeave={() => setIsDraggingFile(false)}
                onDrop={(e) => void handleFileDrop(e)}
                className={`flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-6 text-center transition-colors cursor-pointer ${
                  isDraggingFile
                    ? 'border-blue-600 bg-blue-50'
                    : 'border-slate-300 bg-slate-50/70 hover:border-blue-500 hover:bg-slate-50'
                }`}
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 text-blue-700">
                  <FileUp className="h-5 w-5" aria-hidden="true" />
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-900">
                    {syncing
                      ? 'Membaca file Excel / CSV...'
                      : 'Klik untuk Pilih File Excel Dapodik (.xlsx / .xls / .csv / .json)'}
                  </p>
                  <p className="mt-0.5 text-[11px] text-slate-500">
                    Bisa juga seret &amp; lepas (drag-and-drop) file langsung dari folder Downloads komputer Anda.
                  </p>
                </div>
                <input
                  type="file"
                  accept=".xlsx,.xls,.csv,.txt,.json,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv,application/json"
                  onChange={(e) => void handleFileUpload(e)}
                  className="sr-only"
                />
              </label>

              <div className="flex flex-wrap items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={handleDownloadSampleExcel}
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50 cursor-pointer"
                >
                  <Download className="h-3.5 w-3.5 text-blue-700" aria-hidden="true" />
                  <span>Unduh Contoh File Excel (.xlsx)</span>
                </button>
                <span className="text-[11px] text-slate-500">
                  Mendukung format unduhan asli Dapodik (header judul di atas otomatis dilewati).
                </span>
              </div>

              <div>
                <label htmlFor="paste-csv-data" className="block text-xs font-semibold text-slate-700">
                  Atau Salin &amp; Tempel Langsung dari Tabel Excel (Ctrl+C &rarr; Ctrl+V)
                </label>
                <textarea
                  id="paste-csv-data"
                  rows={4}
                  value={pasteDataText}
                  onChange={(e) => setPasteDataText(e.target.value)}
                  placeholder={'NISN;NIPD;Nama Peserta Didik;L/P;Rombel;Nama Orang Tua\n0134567801;25001;I Putu Aditya;L;Kelas 6A;I Made Aditya'}
                  className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white p-3 font-mono text-[11px] text-slate-900 focus:border-blue-600 focus:outline-none"
                />
                <button
                  type="button"
                  disabled={syncing || !isOnline}
                  onClick={() => void handleImportPastedData()}
                  className="mt-2 inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-50 cursor-pointer"
                >
                  <span>Masukkan Data Siswa yang Ditempel</span>
                </button>
              </div>
            </div>
          )}

          {/* MODE 2: Local Relay 127.0.0.1:5775 (Works Even Behind Cloud IAP & Without Admin Rights) */}
          {connectMethod === 'local_relay' && (
            <div className="space-y-4">
              <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-4 space-y-2 text-xs text-slate-700">
                <p className="font-bold text-slate-900">
                  Penyambung Real-Time Melalui Browser (Anti-Blokir CORS &amp; Tanpa Hak Admin Windows):
                </p>
                <ol className="space-y-1.5 list-decimal list-inside">
                  <li>
                    Buka <strong>Dapodik &rarr; Pengaturan &rarr; WebService &rarr; Tambah</strong> (IP: <code className="font-mono">127.0.0.1</code>), salin <strong>Token</strong>-nya dan tempel di bawah.
                  </li>
                  <li>
                    Klik <strong>1. Unduh Penyambung (.bat)</strong> lalu klik ganda file di PC Dapodik (otomatis membuka relay lokal <code className="font-mono">127.0.0.1:5775</code> sekaligus menyimpan file cadangan <code className="font-mono">Data-Dapodik-{npsn}.json</code> di Desktop).
                  </li>
                  <li>
                    Klik tombol hijau <strong>2. Tarik dari Penyambung Lokal</strong> di bawah untuk langsung menyinkronkan melalui sesi browser Anda!
                  </li>
                </ol>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <div className="flex items-center justify-between">
                    <label htmlFor="easy-token" className="block text-xs font-semibold text-slate-700">
                      Token dari Dapodik (Pengaturan &rarr; WebService)
                    </label>
                    {connectionConfig?.hasToken && (
                      <span className="text-[11px] font-medium text-emerald-700">
                        Token sudah tersimpan aman
                      </span>
                    )}
                  </div>
                  <input
                    id="easy-token"
                    type="password"
                    value={token}
                    onChange={(e) => setToken(e.target.value)}
                    placeholder={
                      connectionConfig?.hasToken
                        ? 'Biarkan kosong untuk memakai token tersimpan, atau tempel token baru...'
                        : 'Tempel Token Dapodik di sini...'
                    }
                    className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
                  />
                </div>

                <div className="sm:col-span-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <label htmlFor="easy-host" className="block text-xs font-semibold text-slate-700">
                      Alamat Dapodik di Jaringan Sekolah
                    </label>
                    <div className="flex items-center gap-2 text-[11px]">
                      <button
                        type="button"
                        onClick={() => setHostUrl('http://localhost:5774/WebService')}
                        className="font-semibold text-blue-700 hover:underline cursor-pointer"
                      >
                        PC Ini (localhost:5774)
                      </button>
                      <span className="text-slate-300" aria-hidden="true">|</span>
                      <button
                        type="button"
                        onClick={() => setHostUrl('http://192.168.1.10:5774/WebService')}
                        className="font-semibold text-slate-600 hover:text-slate-900 hover:underline cursor-pointer"
                      >
                        Contoh IP LAN Sekolah
                      </button>
                    </div>
                  </div>
                  <input
                    id="easy-host"
                    type="text"
                    value={hostUrl}
                    onChange={(e) => setHostUrl(e.target.value)}
                    placeholder="http://localhost:5774/WebService"
                    className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3 pt-1">
                <button
                  type="button"
                  disabled={savingConfig || !isOnline}
                  onClick={() => void handleOneClickDownloadConnector('bat')}
                  className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-4 py-2.5 text-xs font-semibold text-white hover:bg-blue-800 disabled:opacity-50 cursor-pointer"
                >
                  <Download className="h-4 w-4" aria-hidden="true" />
                  <span>
                    {savingConfig
                      ? 'Menyiapkan...'
                      : '1. Unduh Penyambung (.bat)'}
                  </span>
                </button>

                <button
                  type="button"
                  disabled={syncing || !isOnline}
                  onClick={() => void handlePullFromLocalRelay()}
                  className="inline-flex items-center gap-2 rounded-lg bg-emerald-700 px-4 py-2.5 text-xs font-semibold text-white hover:bg-emerald-800 disabled:opacity-50 cursor-pointer"
                >
                  <RefreshCw className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} aria-hidden="true" />
                  <span>
                    {syncing ? 'Menarik Data...' : '2. Tarik dari Penyambung Lokal (127.0.0.1:5775)'}
                  </span>
                </button>
              </div>

              <div className="rounded-lg border border-amber-200 bg-amber-50/70 p-3.5 text-xs text-slate-700 space-y-2.5">
                <p className="font-semibold text-slate-900">
                  Jika CMD tidak terbuka atau tertutup otomatis di Windows:
                </p>
                <ul className="list-disc list-inside space-y-1 text-[11px] text-slate-700">
                  <li>
                    Unduh ulang file <code className="font-mono">Sambung-Dapodik-{npsn}.bat</code> versi terbaru di atas, lalu klik ganda. Jika muncul peringatan biru Windows Defender SmartScreen, klik <strong>More info</strong> &rarr; <strong>Run anyway</strong>.
                  </li>
                  <li>
                    Atau tekan tombol <strong>Win + R</strong> di keyboard, tempel perintah CMD di bawah agar jendela CMD dipaksa tetap terbuka, lalu tekan <strong>Enter</strong>.
                  </li>
                </ul>
                <div className="flex flex-wrap items-center gap-2">
                  <code className="rounded border border-amber-300 bg-white px-2.5 py-1.5 font-mono text-[11px] text-slate-900 select-all">
                    {cmdRunCommand}
                  </code>
                  <button
                    type="button"
                    onClick={() => void handleCopyCmdCommand()}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-[11px] font-semibold text-slate-800 hover:bg-slate-50 cursor-pointer"
                  >
                    <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>{copiedCmd ? 'Perintah Tersalin' : 'Salin Perintah CMD'}</span>
                  </button>
                  <button
                    type="button"
                    disabled={savingConfig || !isOnline}
                    onClick={() => void handleOneClickDownloadConnector('ps1')}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-[11px] font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-50 cursor-pointer"
                  >
                    <Download className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Unduh Alternatif (.ps1)</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* MODE 3: Direct Web/LAN URL Connection */}
          {connectMethod === 'direct_live' && (
            <div className="space-y-4">
              <p className="text-xs text-slate-600 leading-relaxed">
                Gunakan cara ini hanya jika WebService Dapodik sekolah Anda memiliki alamat domain publik (tunnel HTTPS) atau dijalankan langsung di komputer server e-Rapor yang sama. Jika gagal karena firewall/CORS, gunakan <strong>Cara 1 (Upload Excel)</strong> atau <strong>Cara 2 (Penyambung PC Dapodik)</strong>.
              </p>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label htmlFor="direct-host" className="block text-xs font-semibold text-slate-700">
                    Alamat WebService Dapodik (boleh tulis tanpa /WebService)
                  </label>
                  <input
                    id="direct-host"
                    type="text"
                    value={hostUrl}
                    onChange={(e) => setHostUrl(e.target.value)}
                    placeholder="Contoh: localhost:5774 atau https://dapodik.sekolah.sch.id"
                    className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label htmlFor="direct-token" className="block text-xs font-semibold text-slate-700">
                    Token WebService Dapodik
                  </label>
                  <input
                    id="direct-token"
                    type="password"
                    value={token}
                    onChange={(e) => setToken(e.target.value)}
                    placeholder={
                      connectionConfig?.hasToken
                        ? 'Biarkan kosong untuk memakai token tersimpan...'
                        : 'Tempel Token dari Pengaturan -> WebService Dapodik'
                    }
                    className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3 pt-1">
                <button
                  type="button"
                  disabled={syncing || !isOnline}
                  onClick={() => void handleRunDirectSync('live')}
                  className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-5 py-2.5 text-xs font-semibold text-white hover:bg-blue-800 disabled:opacity-50 cursor-pointer"
                >
                  <RefreshCw className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} aria-hidden="true" />
                  <span>{syncing ? 'Menghubungkan...' : 'Tarik Data Dapodik Sekarang'}</span>
                </button>
              </div>
            </div>
          )}

          {/* Friendly Status Feedback */}
          {statusMsg && (
            <div
              role="status"
              className={`rounded-lg border px-3.5 py-3 text-xs ${
                statusMsg.type === 'ok'
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                  : 'border-red-200 bg-red-50 text-red-900'
              }`}
            >
              <div className="flex items-start gap-2">
                {statusMsg.type === 'ok' ? (
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" aria-hidden="true" />
                ) : (
                  <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-red-700" aria-hidden="true" />
                )}
                <p>{statusMsg.text}</p>
              </div>
            </div>
          )}

          {lastDiff && (
            <div className="grid grid-cols-2 gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3.5 text-xs sm:grid-cols-4">
              <div>
                <span className="text-slate-500">Siswa Baru</span>
                <p className="font-mono font-bold tabular-nums text-slate-900">+{lastDiff.addedStudents}</p>
              </div>
              <div>
                <span className="text-slate-500">Diperbarui</span>
                <p className="font-mono font-bold tabular-nums text-slate-900">{lastDiff.updatedStudents}</p>
              </div>
              <div>
                <span className="text-slate-500">Pindah Rombel</span>
                <p className="font-mono font-bold tabular-nums text-slate-900">{lastDiff.movedRombelStudents}</p>
              </div>
              <div>
                <span className="text-slate-500">Kode Verifikasi</span>
                <p className="font-mono font-semibold text-emerald-700 truncate">
                  {lastDiff.checksumSha256.slice(0, 10)}
                </p>
              </div>
            </div>
          )}

          {/* Collapsible Advanced Settings */}
          <details className="rounded-lg border border-slate-200 bg-slate-50/50 p-3.5">
            <summary className="flex cursor-pointer list-none items-center justify-between text-xs font-semibold text-slate-700">
              <span>Pengaturan Lanjutan &amp; Simulasi Uji Coba (Opsional)</span>
              <ChevronDown className="h-4 w-4 text-slate-500" aria-hidden="true" />
            </summary>

            <div className="mt-4 space-y-4 border-t border-slate-200 pt-4 text-xs">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-semibold text-slate-800">Jadwal Sinkron Otomatis (Auto-Sync)</p>
                  <p className="text-[11px] text-slate-500">
                    Memeriksa pembaruan otomatis jika Penyambung Lokal (127.0.0.1:5775) aktif.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <label htmlFor="autosync-interval" className="sr-only">
                    Interval Sinkronisasi Real-Time
                  </label>
                  <select
                    id="autosync-interval"
                    value={autoSyncIntervalSec}
                    disabled={savingConfig}
                    onChange={(e) =>
                      void handleSaveSettings({ autoSyncIntervalSec: Number(e.target.value) })
                    }
                    className="rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-800"
                  >
                    <option value={15}>Tiap 15 detik</option>
                    <option value={20}>Tiap 20 detik</option>
                    <option value={30}>Tiap 30 detik</option>
                    <option value={60}>Tiap 1 menit</option>
                    <option value={300}>Tiap 5 menit</option>
                  </select>

                  <button
                    type="button"
                    disabled={savingConfig || !isOnline}
                    aria-pressed={autoSyncEnabled}
                    onClick={() => void handleSaveSettings({ autoSyncEnabled: !autoSyncEnabled })}
                    className={`rounded-md px-3 py-1.5 text-xs font-semibold cursor-pointer ${
                      autoSyncEnabled
                        ? 'bg-emerald-700 text-white hover:bg-emerald-800'
                        : 'border border-slate-300 bg-white text-slate-800 hover:bg-slate-100'
                    }`}
                  >
                    {autoSyncEnabled ? 'Auto-Sync Aktif' : 'Aktifkan Auto-Sync'}
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-3">
                <div>
                  <p className="font-semibold text-slate-800">
                    Kunci Penyambung Sekolah (NPSN {npsn})
                  </p>
                  <p className="font-mono text-[11px] text-slate-600">
                    {bridgeKey || 'Tersedia setelah penyimpanan awal'}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => void handleCopyBridgeKey()}
                    className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-3 py-1.5 font-semibold text-slate-800 hover:bg-slate-100 cursor-pointer"
                  >
                    <Copy className="h-3 w-3" aria-hidden="true" />
                    <span>{copiedKey ? 'Tersalin' : 'Salin Kunci'}</span>
                  </button>
                  <button
                    type="button"
                    disabled={savingConfig || !isOnline}
                    onClick={() => void handleOneClickDownloadConnector('mjs')}
                    className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-3 py-1.5 font-semibold text-slate-800 hover:bg-slate-100 cursor-pointer"
                  >
                    <Download className="h-3 w-3" aria-hidden="true" />
                    <span>Script Node (.mjs)</span>
                  </button>
                  <button
                    type="button"
                    disabled={syncing || !isOnline}
                    onClick={() => void handleRunDirectSync('simulate_delta')}
                    className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-3 py-1.5 font-semibold text-slate-700 hover:bg-slate-100 cursor-pointer"
                  >
                    <span>Uji Simulasi Mutasi (Demo)</span>
                  </button>
                </div>
              </div>
            </div>
          </details>
        </section>

        {/* Right Column: Audit Trail */}
        <section className="rounded-xl border border-slate-200 bg-white p-6">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-emerald-600" aria-hidden="true" />
            <h2 className="text-sm font-bold text-slate-900">Riwayat Sinkronisasi Aman</h2>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Catatan setiap penarikan data resmi. Nilai yang sudah diinput guru tidak pernah terhapus saat siswa berpindah kelas.
          </p>
          <div className="mt-4 space-y-3 max-h-96 overflow-y-auto pr-1">
            {dataset.auditLogs.slice(0, 8).map((log) => (
              <div key={log.id} className="border-b border-slate-100 pb-2.5 last:border-b-0">
                <p className="text-xs font-semibold text-slate-800">{log.action}</p>
                <p className="mt-0.5 text-xs text-slate-600">{log.target}</p>
                <p className="mt-0.5 font-mono text-[11px] text-slate-400">
                  {new Date(log.timestamp).toLocaleTimeString('id-ID')} · Hash {log.integrityHash}
                </p>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* Master Read-Only Student Table */}
      <section className="rounded-xl border border-slate-200 bg-white">
        <div className="flex flex-col gap-3 border-b border-slate-200 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-sm font-bold text-slate-900">
              Data Peserta Didik Resmi Dapodik ({filteredStudents.length} Siswa)
            </h2>
            <p className="text-xs text-slate-500">
              Nama, NISN, dan kelas mengikuti data Dapodik sekolah sebagai acuan tunggal.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label htmlFor="filter-rombel-dapodik" className="sr-only">
              Filter Rombel
            </label>
            <select
              id="filter-rombel-dapodik"
              value={selectedRombel}
              onChange={(e) => setSelectedRombel(e.target.value)}
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-800"
            >
              <option value="all">Semua Rombel</option>
              {dataset.rombels.map((rb) => (
                <option key={rb.id} value={rb.id}>
                  {rb.nama}
                </option>
              ))}
            </select>

            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-2 h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
              <label htmlFor="search-dapodik-student" className="sr-only">
                Cari nama atau NISN siswa
              </label>
              <input
                id="search-dapodik-student"
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari nama atau NISN..."
                className="w-52 rounded-lg border border-slate-300 bg-white py-1.5 pl-8 pr-3 text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
              />
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-slate-600">
                <th className="px-6 py-3 font-semibold">NISN / NIPD</th>
                <th className="px-4 py-3 font-semibold">Nama Peserta Didik</th>
                <th className="px-4 py-3 font-semibold">L/P</th>
                <th className="px-4 py-3 font-semibold">Rombel (Dapodik)</th>
                <th className="px-4 py-3 font-semibold">Orang Tua/Wali</th>
                <th className="px-6 py-3 font-semibold">ID Dapodik</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredStudents.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-slate-500">
                    Belum ada peserta didik pada rombel atau pencarian ini.
                  </td>
                </tr>
              ) : (
                filteredStudents.map((st) => (
                  <tr key={st.id} className="hover:bg-slate-50/80">
                    <td className="px-6 py-3 font-mono tabular-nums text-slate-700 whitespace-nowrap">
                      {st.nisn} · {st.nipd}
                    </td>
                    <td className="px-4 py-3 font-semibold text-slate-900">{st.nama}</td>
                    <td className="px-4 py-3 text-slate-600">{st.jenisKelamin}</td>
                    <td className="px-4 py-3 text-slate-800 whitespace-nowrap">
                      {rombelNameMap.get(st.rombelId) ?? st.rombelId}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{st.namaOrangTua}</td>
                    <td className="px-6 py-3 font-mono text-[11px] text-slate-500 whitespace-nowrap">
                      {st.pesertaDidikId}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};
