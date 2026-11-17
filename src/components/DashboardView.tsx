import React, { useState } from 'react';
import {
  ArrowRight,
  BookOpenCheck,
  CheckCircle2,
  Database,
  Download,
  FileCheck2,
  Inbox,
  Lock,
  Printer,
  RefreshCw,
  Send,
  ShieldCheck,
  Users,
  WifiOff,
} from 'lucide-react';
import { buildEraporExportPackageXlsxBytes } from '../lib/dapodikExcel';
import {
  buildDapodikNilaiCsvExport,
  computeDeepLearningReadiness,
  computePrincipalMetrics,
  type AuthUserAccount,
  type EraporDataset,
  type UserRole,
} from '../lib/eraporCore';
import { RombelGradeChartCard } from './RombelGradeChartCard';

export type NavTabId =
  | 'dashboard'
  | 'schools'
  | 'dapodik'
  | 'curriculum'
  | 'grades'
  | 'wali'
  | 'reports'
  | 'security';

interface DashboardViewProps {
  dataset: EraporDataset;
  role: UserRole;
  authUser: AuthUserAccount;
  onRoleChange: (role: UserRole) => void;
  onNavigate: (tab: NavTabId, rombelId?: string) => void;
  onTriggerDapodikSync: () => void;
  onSubmitToOperator: (rombelId: string, notes?: string) => Promise<void>;
  onOperatorAction: (params: {
    submissionId?: string;
    rombelId?: string;
    action: 'sync_dapodik' | 'print_rapor';
  }) => Promise<void>;
  isSyncingDapodik: boolean;
  isOnline: boolean;
  pendingOutboxCount: number;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  dataset,
  role,
  authUser,
  onRoleChange,
  onNavigate,
  onTriggerDapodikSync,
  onSubmitToOperator,
  onOperatorAction,
  isSyncingDapodik,
  isOnline,
  pendingOutboxCount,
}) => {
  const metrics = computePrincipalMetrics(dataset);
  const deepReadiness = computeDeepLearningReadiness(dataset);
  const [guruRombelId, setGuruRombelId] = useState(
    authUser.assignedRombelId || dataset.rombels[2]?.id || dataset.rombels[0]?.id || ''
  );
  const [guruNotes, setGuruNotes] = useState('');
  const [isSubmittingGuru, setIsSubmittingGuru] = useState(false);
  const [processingSubKey, setProcessingSubKey] = useState<string | null>(null);

  const submissions = dataset.submissions ?? [];

  const handleDownloadDapodikNilaiCsv = (rombelId?: string) => {
    const pkg = buildDapodikNilaiCsvExport(dataset, rombelId);
    const blob = new Blob([pkg.csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = pkg.filename;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadDapodikNilaiXlsx = (rombelId?: string) => {
    const pkg = buildEraporExportPackageXlsxBytes(dataset, rombelId);
    const blob = new Blob([pkg.bytes], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = pkg.filename;
    link.click();
    URL.revokeObjectURL(url);
  };

  const lastSyncFormatted = new Date(dataset.school.lastSyncAt).toLocaleString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div className="space-y-8">
      {/* Header & Role Context Switcher */}
      <section className="flex flex-col gap-4 border-b border-slate-200 pb-6 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-semibold text-blue-700">
            Referensi Mutlak Dapodik · {dataset.school.dapodikVersion} · Read-Only Terverifikasi
          </p>
          <h1 className="mt-1.5 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            {dataset.school.namaSekolah}
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            NPSN <span className="font-mono tabular-nums font-medium text-slate-900">{dataset.school.npsn}</span>
            <span aria-hidden="true"> · </span>
            {dataset.school.kecamatan}, {dataset.school.kabupaten}
            <span aria-hidden="true"> · </span>
            Semester {dataset.school.semesterLabel}
            <span aria-hidden="true"> · </span>
            {dataset.school.kurikulum}
          </p>
          <p className="mt-1 text-xs text-slate-500 font-mono tabular-nums">
            TP Mendalam: {deepReadiness.deepTpCount}/{deepReadiness.totalTp} ({deepReadiness.tpCoveragePct}%) ·
            KKA 2026: {deepReadiness.kkaActive ? 'Aktif' : 'Belum Diaktifkan'} ·
            Kokurikuler 8 Dimensi: {deepReadiness.kokurikuler2026Students}/{deepReadiness.totalWaliStudents} siswa
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {authUser.role === 'operator' ? (
            <>
              <div
                className="inline-flex rounded-lg border border-slate-200 bg-slate-100 p-1"
                role="group"
                aria-label="Pilih sudut pandang operator atau kepala sekolah"
              >
                <button
                  type="button"
                  onClick={() => onRoleChange('operator')}
                  className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    role === 'operator'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Operator Dapodik
                </button>
                <button
                  type="button"
                  onClick={() => onRoleChange('kepala_sekolah')}
                  className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    role === 'kepala_sekolah'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Monitoring Kepsek
                </button>
              </div>

              <button
                type="button"
                onClick={onTriggerDapodikSync}
                disabled={isSyncingDapodik || !isOnline}
                className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-blue-800 disabled:opacity-50 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <RefreshCw
                  className={`h-3.5 w-3.5 ${isSyncingDapodik ? 'animate-spin' : ''}`}
                  aria-hidden="true"
                />
                <span>{isSyncingDapodik ? 'Menarik Data...' : 'Tarik Referensi Dapodik'}</span>
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => onNavigate('grades', guruRombelId)}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-blue-800 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <BookOpenCheck className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Mulai Input Nilai &amp; TP</span>
            </button>
          )}
        </div>
      </section>

      {/* 4-Column Key Metric Strip */}
      <section
        aria-label="Ringkasan statistik e-Rapor"
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"
      >
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>Peserta Didik Aktif (Dapodik)</span>
            <Users className="h-4 w-4 text-slate-400" aria-hidden="true" />
          </div>
          <p className="mt-2 font-mono text-3xl font-bold tabular-nums text-slate-900">
            {metrics.totalStudents}
          </p>
          <p className="mt-1 text-xs text-slate-600">
            Tersebar di {metrics.totalRombels} rombongan belajar resmi
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>Kesiapan Nilai Rapor</span>
            <BookOpenCheck className="h-4 w-4 text-slate-400" aria-hidden="true" />
          </div>
          <p className="mt-2 font-mono text-3xl font-bold tabular-nums text-slate-900">
            {metrics.overallCompletionPct}%
          </p>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full bg-blue-700 transition-all"
              style={{ width: `${metrics.overallCompletionPct}%` }}
            />
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>Rata-Rata Capaian Sekolah</span>
            <FileCheck2 className="h-4 w-4 text-slate-400" aria-hidden="true" />
          </div>
          <p className="mt-2 font-mono text-3xl font-bold tabular-nums text-slate-900">
            {metrics.schoolAverageScore.toFixed(1)}
          </p>
          <p className="mt-1 text-xs text-slate-600">
            {metrics.studentsBelowKkmCount > 0
              ? `${metrics.studentsBelowKkmCount} siswa perlu penguatan KKTP`
              : 'Seluruh siswa mencapai ketuntasan KKTP'}
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>Keamanan & Sinkron Offline</span>
            {isOnline ? (
              <ShieldCheck className="h-4 w-4 text-emerald-600" aria-hidden="true" />
            ) : (
              <WifiOff className="h-4 w-4 text-amber-600" aria-hidden="true" />
            )}
          </div>
          <p className="mt-2 flex items-center gap-2 text-lg font-bold text-slate-900">
            {pendingOutboxCount > 0 ? (
              <span className="font-mono tabular-nums text-amber-700">
                {pendingOutboxCount} Antrean Offline
              </span>
            ) : (
              <span className="text-emerald-700">Tersinkronisasi Penuh</span>
            )}
          </p>
          <p className="mt-1 text-xs text-slate-600">
            Enkripsi AES-256-GCM · Sinkron: {lastSyncFormatted}
          </p>
        </div>
      </section>

      {/* Recharts Per-Rombel Grade Distribution & Statistics */}
      <RombelGradeChartCard
        dataset={dataset}
        defaultRombelId={authUser.assignedRombelId || dataset.rombels[2]?.id}
        onOpenGrades={(rombelId) => onNavigate('grades', rombelId)}
      />

      {/* Role-Specific Workflow Focal Panel */}
      {authUser.role === 'guru' ? (
        <section
          aria-label="Kirim data guru ke akun operator"
          className="rounded-xl border border-slate-200 bg-white p-6"
        >
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <p className="text-xs font-semibold text-blue-700">
                Alur Akun Guru: Input Nilai → Simpan → Kirim ke Akun Operator
              </p>
              <h2 className="mt-1 text-base font-bold text-slate-900">
                Kirim Data Rombel ke Akun Operator Sekolah
              </h2>
              <p className="mt-1 text-xs leading-relaxed text-slate-600">
                Setelah nilai sumatif, TP, absensi, dan catatan Kokurikuler 8 Dimensi disimpan, kirimkan rombel ke kotak masuk Operator agar Operator dapat menyinkronkannya ke Dapodik atau langsung mencetak rapor resmi.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                onClick={() => onNavigate('grades', guruRombelId)}
                className="rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50 whitespace-nowrap cursor-pointer"
              >
                Input Nilai &amp; TP
              </button>
              <button
                type="button"
                onClick={() => onNavigate('wali')}
                className="rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50 whitespace-nowrap cursor-pointer"
              >
                Wali &amp; Kokurikuler
              </button>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-3 border-t border-slate-200 pt-5 sm:grid-cols-12 sm:items-end">
            <div className="sm:col-span-4">
              <label htmlFor="guru-submit-rombel" className="block text-xs font-semibold text-slate-700">
                Pilih Rombel untuk Dikirim
              </label>
              <select
                id="guru-submit-rombel"
                value={guruRombelId}
                onChange={(e) => setGuruRombelId(e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-900"
              >
                {dataset.rombels.map((rb) => (
                  <option key={rb.id} value={rb.id}>
                    {rb.nama} · Wali: {rb.waliKelasNama}
                  </option>
                ))}
              </select>
            </div>

            <div className="sm:col-span-5">
              <label htmlFor="guru-submit-note" className="block text-xs font-semibold text-slate-700">
                Catatan untuk Operator (Opsional)
              </label>
              <input
                id="guru-submit-note"
                type="text"
                value={guruNotes}
                onChange={(e) => setGuruNotes(e.target.value)}
                placeholder="Contoh: Seluruh nilai mapel & P5 sudah diperiksa, siap diproses."
                className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none"
              />
            </div>

            <div className="sm:col-span-3">
              <button
                type="button"
                disabled={isSubmittingGuru || !isOnline || !guruRombelId}
                onClick={async () => {
                  setIsSubmittingGuru(true);
                  try {
                    await onSubmitToOperator(
                      guruRombelId,
                      guruNotes || 'Data nilai & catatan wali selesai diinput dan dikirim Guru.'
                    );
                    setGuruNotes('');
                  } finally {
                    setIsSubmittingGuru(false);
                  }
                }}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-700 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-800 disabled:opacity-50 whitespace-nowrap cursor-pointer"
              >
                <Send className="h-3.5 w-3.5" aria-hidden="true" />
                <span>{isSubmittingGuru ? 'Mengirim...' : 'Simpan & Kirim ke Operator'}</span>
              </button>
            </div>
          </div>

          {submissions.length > 0 && (
            <div className="mt-5 border-t border-slate-200 pt-4">
              <p className="text-xs font-semibold text-slate-700">
                Riwayat Pengiriman Data ke Akun Operator
              </p>
              <div className="mt-2.5 divide-y divide-slate-200 rounded-lg border border-slate-200">
                {submissions.map((sub) => (
                  <div
                    key={sub.id}
                    className="flex flex-col gap-2 px-4 py-3 text-xs sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <p className="font-semibold text-slate-900">
                        {sub.rombelNama} ·{' '}
                        <span className="font-mono tabular-nums text-slate-600">
                          {sub.gradesCount} nilai / {sub.completionPct}% lengkap
                        </span>
                      </p>
                      <p className="mt-0.5 text-slate-500">
                        Dikirim oleh {sub.submittedBy} ·{' '}
                        {new Date(sub.submittedAt).toLocaleString('id-ID')}
                        {sub.notes ? ` · "${sub.notes}"` : ''}
                      </p>
                    </div>
                    <span
                      className={`font-semibold whitespace-nowrap ${
                        sub.status === 'tersinkron_dapodik'
                          ? 'text-emerald-700'
                          : sub.status === 'dicetak_rapor'
                            ? 'text-blue-700'
                            : 'text-amber-700'
                      }`}
                    >
                      {sub.status === 'tersinkron_dapodik'
                        ? 'Sudah Disinkronkan ke Dapodik'
                        : sub.status === 'dicetak_rapor'
                          ? 'Sudah Diproses Print Rapor'
                          : 'Masuk di Akun Operator (Menunggu Aksi)'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      ) : (
        <section
          aria-label="Kotak Masuk Data Guru dan Pilihan Operator"
          className="rounded-xl border border-slate-200 bg-white p-6"
        >
          <div className="flex flex-col gap-3 border-b border-slate-200 pb-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-2 text-xs font-semibold text-blue-700">
                <Inbox className="h-4 w-4" aria-hidden="true" />
                <span>Kotak Masuk Data Guru · Panel Keputusan Operator</span>
              </div>
              <h2 className="mt-1 text-base font-bold text-slate-900">
                Data Nilai dari Guru — Pilih Tindak Lanjut Operator
              </h2>
              <p className="mt-0.5 text-xs text-slate-600">
                Setiap rombel yang dikirim Guru memiliki dua pilihan tindakan langsung:{' '}
                <strong className="text-slate-900">1. Sinkronkan ke Dapodik</strong> atau{' '}
                <strong className="text-slate-900">2. Langsung Print Rapor</strong>.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => handleDownloadDapodikNilaiXlsx()}
                className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 px-3.5 py-2 text-xs font-semibold text-white hover:bg-emerald-800 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Download className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Unduh Paket Excel (.xlsx)</span>
              </button>
              <button
                type="button"
                onClick={() => handleDownloadDapodikNilaiCsv()}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Download className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Unduh Paket Nilai (.csv)</span>
              </button>
            </div>
          </div>

          {submissions.length === 0 ? (
            <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-5 text-xs text-slate-600">
              <p className="font-semibold text-slate-800">
                Belum ada kiriman baru dari tombol &ldquo;Simpan &amp; Kirim ke Operator&rdquo;.
              </p>
              <p className="mt-1">
                Anda tetap dapat memproses data nilai rombel yang sudah tersimpan oleh Guru melalui tabel daftar rombel di bawah atau klik salah satu rombel berikut:
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {metrics.rombelProgress.slice(0, 4).map((rb) => (
                  <div
                    key={rb.rombelId}
                    className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2"
                  >
                    <span className="font-semibold text-slate-900">
                      {rb.rombelNama} ({rb.completionPct}%)
                    </span>
                    <button
                      type="button"
                      disabled={processingSubKey === `${rb.rombelId}-sync`}
                      onClick={async () => {
                        setProcessingSubKey(`${rb.rombelId}-sync`);
                        try {
                          await onOperatorAction({ rombelId: rb.rombelId, action: 'sync_dapodik' });
                        } finally {
                          setProcessingSubKey(null);
                        }
                      }}
                      className="rounded-md bg-blue-700 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-blue-800 cursor-pointer"
                    >
                      Sinkronkan ke Dapodik
                    </button>
                    <button
                      type="button"
                      disabled={processingSubKey === `${rb.rombelId}-print`}
                      onClick={async () => {
                        setProcessingSubKey(`${rb.rombelId}-print`);
                        try {
                          await onOperatorAction({ rombelId: rb.rombelId, action: 'print_rapor' });
                        } finally {
                          setProcessingSubKey(null);
                        }
                      }}
                      className="rounded-md border border-slate-300 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-800 hover:bg-slate-50 cursor-pointer"
                    >
                      Langsung Print Rapor
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="mt-4 divide-y divide-slate-200 rounded-lg border border-slate-200">
              {submissions.map((sub) => (
                <div
                  key={sub.id}
                  className="flex flex-col gap-4 p-4 lg:flex-row lg:items-center lg:justify-between"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span className="text-sm font-bold text-slate-900">{sub.rombelNama}</span>
                      <span aria-hidden="true" className="text-slate-300">·</span>
                      <span className="font-mono tabular-nums text-slate-700">
                        {sub.gradesCount} nilai · {sub.waliCount} catatan wali · {sub.completionPct}% lengkap
                      </span>
                      <span aria-hidden="true" className="text-slate-300">·</span>
                      <span
                        className={`font-semibold ${
                          sub.status === 'tersinkron_dapodik'
                            ? 'text-emerald-700'
                            : sub.status === 'dicetak_rapor'
                              ? 'text-blue-700'
                              : 'text-amber-700'
                        }`}
                      >
                        {sub.status === 'tersinkron_dapodik'
                          ? 'Tersinkron ke Dapodik'
                          : sub.status === 'dicetak_rapor'
                            ? 'Siap / Sudah Dicetak Rapor'
                            : 'Masuk ke Operator (Menunggu Pilihan)'}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-slate-500">
                      Dikirim oleh <strong className="text-slate-700">{sub.submittedBy}</strong> pada{' '}
                      {new Date(sub.submittedAt).toLocaleString('id-ID')}
                      {sub.notes ? ` — "${sub.notes}"` : ''}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                    <button
                      type="button"
                      disabled={processingSubKey === `${sub.id}-sync` || !isOnline}
                      onClick={async () => {
                        setProcessingSubKey(`${sub.id}-sync`);
                        try {
                          await onOperatorAction({
                            submissionId: sub.id,
                            rombelId: sub.rombelId,
                            action: 'sync_dapodik',
                          });
                        } finally {
                          setProcessingSubKey(null);
                        }
                      }}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-blue-700 px-3.5 py-2 text-xs font-semibold text-white hover:bg-blue-800 disabled:opacity-50 whitespace-nowrap cursor-pointer"
                    >
                      <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>
                        {processingSubKey === `${sub.id}-sync`
                          ? 'Menyinkronkan...'
                          : '1. Sinkronkan ke Dapodik'}
                      </span>
                    </button>

                    <button
                      type="button"
                      disabled={processingSubKey === `${sub.id}-print`}
                      onClick={async () => {
                        setProcessingSubKey(`${sub.id}-print`);
                        try {
                          await onOperatorAction({
                            submissionId: sub.id,
                            rombelId: sub.rombelId,
                            action: 'print_rapor',
                          });
                        } finally {
                          setProcessingSubKey(null);
                        }
                      }}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-900 hover:bg-slate-50 disabled:opacity-50 whitespace-nowrap cursor-pointer"
                    >
                      <Printer className="h-3.5 w-3.5 text-emerald-700" aria-hidden="true" />
                      <span>2. Langsung Print Rapor</span>
                    </button>

                    {sub.status === 'tersinkron_dapodik' && (
                      <button
                        type="button"
                        onClick={() => handleDownloadDapodikNilaiCsv(sub.rombelId)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800 hover:bg-emerald-100 whitespace-nowrap cursor-pointer"
                      >
                        <Download className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>Unduh CSV Dapodik</span>
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Main Split: Rombel Progress Table + Quick Actions / Security Guarantee */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Rombel Matrix (2 columns wide) */}
        <section className="lg:col-span-2 rounded-xl border border-slate-200 bg-white">
          <div className="flex flex-col gap-2 border-b border-slate-200 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900">
                {role === 'kepala_sekolah'
                  ? 'Monitoring Progres Rapor per Rombel'
                  : 'Daftar Rombel Terhubung Dapodik'}
              </h2>
              <p className="text-xs text-slate-500">
                Susunan kelas dan wali kelas mengikuti data Dapodik secara mutlak.
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('reports')}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-700 hover:text-blue-800 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <span>Buka Leger & Laporan</span>
              <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-semibold text-slate-600">
                  <th className="px-6 py-3">Rombel</th>
                  <th className="px-4 py-3">Wali Kelas</th>
                  <th className="px-4 py-3 text-right">Siswa</th>
                  <th className="px-4 py-3 text-right">Input Nilai</th>
                  <th className="px-4 py-3 text-right">Rata-rata</th>
                  <th className="px-6 py-3 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {metrics.rombelProgress.map((item) => (
                  <tr key={item.rombelId} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-6 py-3.5 font-semibold text-slate-900 whitespace-nowrap">
                      {item.rombelNama}
                    </td>
                    <td className="px-4 py-3.5 text-slate-600">{item.waliKelas}</td>
                    <td className="px-4 py-3.5 text-right font-mono tabular-nums text-slate-700">
                      {item.studentCount}
                    </td>
                    <td className="px-4 py-3.5 text-right font-mono tabular-nums">
                      <span
                        className={
                          item.completionPct === 100
                            ? 'font-semibold text-emerald-700'
                            : 'font-semibold text-slate-800'
                        }
                      >
                        {item.completionPct}%
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-right font-mono tabular-nums text-slate-800">
                      {item.averageScore > 0 ? item.averageScore.toFixed(1) : '—'}
                    </td>
                    <td className="px-6 py-3.5 text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => onNavigate('grades', item.rombelId)}
                        className="text-xs font-semibold text-blue-700 hover:text-blue-900 hover:underline cursor-pointer"
                      >
                        Kelola Nilai
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Right Panel: Workflow & Integrity Overview */}
        <aside className="space-y-4">
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <h2 className="text-sm font-bold text-slate-900">Alur Kerja Cepat</h2>
            <p className="mt-1 text-xs text-slate-500">
              Dirancang ringkas seperti e-Rapor Pak Pasek agar guru langsung fokus mengajar.
            </p>
            <div className="mt-4 space-y-2.5">
              <button
                type="button"
                onClick={() => onNavigate('grades')}
                className="flex w-full items-center justify-between rounded-lg border border-slate-200 px-3.5 py-2.5 text-left text-xs font-semibold text-slate-800 hover:bg-slate-50 cursor-pointer"
              >
                <span>1. Input Nilai Sumatif & TP</span>
                <ArrowRight className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => onNavigate('wali')}
                className="flex w-full items-center justify-between rounded-lg border border-slate-200 px-3.5 py-2.5 text-left text-xs font-semibold text-slate-800 hover:bg-slate-50 cursor-pointer"
              >
                <span>2. Absensi, Kokurikuler 8 Dimensi &amp; Wali</span>
                <ArrowRight className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => onNavigate('reports')}
                className="flex w-full items-center justify-between rounded-lg border border-slate-200 px-3.5 py-2.5 text-left text-xs font-semibold text-slate-800 hover:bg-slate-50 cursor-pointer"
              >
                <span>3. Cetak Rapor & Leger Otomatis</span>
                <ArrowRight className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
              </button>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="flex items-center gap-2 text-xs font-bold text-emerald-700">
              <Lock className="h-4 w-4" aria-hidden="true" />
              <span>Jaminan Read-Only Dapodik & Enkripsi</span>
            </div>
            <ul className="mt-3 space-y-2 text-xs text-slate-600">
              <li className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" aria-hidden="true" />
                <span>
                  Koneksi ke Dapodik hanya memakai metode <code className="font-mono text-slate-800">GET</code> sehingga database Dapodik sekolah tidak pernah tersentuh atau berubah.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <Database className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" aria-hidden="true" />
                <span>
                  Checksum referensi: <code className="font-mono text-slate-800">{dataset.school.checksumSha256.slice(0, 12)}...</code>
                </span>
              </li>
            </ul>
            <button
              type="button"
              onClick={() => onNavigate('dapodik')}
              className="mt-3 text-xs font-semibold text-blue-700 hover:underline cursor-pointer"
            >
              Periksa Konfigurasi Dapodik &rarr;
            </button>
          </div>
        </aside>
      </div>
    </div>
  );
};
