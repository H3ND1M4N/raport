import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Copy,
  Download,
  FileSpreadsheet,
  GraduationCap,
  Laptop,
  Lock,
  ShieldCheck,
  Terminal,
  Upload,
  X,
} from 'lucide-react';

export type PanduanTrack = 'excel' | 'bridge' | 'guru';

export interface PanduanSinkronisasiProps {
  isOpen: boolean;
  onClose: () => void;
  npsn: string;
  schoolName: string;
  initialTrack?: PanduanTrack;
  onJumpToMethod?: (method: 'upload_excel' | 'local_relay') => void;
  onDownloadSampleExcel?: () => void;
  onDownloadBat?: () => void;
}

interface StepItem {
  title: string;
  subtitle: string;
  badge: string;
  renderBody: () => React.ReactNode;
}

export const PanduanSinkronisasi: React.FC<PanduanSinkronisasiProps> = ({
  isOpen,
  onClose,
  npsn,
  schoolName,
  initialTrack = 'excel',
  onJumpToMethod,
  onDownloadSampleExcel,
  onDownloadBat,
}) => {
  const [activeTrack, setActiveTrack] = useState<PanduanTrack>(initialTrack);
  const [stepIndex, setStepIndex] = useState<number>(0);
  const [copiedIp, setCopiedIp] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setActiveTrack(initialTrack);
      setStepIndex(0);
    }
  }, [isOpen, initialTrack]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleCopyLoopback = async () => {
    if (typeof navigator === 'undefined') return;
    await navigator.clipboard.writeText('127.0.0.1').catch(() => undefined);
    setCopiedIp(true);
    setTimeout(() => setCopiedIp(false), 1800);
  };

  const handleSelectTrack = (track: PanduanTrack) => {
    setActiveTrack(track);
    setStepIndex(0);
  };

  const excelSteps: StepItem[] = [
    {
      title: 'Unduh File Excel Resmi dari Dapodik',
      subtitle: 'Tidak memerlukan Token WebService ataupun skrip tambahan.',
      badge: 'Di PC Dapodik',
      renderBody: () => (
        <div className="space-y-4">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Visual Navigasi di Aplikasi Dapodik Sekolah
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
              <span className="rounded-md border border-slate-300 bg-white px-3 py-1.5 font-semibold text-slate-800">
                1. Login Dapodik Sekolah
              </span>
              <ArrowRight className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
              <span className="rounded-md border border-slate-300 bg-white px-3 py-1.5 font-semibold text-slate-800">
                2. Menu Peserta Didik
              </span>
              <ArrowRight className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
              <span className="rounded-md border border-blue-200 bg-blue-50 px-3 py-1.5 font-semibold text-blue-800">
                3. Klik Unduh &rarr; Excel (.xlsx)
              </span>
            </div>
          </div>

          <ul className="space-y-2 text-xs text-slate-700 leading-relaxed">
            <li className="flex items-start gap-2">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden="true" />
              <span>
                Buka aplikasi <strong>Dapodik</strong> sekolah Anda, lalu masuk ke menu{' '}
                <strong>Peserta Didik &rarr; Peserta Didik</strong>.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden="true" />
              <span>
                Klik tombol <strong>Unduh</strong> di toolbar atas dan simpan berkas berformat{' '}
                <code className="rounded bg-slate-100 px-1 py-0.5 font-mono text-slate-900">.xlsx</code>{' '}
                (misalnya <code className="rounded bg-slate-100 px-1 py-0.5 font-mono text-slate-900">daftar_peserta_didik.xlsx</code>).
              </span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden="true" />
              <span>
                Anda <strong>tidak perlu mengedit</strong> atau menghapus baris judul sekolah di bagian atas file Excel tersebut.
              </span>
            </li>
          </ul>
        </div>
      ),
    },
    {
      title: 'Pastikan Format File & Kolom Sesuai',
      subtitle: 'Aplikasi otomatis membaca header resmi Dapodik maupun CSV/Excel buatan sendiri.',
      badge: 'Cek Format',
      renderBody: () => (
        <div className="space-y-4">
          <div className="overflow-hidden rounded-xl border border-slate-200">
            <div className="border-b border-slate-200 bg-slate-100 px-3 py-2 text-[11px] font-semibold text-slate-700">
              Contoh Struktur Excel Asli Dapodik (Baris Judul Otomatis Dilewati)
            </div>
            <div className="overflow-x-auto bg-white">
              <table className="w-full text-left font-mono text-[11px]">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-slate-400">
                    <th className="px-2.5 py-1.5 font-normal" colSpan={6}>
                      Baris 1-3: Daftar Peserta Didik {schoolName} (otomatis dilewati)
                    </th>
                  </tr>
                  <tr className="border-b border-slate-200 bg-blue-50/70 text-blue-900">
                    <th className="px-2.5 py-1.5 font-semibold">Nama</th>
                    <th className="px-2.5 py-1.5 font-semibold">NIPD</th>
                    <th className="px-2.5 py-1.5 font-semibold">JK</th>
                    <th className="px-2.5 py-1.5 font-semibold">NISN</th>
                    <th className="px-2.5 py-1.5 font-semibold">Nama Ayah/Ibu</th>
                    <th className="px-2.5 py-1.5 font-semibold">Rombel Saat Ini</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  <tr>
                    <td className="px-2.5 py-1.5">I Putu Aditya</td>
                    <td className="px-2.5 py-1.5">25001</td>
                    <td className="px-2.5 py-1.5">L</td>
                    <td className="px-2.5 py-1.5">0134567801</td>
                    <td className="px-2.5 py-1.5">I Made Putra</td>
                    <td className="px-2.5 py-1.5">Kelas 6A</td>
                  </tr>
                  <tr>
                    <td className="px-2.5 py-1.5">Ni Luh Ayu</td>
                    <td className="px-2.5 py-1.5">25002</td>
                    <td className="px-2.5 py-1.5">P</td>
                    <td className="px-2.5 py-1.5">0134567802</td>
                    <td className="px-2.5 py-1.5">Ni Wayan Sari</td>
                    <td className="px-2.5 py-1.5">Kelas 6A</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 text-xs">
            <div className="rounded-lg border border-emerald-200 bg-emerald-50/70 p-3">
              <p className="font-bold text-emerald-900">Format yang Didukung</p>
              <p className="mt-1 text-emerald-800">
                <code className="font-mono font-semibold">.xlsx</code>,{' '}
                <code className="font-mono font-semibold">.xls</code>,{' '}
                <code className="font-mono font-semibold">.csv</code>,{' '}
                <code className="font-mono font-semibold">.json</code>, atau salin-tempel langsung dari tabel Excel (<code className="font-mono">Ctrl+C</code> &rarr; <code className="font-mono">Ctrl+V</code>).
              </p>
            </div>
            <div className="rounded-lg border border-amber-200 bg-amber-50/70 p-3">
              <p className="font-bold text-amber-900">Hindari Kesalahan Umum</p>
              <p className="mt-1 text-amber-800">
                Jangan mengunggah file halaman web (<code className="font-mono">.html</code> / hasil Save Page As) atau PDF karena bukan tabel data siswa.
              </p>
            </div>
          </div>

          {onDownloadSampleExcel && (
            <button
              type="button"
              onClick={onDownloadSampleExcel}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50 cursor-pointer"
            >
              <Download className="h-3.5 w-3.5 text-blue-700" aria-hidden="true" />
              <span>Unduh Contoh File Excel Resmi (.xlsx)</span>
            </button>
          )}
        </div>
      ),
    },
    {
      title: 'Unggah ke Tab 1. Upload Excel di e-Rapor',
      subtitle: 'Data rombel & siswa langsung tersinkron terenkripsi tanpa mengubah nilai yang sudah ada.',
      badge: 'Di e-Rapor',
      renderBody: () => (
        <div className="space-y-4">
          <div className="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-blue-300 bg-blue-50/60 p-5 text-center">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 text-blue-700">
              <Upload className="h-5 w-5" aria-hidden="true" />
            </div>
            <p className="text-xs font-bold text-slate-900">
              Menu Referensi Dapodik &rarr; Tab 1. Upload Excel (Termudah)
            </p>
            <p className="text-xs text-slate-600 max-w-md">
              Klik kotak unggah atau seret &amp; lepas file <code className="font-mono">.xlsx</code> dari folder Downloads komputer Anda.
            </p>
          </div>

          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3.5 text-xs text-slate-700">
            <strong className="text-slate-900">Aman untuk Nilai Guru:</strong> Jika nanti ada siswa baru atau mutasi rombel di Dapodik, unggah ulang file Excel terbaru — nilai guru dan deskripsi siswa lama tetap terjaga utuh.
          </div>

          {onJumpToMethod && (
            <button
              type="button"
              onClick={() => {
                onJumpToMethod('upload_excel');
                onClose();
              }}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-800 cursor-pointer"
            >
              <FileSpreadsheet className="h-4 w-4" aria-hidden="true" />
              <span>Langsung Buka Tab Upload Excel</span>
            </button>
          )}
        </div>
      ),
    },
  ];

  const bridgeSteps: StepItem[] = [
    {
      title: 'Aktifkan Token WebService di Aplikasi Dapodik',
      subtitle: 'Daftarkan IP lokal 127.0.0.1 di Dapodik agar Bridge Lokal dapat membaca data (Read-Only).',
      badge: 'Langkah 1 / 4',
      renderBody: () => (
        <div className="space-y-4">
          {/* Visual Architecture Schematic */}
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Cara Kerja Bridge Lokal (Anti-Blokir CORS &amp; Tanpa Hak Admin)
            </p>
            <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3 text-center text-xs">
              <div className="rounded-lg border border-slate-200 bg-white p-2.5">
                <p className="font-bold text-slate-900">Dapodik Sekolah</p>
                <p className="font-mono text-[11px] text-slate-500">localhost:5774</p>
                <span className="mt-1 inline-block text-[10px] font-semibold text-emerald-700">
                  HTTP GET Read-Only
                </span>
              </div>
              <div className="rounded-lg border border-blue-200 bg-blue-50 p-2.5">
                <p className="font-bold text-blue-900">Bridge Lokal (.bat)</p>
                <p className="font-mono text-[11px] text-blue-700">127.0.0.1:5775</p>
                <span className="mt-1 inline-block text-[10px] font-semibold text-blue-800">
                  Relay Anti-CORS + Backup
                </span>
              </div>
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-2.5">
                <p className="font-bold text-emerald-900">Browser e-Rapor</p>
                <p className="font-mono text-[11px] text-emerald-700">AES-256-GCM</p>
                <span className="mt-1 inline-block text-[10px] font-semibold text-emerald-800">
                  Tarik Otomatis / 1-Klik
                </span>
              </div>
            </div>
          </div>

          <ol className="space-y-2 text-xs text-slate-700 list-decimal list-inside">
            <li>
              Buka aplikasi <strong>Dapodik</strong> sekolah &rarr; pilih menu{' '}
              <strong>Pengaturan &rarr; WebService</strong>.
            </li>
            <li>
              Klik <strong>Tambah</strong>, isi Nama Aplikasi: <code className="rounded bg-slate-100 px-1 py-0.5 font-mono">e-Rapor</code> dan Alamat IP:{' '}
              <span className="inline-flex items-center gap-1.5">
                <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono font-semibold text-slate-900">
                  127.0.0.1
                </code>
                <button
                  type="button"
                  onClick={() => void handleCopyLoopback()}
                  className="inline-flex items-center gap-1 rounded border border-slate-300 bg-white px-1.5 py-0.5 text-[11px] font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  {copiedIp ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
                  <span>{copiedIp ? 'Tersalin' : 'Salin'}</span>
                </button>
              </span>
            </li>
            <li>
              Klik <strong>Simpan</strong> lalu salin kode <strong>Token</strong> yang muncul di tabel WebService.
            </li>
          </ol>
        </div>
      ),
    },
    {
      title: `Unduh Skrip Penyambung (Sambung-Dapodik-${npsn}.bat)`,
      subtitle: 'Token Anda disematkan aman agar tidak perlu mengetik perintah manual.',
      badge: 'Langkah 2 / 4',
      renderBody: () => (
        <div className="space-y-4 text-xs text-slate-700">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-2">
            <p className="font-bold text-slate-900">Di Tab 2. Penyambung PC Dapodik:</p>
            <ol className="space-y-1.5 list-decimal list-inside">
              <li>
                Tempel <strong>Token</strong> WebService Dapodik pada kolom yang tersedia.
              </li>
              <li>
                Biarkan alamat default <code className="font-mono">http://localhost:5774/WebService</code> jika e-Rapor dibuka di komputer yang sama dengan Dapodik (atau ganti ke IP LAN komputer server Dapodik).
              </li>
              <li>
                Klik tombol biru <strong>1. Unduh Penyambung (.bat)</strong>.
              </li>
            </ol>
          </div>

          <div className="flex items-start gap-2.5 rounded-lg border border-emerald-200 bg-emerald-50/70 p-3 text-emerald-900">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" aria-hidden="true" />
            <span>
              Skrip berjalan memakai <code className="font-mono">TcpListener</code> PowerShell bawaan Windows sehingga <strong>tidak membutuhkan hak Administrator</strong> dan hanya memanggil <code className="font-mono">GET</code> ke Dapodik.
            </span>
          </div>

          {onDownloadBat && (
            <button
              type="button"
              onClick={onDownloadBat}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-800 cursor-pointer"
            >
              <Download className="h-4 w-4" aria-hidden="true" />
              <span>Unduh Sambung-Dapodik-{npsn}.bat Sekarang</span>
            </button>
          )}
        </div>
      ),
    },
    {
      title: 'Jalankan Bridge Lokal di PC Dapodik (Port 5775)',
      subtitle: 'Klik ganda file .bat hingga muncul jendela status siap.',
      badge: 'Langkah 3 / 4',
      renderBody: () => (
        <div className="space-y-4">
          {/* Mock Terminal Preview */}
          <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900 text-slate-100">
            <div className="flex items-center gap-2 border-b border-slate-800 bg-slate-950 px-3.5 py-2 text-[11px] font-mono text-slate-400">
              <Terminal className="h-3.5 w-3.5 text-emerald-400" aria-hidden="true" />
              <span>Penyambung Otomatis e-Rapor Dapodik</span>
            </div>
            <div className="p-3.5 font-mono text-[11px] leading-relaxed space-y-1">
              <p className="text-cyan-300">
                Sekolah : {schoolName} (NPSN {npsn})
              </p>
              <p className="text-slate-300">
                Relay   : http://127.0.0.1:5775 (Tanpa hak Admin, anti-CORS)
              </p>
              <p className="text-emerald-400">
                [SIAP] Relay lokal berjalan di http://127.0.0.1:5775
              </p>
              <p className="text-emerald-300">
                [OK] Dapodik terbaca! File cadangan disimpan di Desktop: Data-Dapodik-{npsn}.json
              </p>
              <p className="text-slate-300">
                Biarkan jendela ini terbuka agar browser e-Rapor dapat menarik data real-time...
              </p>
            </div>
          </div>

          <div className="flex items-start gap-2.5 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" aria-hidden="true" />
            <div>
              <p className="font-bold">Jika Muncul Peringatan Windows SmartScreen:</p>
              <p className="mt-0.5">
                Klik tulisan <strong>More info</strong> lalu klik tombol <strong>Run anyway</strong>. Jangan tutup jendela hitam tersebut selama proses penarikan data berlangsung.
              </p>
            </div>
          </div>
        </div>
      ),
    },
    {
      title: 'Tarik Data dari Browser & Cadangan Desktop',
      subtitle: 'Browser menarik langsung dari 127.0.0.1:5775 ke sesi terautentikasi Anda.',
      badge: 'Langkah 4 / 4',
      renderBody: () => (
        <div className="space-y-4 text-xs text-slate-700">
          <ol className="space-y-2 list-decimal list-inside">
            <li>
              Pastikan jendela Bridge Lokal sudah menampilkan status{' '}
              <code className="rounded bg-slate-100 px-1 py-0.5 font-mono text-emerald-700">
                [SIAP] Relay lokal berjalan di http://127.0.0.1:5775
              </code>.
            </li>
            <li>
              Kembali ke browser ini (di tab <strong>2. Penyambung PC Dapodik</strong>), klik tombol hijau{' '}
              <strong>2. Tarik dari Penyambung Lokal (127.0.0.1:5775)</strong>.
            </li>
            <li>
              <strong>Alternatif Tanpa Tunggu:</strong> File <code className="font-mono">Data-Dapodik-{npsn}.json</code> yang otomatis dibuat di <strong>Desktop</strong> juga bisa langsung diunggah lewat Tab 1 kapan saja!
            </li>
          </ol>

          {onJumpToMethod && (
            <button
              type="button"
              onClick={() => {
                onJumpToMethod('local_relay');
                onClose();
              }}
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-700 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-800 cursor-pointer"
            >
              <Laptop className="h-4 w-4" aria-hidden="true" />
              <span>Buka Tab Penyambung PC Dapodik</span>
            </button>
          )}
        </div>
      ),
    },
  ];

  const guruSteps: StepItem[] = [
    {
      title: 'Guru Kelas: Input Nilai Sumatif & Capaian TP',
      subtitle: 'Menu Input Nilai & TP — nilai akhir & deskripsi terhitung otomatis.',
      badge: 'Guru Mapel / Kelas',
      renderBody: () => (
        <div className="space-y-3 text-xs text-slate-700 leading-relaxed">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-2">
            <p className="font-bold text-slate-900">Langkah di Menu "Input Nilai &amp; TP":</p>
            <ol className="space-y-1.5 list-decimal list-inside">
              <li>
                Pilih <strong>Rombongan Belajar (Dapodik)</strong> dan <strong>Mata Pelajaran</strong>.
              </li>
              <li>
                Ketik nilai pada kolom <strong>Sumatif Lingkup (S1, S2, S3)</strong> dan <strong>SAS</strong>.
              </li>
              <li>
                <strong>Nilai Akhir</strong> (60% rata-rata lingkup + 40% SAS), <strong>Predikat</strong>, dan <strong>Deskripsi Rapor</strong> langsung terhitung serta tersimpan terenkripsi otomatis — tetap aman walau internet terputus.
              </li>
              <li>
                Klik <strong>Detail &amp; TP</strong> pada nama siswa bila ingin mencentang Tujuan Pembelajaran yang dicapai atau menyunting deskripsi khusus.
              </li>
            </ol>
          </div>
        </div>
      ),
    },
    {
      title: 'Wali Kelas: Absensi, Ekskul, P5 & Catatan Wali',
      subtitle: 'Menu Wali Kelas & P5 — melengkapi bagian non-akademik rapor.',
      badge: 'Wali Kelas',
      renderBody: () => (
        <div className="space-y-3 text-xs text-slate-700 leading-relaxed">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-2">
            <p className="font-bold text-slate-900">Langkah di Menu "Wali Kelas &amp; P5":</p>
            <ol className="space-y-1.5 list-decimal list-inside">
              <li>
                Pilih <strong>Rombel</strong> dan nama <strong>Peserta Didik</strong>.
              </li>
              <li>
                Isi rekap ketidakhadiran (<strong>Sakit / Izin / Tanpa Keterangan</strong>), kegiatan <strong>Ekstrakurikuler</strong>, serta capaian proyek <strong>Kokurikuler P5</strong>.
              </li>
              <li>
                Tulis <strong>Catatan Wali Kelas</strong> dan tentukan status kenaikan/kelulusan, lalu klik <strong>Simpan</strong>.
              </li>
            </ol>
          </div>
        </div>
      ),
    },
    {
      title: 'Operator: Unduh Leger & Kirim ke Dapodik Sekolah',
      subtitle: 'Menu Rapor & Kepsek — cetak rapor A4 dan salurkan nilai ke e-Rapor/Dapodik.',
      badge: 'Operator Sekolah',
      renderBody: () => (
        <div className="space-y-3 text-xs text-slate-700 leading-relaxed">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-2">
            <p className="font-bold text-slate-900">Langkah Penyaluran Nilai ke Dapodik:</p>
            <ol className="space-y-1.5 list-decimal list-inside">
              <li>
                Buka menu <strong>Rapor &amp; Kepsek &rarr; Leger Nilai Rombel</strong>, pilih kelas, lalu klik{' '}
                <strong>Unduh Leger CSV (Excel)</strong>.
              </li>
              <li>
                Masukkan rekap nilai dari file Leger tersebut ke aplikasi <strong>e-Rapor Resmi Kemdikdasmen</strong> di jaringan sekolah (karena NISN/NIPD/Rombel sudah identik dengan Dapodik).
              </li>
              <li>
                Pada e-Rapor Kemdikdasmen klik <strong>Kirim Nilai ke Dapodik</strong>, lalu di aplikasi <strong>Dapodik Operator</strong> lakukan <strong>Validasi &amp; Sinkronisasi</strong>.
              </li>
            </ol>
          </div>

          <div className="flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50/70 p-3 text-blue-900">
            <Lock className="mt-0.5 h-4 w-4 shrink-0 text-blue-700" aria-hidden="true" />
            <span>
              <strong>Mengapa tidak langsung menulis ke Dapodik?</strong> WebService Dapodik Kemdikdasmen (<code className="font-mono">5774</code>) memang dikunci <em>Read-Only</em> (<code className="font-mono">GET</code>) oleh Kemdikdasmen agar database pokok Dapodik sekolah tidak pernah rusak.
            </span>
          </div>
        </div>
      ),
    },
  ];

  const currentSteps =
    activeTrack === 'excel'
      ? excelSteps
      : activeTrack === 'bridge'
        ? bridgeSteps
        : guruSteps;

  const safeStepIndex = Math.min(stepIndex, currentSteps.length - 1);
  const currentStep = currentSteps[safeStepIndex];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-3 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="panduan-sinkronisasi-title"
      onClick={onClose}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <header className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4 sm:px-6">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
              <BookOpen className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <h2 id="panduan-sinkronisasi-title" className="text-base font-bold text-slate-900">
                Panduan Sinkronisasi Dapodik &amp; Input Nilai
              </h2>
              <p className="mt-0.5 text-xs text-slate-500">
                {schoolName} (NPSN <span className="font-mono font-semibold text-slate-700">{npsn}</span>) · Ikuti langkah visual di bawah sesuai peran Anda.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup panduan sinkronisasi"
            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800 cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        {/* Track Switcher Tabs */}
        <div
          className="grid grid-cols-1 gap-1.5 border-b border-slate-200 bg-slate-50 px-5 py-3 sm:grid-cols-3 sm:px-6"
          role="tablist"
          aria-label="Pilih topik panduan"
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeTrack === 'excel'}
            onClick={() => handleSelectTrack('excel')}
            className={`flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold transition-colors cursor-pointer ${
              activeTrack === 'excel'
                ? 'bg-white text-blue-700 shadow-xs border border-slate-200'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <FileSpreadsheet className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span>Unggah File Excel</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTrack === 'bridge'}
            onClick={() => handleSelectTrack('bridge')}
            className={`flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold transition-colors cursor-pointer ${
              activeTrack === 'bridge'
                ? 'bg-white text-blue-700 shadow-xs border border-slate-200'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Laptop className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span>Bridge Lokal (127.0.0.1:5775)</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTrack === 'guru'}
            onClick={() => handleSelectTrack('guru')}
            className={`flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold transition-colors cursor-pointer ${
              activeTrack === 'guru'
                ? 'bg-white text-blue-700 shadow-xs border border-slate-200'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <GraduationCap className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span>Alur Guru &amp; Operator</span>
          </button>
        </div>

        {/* Scrollable Modal Body */}
        <div className="flex-1 overflow-y-auto px-5 py-5 sm:px-6 space-y-5">
          {/* Interactive Step Progress Pills */}
          <nav
            aria-label="Tahapan panduan"
            className={`grid grid-cols-1 gap-2 ${
              currentSteps.length === 4 ? 'sm:grid-cols-4' : 'sm:grid-cols-3'
            }`}
          >
            {currentSteps.map((step, idx) => {
              const active = idx === safeStepIndex;
              const done = idx < safeStepIndex;
              return (
                <button
                  key={step.title}
                  type="button"
                  onClick={() => setStepIndex(idx)}
                  className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-xs transition-colors cursor-pointer ${
                    active
                      ? 'border-blue-600 bg-blue-50/80 text-blue-900'
                      : done
                        ? 'border-emerald-200 bg-emerald-50/50 text-emerald-900'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <span
                    className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full font-mono text-[11px] font-bold ${
                      active
                        ? 'bg-blue-700 text-white'
                        : done
                          ? 'bg-emerald-600 text-white'
                          : 'bg-slate-200 text-slate-700'
                    }`}
                  >
                    {done ? '✓' : idx + 1}
                  </span>
                  <span className="truncate font-semibold">{step.title}</span>
                </button>
              );
            })}
          </nav>

          {/* Active Step Card */}
          <section className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5 space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-2 border-b border-slate-100 pb-3">
              <div>
                <span className="inline-block rounded bg-slate-100 px-2 py-0.5 font-mono text-[11px] font-semibold text-slate-700">
                  {currentStep.badge} · Langkah {safeStepIndex + 1} dari {currentSteps.length}
                </span>
                <h3 className="mt-1.5 text-sm font-bold text-slate-900">
                  {currentStep.title}
                </h3>
                <p className="mt-0.5 text-xs text-slate-500">{currentStep.subtitle}</p>
              </div>
            </div>

            {currentStep.renderBody()}
          </section>
        </div>

        {/* Footer Navigation */}
        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-slate-50 px-5 py-3.5 sm:px-6">
          <div className="text-[11px] text-slate-500">
            Langkah {safeStepIndex + 1} / {currentSteps.length} · Read-Only Terverifikasi
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={safeStepIndex === 0}
              onClick={() => setStepIndex((i) => Math.max(0, i - 1))}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-40 cursor-pointer"
            >
              <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Sebelumnya</span>
            </button>

            {safeStepIndex < currentSteps.length - 1 ? (
              <button
                type="button"
                onClick={() =>
                  setStepIndex((i) => Math.min(currentSteps.length - 1, i + 1))
                }
                className="inline-flex items-center gap-1 rounded-lg bg-blue-700 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-blue-800 cursor-pointer"
              >
                <span>Langkah Berikutnya</span>
                <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            ) : (
              <button
                type="button"
                onClick={onClose}
                className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-emerald-800 cursor-pointer"
              >
                <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Selesai Membaca</span>
              </button>
            )}
          </div>
        </footer>
      </div>
    </div>
  );
};
