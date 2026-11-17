import React, { useMemo, useState } from 'react';
import {
  BrainCircuit,
  Download,
  FileSpreadsheet,
  Printer,
  ShieldAlert,
} from 'lucide-react';
import { buildEraporExportPackageXlsxBytes } from '../lib/dapodikExcel';
import {
  computeDeepLearningReadiness,
  computeLegerRombel,
  computePrincipalMetrics,
  formatKokurikulerCapaianLabel,
  safeParseJsonResponse,
  type EraporDataset,
} from '../lib/eraporCore';

interface ReportsPrincipalViewProps {
  dataset: EraporDataset;
  isOnline: boolean;
  initialRombelId?: string;
  directPrintBanner?: string | null;
  onDismissDirectPrintBanner?: () => void;
}

type ReportSubTab = 'rapor' | 'leger' | 'principal';

export const ReportsPrincipalView: React.FC<ReportsPrincipalViewProps> = ({
  dataset,
  isOnline,
  initialRombelId,
  directPrintBanner,
  onDismissDirectPrintBanner,
}) => {
  const [subTab, setSubTab] = useState<ReportSubTab>('rapor');
  const [selectedRombelId, setSelectedRombelId] = useState(
    initialRombelId || dataset.rombels[2]?.id || dataset.rombels[0]?.id || ''
  );

  const studentsInRombel = useMemo(
    () =>
      dataset.students
        .filter((s) => s.rombelId === selectedRombelId && s.statusAktif === 'Aktif')
        .sort((a, b) => a.nama.localeCompare(b.nama, 'id')),
    [dataset.students, selectedRombelId]
  );

  const [selectedStudentId, setSelectedStudentId] = useState(
    studentsInRombel[0]?.id || ''
  );

  const activeStudent =
    studentsInRombel.find((s) => s.id === selectedStudentId) || studentsInRombel[0];
  const activeRombel = dataset.rombels.find((r) => r.id === selectedRombelId);

  const leger = useMemo(
    () => computeLegerRombel(dataset, selectedRombelId),
    [dataset, selectedRombelId]
  );

  const principalMetrics = useMemo(() => computePrincipalMetrics(dataset), [dataset]);
  const deepReadiness = useMemo(() => computeDeepLearningReadiness(dataset), [dataset]);

  // Deep AI / Offline Principal Diagnostic State
  const [aiQuestion, setAiQuestion] = useState(
    'Susun ringkasan eksekutif Kepala Sekolah mengenai kesiapan rapor tiap rombel, implementasi Pembelajaran Mendalam 2026 (tahap Memahami-Mengaplikasi-Merefleksi, 8 Dimensi Profil Lulusan, dan kesiapan KKA), serta langkah intervensi guru minggu ini.'
  );
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState<string | null>(null);
  const [aiMeta, setAiMeta] = useState<string | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [showCoverAndIdentity, setShowCoverAndIdentity] = useState(false);

  const handleExportLegerCsv = () => {
    const header = [
      'No',
      'NISN',
      'NIPD',
      'Nama Peserta Didik',
      ...leger.subjects.map((s) => s.kode),
      'Total',
      'Rata-rata',
      'Sakit',
      'Izin',
      'Alpa',
      'Keputusan',
    ];
    const lines = [header.join(',')];
    leger.rows.forEach((row, idx) => {
      const cells = [
        idx + 1,
        `"${row.student.nisn}"`,
        `"${row.student.nipd}"`,
        `"${row.student.nama}"`,
        ...leger.subjects.map((s) => row.scoresBySubject[s.id]?.nilai ?? ''),
        row.totalNilai,
        row.rataRata,
        row.sakit,
        row.izin,
        row.tanpaKeterangan,
        `"${row.keputusan}"`,
      ];
      lines.push(cells.join(','));
    });

    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Leger-${activeRombel?.nama || 'Rombel'}-${dataset.school.semesterId}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleExportExcelPackage = () => {
    const pkg = buildEraporExportPackageXlsxBytes(dataset, selectedRombelId);
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

  const generateDeterministicOfflineReport = () => {
    const lowestRombel = [...principalMetrics.rombelProgress].sort(
      (a, b) => a.completionPct - b.completionPct
    )[0];
    const lowestMapel = [...principalMetrics.subjectStats].sort(
      (a, b) => a.tuntasPct - b.tuntasPct
    )[0];

    const lines = [
      `RINGKASAN EKSEKUTIF OTOMATIS — ${dataset.school.namaSekolah} (Semester ${dataset.school.semesterLabel})`,
      `Kurikulum: ${dataset.school.kurikulum}`,
      '',
      `1. Kesiapan Administrasi Rapor: Total ${principalMetrics.overallCompletionPct}% nilai dari ${principalMetrics.totalStudents} peserta didik (${principalMetrics.totalRombels} rombel) telah terisi. Rombel yang paling perlu percepatan input adalah ${lowestRombel?.rombelNama ?? '-'} (${lowestRombel?.completionPct ?? 0}%, Wali: ${lowestRombel?.waliKelas ?? '-'}).`,
      `2. Capaian Akademik Sekolah: Rata-rata nilai keseluruhan mencapai ${principalMetrics.schoolAverageScore.toFixed(1)}. Mata pelajaran dengan tingkat ketuntasan terendah saat ini adalah ${lowestMapel?.subjectName ?? '-'} (${lowestMapel?.tuntasPct ?? 0}% tuntas terhadap KKTP ${lowestMapel?.kkm ?? 75}).`,
      `3. Kesiapan Pembelajaran Mendalam 2026 (Permendikdasmen No. 10 & 13/2025):`,
      `   - Pemetaan TP Mendalam: ${deepReadiness.deepTpCount}/${deepReadiness.totalTp} TP (${deepReadiness.tpCoveragePct}%) — Memahami: ${deepReadiness.byLevel.Memahami}, Mengaplikasi: ${deepReadiness.byLevel.Mengaplikasi}, Merefleksi: ${deepReadiness.byLevel.Merefleksi}.`,
      `   - Mata Pelajaran Pilihan Koding & Kecerdasan Artifisial (KKA): ${deepReadiness.kkaActive ? 'Sudah Aktif' : 'Belum Diaktifkan (dapat diaktifkan 1 klik di menu Mapel, Guru & TP)'}.`,
      `   - Kokurikuler Lintas Mapel & 8 Dimensi Profil Lulusan: ${deepReadiness.kokurikuler2026Students}/${deepReadiness.totalWaliStudents} peserta didik telah memiliki catatan perkembangan (Berkembang/Cakap/Mahir).`,
      `4. Prioritas Intervensi Guru (${principalMetrics.interventionList.length} entri di bawah KKTP):`,
      ...principalMetrics.interventionList
        .slice(0, 5)
        .map(
          (it) =>
            `   - ${it.studentName} (${it.rombelName}) pada ${it.subjectName}: nilai ${it.nilai} (KKTP ${it.kkm}).`
        ),
      '',
      'Rekomendasi Tindak Lanjut: Instruksikan wali kelas dan guru mapel terkait untuk menjadwalkan pembelajaran remedial berbasis pengalaman belajar Memahami-Mengaplikasi-Merefleksi sebelum finalisasi cetak rapor.',
    ];
    setAiResult(lines.join('\n'));
    setAiMeta('Laporan Otomatis Lokal (Tersedia 100% Offline)');
    setAiError(null);
  };

  const handleRunAiAnalysis = async () => {
    if (!isOnline) {
      generateDeterministicOfflineReport();
      return;
    }
    setAiLoading(true);
    setAiError(null);
    try {
      const res = await fetch('/api/ai/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: aiQuestion,
          rombelId: selectedRombelId,
        }),
      });
      const data = await safeParseJsonResponse<{
        ok?: boolean;
        analysis?: string;
        model?: string;
        thinkingLevel?: string;
        error?: string;
      }>(res, 'api');
      if (!res.ok || !data.ok) {
        setAiError(data.error || 'Gagal menjalankan analisis Gemini.');
        return;
      }
      setAiResult(data.analysis || '');
      setAiMeta(`Model ${data.model} · ThinkingLevel ${data.thinkingLevel}`);
    } catch (err) {
      setAiError(err instanceof Error ? err.message : 'Koneksi server gagal.');
    } finally {
      setAiLoading(false);
    }
  };

  const studentGrades = activeStudent
    ? dataset.subjects.map((sub) => {
        const grade = dataset.grades.find(
          (g) => g.studentId === activeStudent.id && g.mapelId === sub.id
        );
        return { subject: sub, grade };
      })
    : [];

  const studentWali = activeStudent
    ? dataset.waliRecords.find((w) => w.studentId === activeStudent.id)
    : undefined;

  return (
    <div className="space-y-6">
      {/* Header & Sub-Tabs (hidden on print) */}
      <div className="no-print flex flex-col gap-4 border-b border-slate-200 pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">
            Laporan Otomatis, Cetak Rapor & Dasbor Kepala Sekolah
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Rapor resmi Kemdikdasmen, leger nilai kolektif, serta analitik kesiapan rapor sekolah secara real-time.
          </p>
        </div>

        <div
          className="inline-flex rounded-lg border border-slate-200 bg-slate-100 p-1"
          role="tablist"
          aria-label="Jenis laporan otomatis"
        >
          <button
            type="button"
            role="tab"
            aria-selected={subTab === 'rapor'}
            onClick={() => setSubTab('rapor')}
            className={`rounded-md px-3 py-1.5 text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer ${
              subTab === 'rapor' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
            }`}
          >
            Pratinjau & Cetak Rapor
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={subTab === 'leger'}
            onClick={() => setSubTab('leger')}
            className={`rounded-md px-3 py-1.5 text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer ${
              subTab === 'leger' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
            }`}
          >
            Leger Nilai Rombel
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={subTab === 'principal'}
            onClick={() => setSubTab('principal')}
            className={`rounded-md px-3 py-1.5 text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer ${
              subTab === 'principal' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
            }`}
          >
            Analitik Kepala Sekolah
          </button>
        </div>
      </div>

      {/* TAB 1: Official Rapor Preview & Print */}
      {subTab === 'rapor' && (
        <div className="space-y-4">
          {directPrintBanner && (
            <div
              role="status"
              className="no-print flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs text-emerald-950"
            >
              <div>
                <p className="font-bold">Mode Cetak Langsung Operator Aktif</p>
                <p className="mt-0.5 text-emerald-900">{directPrintBanner}</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 px-3.5 py-2 text-xs font-semibold text-white hover:bg-emerald-800 cursor-pointer"
                >
                  <Printer className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Print Rapor Sekarang</span>
                </button>
                {onDismissDirectPrintBanner && (
                  <button
                    type="button"
                    onClick={onDismissDirectPrintBanner}
                    className="rounded-lg border border-emerald-300 bg-white px-3 py-2 text-xs font-semibold text-emerald-800 hover:bg-emerald-100 cursor-pointer"
                  >
                    Tutup
                  </button>
                )}
              </div>
            </div>
          )}

          <div className="no-print flex flex-wrap items-end justify-between gap-4 rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex flex-wrap gap-4">
              <div>
                <label htmlFor="rapor-rombel" className="block text-xs font-semibold text-slate-700">
                  Rombel
                </label>
                <select
                  id="rapor-rombel"
                  value={selectedRombelId}
                  onChange={(e) => {
                    const nextId = e.target.value;
                    setSelectedRombelId(nextId);
                    const first = dataset.students.find((s) => s.rombelId === nextId);
                    if (first) setSelectedStudentId(first.id);
                  }}
                  className="mt-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-900"
                >
                  {dataset.rombels.map((rb) => (
                    <option key={rb.id} value={rb.id}>
                      {rb.nama}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="rapor-student" className="block text-xs font-semibold text-slate-700">
                  Peserta Didik
                </label>
                <select
                  id="rapor-student"
                  value={activeStudent?.id || ''}
                  onChange={(e) => setSelectedStudentId(e.target.value)}
                  className="mt-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-900"
                >
                  {studentsInRombel.map((st) => (
                    <option key={st.id} value={st.id}>
                      {st.nama} ({st.nisn})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <label className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showCoverAndIdentity}
                  onChange={(e) => setShowCoverAndIdentity(e.target.checked)}
                />
                <span>Sampul &amp; Identitas Rapor</span>
              </label>

              <button
                type="button"
                onClick={() => window.print()}
                className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-800 cursor-pointer"
              >
                <Printer className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Cetak / Simpan PDF Rapor</span>
              </button>
            </div>
          </div>

          {!activeStudent ? (
            <div className="rounded-xl border border-slate-200 bg-white px-6 py-10 text-center text-xs text-slate-500">
              Belum ada peserta didik untuk dicetak pada rombel ini. Tarik data siswa dari Dapodik sekolah di menu{' '}
              <strong className="text-slate-700">Referensi Dapodik</strong>.
            </div>
          ) : (
            <div className="space-y-6">
              {showCoverAndIdentity && (
                <section
                  aria-label="Sampul dan Identitas Peserta Didik Rapor"
                  className="print-only-full print:break-after-page mx-auto max-w-4xl rounded-xl border border-slate-200 bg-white p-8 text-slate-900 space-y-8"
                >
                  <div className="border-2 border-slate-800 rounded-lg p-8 text-center space-y-5">
                    <p className="text-xs font-bold tracking-widest uppercase text-slate-600">
                      Kementerian Pendidikan Dasar dan Menengah Republik Indonesia
                    </p>
                    <div className="space-y-1">
                      <h2 className="text-2xl font-extrabold tracking-tight text-slate-900">
                        RAPOR PESERTA DIDIK
                      </h2>
                      <p className="text-sm font-semibold text-slate-700">
                        {dataset.school.kurikulum} · Jenjang {dataset.school.jenjang}
                      </p>
                    </div>

                    <div className="mx-auto max-w-md rounded-lg border border-slate-300 bg-slate-50 px-5 py-4">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                        Nama Peserta Didik
                      </p>
                      <p className="mt-1 text-base font-bold text-slate-900">
                        {activeStudent.nama}
                      </p>
                      <p className="mt-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                        NISN / NIPD
                      </p>
                      <p className="mt-0.5 font-mono text-sm font-bold text-slate-900">
                        {activeStudent.nisn} / {activeStudent.nipd}
                      </p>
                    </div>

                    <div className="pt-2 text-xs text-slate-700">
                      <p className="text-sm font-bold text-slate-900">
                        {dataset.school.namaSekolah}
                      </p>
                      <p className="mt-1">
                        NPSN {dataset.school.npsn} · {dataset.school.alamat}
                      </p>
                      <p>
                        {dataset.school.kecamatan}, {dataset.school.kabupaten}, {dataset.school.provinsi}
                      </p>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wide text-slate-900 border-b border-slate-300 pb-2">
                      Keterangan Tentang Diri Peserta Didik
                    </h3>
                    <div className="mt-3 grid grid-cols-1 gap-x-8 gap-y-2 text-xs sm:grid-cols-2">
                      <div className="flex justify-between border-b border-slate-100 py-1">
                        <span className="text-slate-600">Nama Lengkap</span>
                        <span className="font-bold text-slate-900">{activeStudent.nama}</span>
                      </div>
                      <div className="flex justify-between border-b border-slate-100 py-1">
                        <span className="text-slate-600">NISN / NIPD</span>
                        <span className="font-mono font-semibold">{activeStudent.nisn} / {activeStudent.nipd}</span>
                      </div>
                      <div className="flex justify-between border-b border-slate-100 py-1">
                        <span className="text-slate-600">Tempat, Tanggal Lahir</span>
                        <span className="font-medium text-slate-900">
                          {activeStudent.tempatLahir || '-'}, {activeStudent.tanggalLahir || '-'}
                        </span>
                      </div>
                      <div className="flex justify-between border-b border-slate-100 py-1">
                        <span className="text-slate-600">Jenis Kelamin</span>
                        <span className="font-medium text-slate-900">
                          {activeStudent.jenisKelamin === 'P' ? 'Perempuan' : 'Laki-laki'}
                        </span>
                      </div>
                      <div className="flex justify-between border-b border-slate-100 py-1">
                        <span className="text-slate-600">Agama</span>
                        <span className="font-medium text-slate-900">{activeStudent.agama || '-'}</span>
                      </div>
                      <div className="flex justify-between border-b border-slate-100 py-1">
                        <span className="text-slate-600">Nama Orang Tua / Wali</span>
                        <span className="font-medium text-slate-900">{activeStudent.namaOrangTua || '-'}</span>
                      </div>
                      <div className="flex justify-between border-b border-slate-100 py-1 sm:col-span-2">
                        <span className="text-slate-600">Alamat Peserta Didik</span>
                        <span className="font-medium text-slate-900">{activeStudent.alamat || '-'}</span>
                      </div>
                    </div>
                  </div>
                </section>
              )}

              <article className="print-only-full mx-auto max-w-4xl rounded-xl border border-slate-200 bg-white p-8 text-slate-900">
                <header className="border-b-2 border-slate-900 pb-4 text-center">
                  <p className="text-xs font-bold tracking-wide text-slate-700">
                    LAPORAN HASIL BELAJAR (RAPOR) · {dataset.school.kurikulum.toUpperCase()}
                  </p>
                  <h2 className="mt-1 text-lg font-bold text-slate-900">
                    {dataset.school.namaSekolah}
                  </h2>
                  <p className="text-xs text-slate-600">
                    NPSN {dataset.school.npsn} · {dataset.school.alamat}, {dataset.school.kabupaten}, {dataset.school.provinsi}
                  </p>
                </header>

                {/* Student Identity Block */}
                <div className="mt-5 grid grid-cols-1 gap-x-8 gap-y-1.5 text-xs sm:grid-cols-2">
                  <div className="flex justify-between border-b border-slate-100 py-1">
                    <span className="text-slate-600">Nama Peserta Didik</span>
                    <span className="font-bold text-slate-900">{activeStudent.nama}</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-100 py-1">
                    <span className="text-slate-600">Kelas / Fase</span>
                    <span className="font-semibold text-slate-900">
                      {activeRombel?.nama} ({activeRombel?.fase})
                    </span>
                  </div>
                  <div className="flex justify-between border-b border-slate-100 py-1">
                    <span className="text-slate-600">NISN / NIPD</span>
                    <span className="font-mono tabular-nums font-semibold">
                      {activeStudent.nisn} / {activeStudent.nipd}
                    </span>
                  </div>
                  <div className="flex justify-between border-b border-slate-100 py-1">
                    <span className="text-slate-600">Tahun Ajaran / Semester</span>
                    <span className="font-semibold">{dataset.school.semesterLabel}</span>
                  </div>
                </div>

                {/* A. Intrakurikuler Grades Table */}
                <div className="mt-6">
                  <h3 className="text-xs font-bold text-slate-900">A. Nilai Intrakurikuler</h3>
                  <table className="mt-2 w-full border-collapse border border-slate-300 text-xs">
                    <thead>
                      <tr className="bg-slate-100">
                        <th className="border border-slate-300 px-2 py-2 text-center w-9">No</th>
                        <th className="border border-slate-300 px-3 py-2 text-left">Mata Pelajaran</th>
                        <th className="border border-slate-300 px-2 py-2 text-center w-14">KKTP</th>
                        <th className="border border-slate-300 px-2 py-2 text-center w-16">Nilai</th>
                        <th className="border border-slate-300 px-2 py-2 text-center w-16">Predikat</th>
                        <th className="border border-slate-300 px-3 py-2 text-left">
                          Capaian Kompetensi
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {studentGrades.map(({ subject, grade }, idx) => (
                        <tr key={subject.id}>
                          <td className="border border-slate-300 px-2 py-2 text-center font-mono tabular-nums">
                            {idx + 1}
                          </td>
                          <td className="border border-slate-300 px-3 py-2 font-medium">
                            {subject.nama}
                          </td>
                          <td className="border border-slate-300 px-2 py-2 text-center font-mono tabular-nums text-slate-600">
                            {subject.kkm}
                          </td>
                          <td className="border border-slate-300 px-2 py-2 text-center font-mono font-bold tabular-nums">
                            {grade && grade.nilaiAkhir > 0 ? grade.nilaiAkhir : '—'}
                          </td>
                          <td className="border border-slate-300 px-2 py-2 text-center font-mono font-semibold">
                            {grade && grade.nilaiAkhir > 0 ? grade.predikat : '—'}
                          </td>
                          <td className="border border-slate-300 px-3 py-2 leading-relaxed text-slate-700">
                            {grade?.deskripsiCapaian || 'Belum ada deskripsi capaian.'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* B. Capaian Kokurikuler & 8 Dimensi Profil Lulusan (2026) */}
                <div className="mt-6">
                  <h3 className="text-xs font-bold text-slate-900">
                    B. Kokurikuler &amp; 8 Dimensi Profil Lulusan (Permendikdasmen 10 &amp; 13/2025)
                  </h3>
                  <table className="mt-2 w-full border-collapse border border-slate-300 text-xs">
                    <thead>
                      <tr className="bg-slate-100">
                        <th className="border border-slate-300 px-2.5 py-1.5 text-left">
                          Tema, Bentuk &amp; 8 Dimensi Profil
                        </th>
                        <th className="border border-slate-300 px-2.5 py-1.5 text-center w-28">Capaian</th>
                        <th className="border border-slate-300 px-2.5 py-1.5 text-left">
                          Deskripsi &amp; Refleksi Positif
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {(studentWali?.kokurikulerP5 ?? []).length === 0 ? (
                        <tr>
                          <td colSpan={3} className="border border-slate-300 px-2.5 py-2 text-slate-500">
                            Belum ada kegiatan kokurikuler 8 Dimensi yang dicatat pada semester ini.
                          </td>
                        </tr>
                      ) : (
                        studentWali?.kokurikulerP5.map((p5, idx) => (
                          <tr key={idx}>
                            <td className="border border-slate-300 px-2.5 py-2">
                              <p className="font-semibold text-slate-900">{p5.tema}</p>
                              <p className="mt-0.5 text-[11px] text-slate-600">
                                {p5.bentukKegiatan || 'Lintas Disiplin Ilmu'} ·{' '}
                                {p5.dimensiList && p5.dimensiList.length > 0
                                  ? p5.dimensiList.join(', ')
                                  : p5.dimensi}
                              </p>
                              {p5.prinsipDeepLearning && p5.prinsipDeepLearning.length > 0 && (
                                <p className="mt-0.5 text-[10px] text-slate-500">
                                  Prinsip: {p5.prinsipDeepLearning.join(', ')}
                                </p>
                              )}
                            </td>
                            <td className="border border-slate-300 px-2.5 py-2 text-center font-semibold text-slate-900">
                              {formatKokurikulerCapaianLabel(p5.capaian)}
                            </td>
                            <td className="border border-slate-300 px-2.5 py-2 text-slate-700 leading-relaxed">
                              {p5.catatan}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {/* C & D. Ekskul & Ketidakhadiran */}
                <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2">
                  <div>
                    <h3 className="text-xs font-bold text-slate-900">C. Ekstrakurikuler</h3>
                    <table className="mt-2 w-full border-collapse border border-slate-300 text-xs">
                      <thead>
                        <tr className="bg-slate-100">
                          <th className="border border-slate-300 px-2.5 py-1.5 text-left">Kegiatan</th>
                          <th className="border border-slate-300 px-2.5 py-1.5 text-center">Predikat</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(studentWali?.ekstrakurikuler ?? []).length === 0 ? (
                          <tr>
                            <td colSpan={2} className="border border-slate-300 px-2.5 py-2 text-slate-500">
                              Belum tercatat.
                            </td>
                          </tr>
                        ) : (
                          studentWali?.ekstrakurikuler.map((eks, idx) => (
                            <tr key={idx}>
                              <td className="border border-slate-300 px-2.5 py-1.5 font-medium">
                                {eks.nama}
                              </td>
                              <td className="border border-slate-300 px-2.5 py-1.5 text-center">
                                {eks.predikat}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>

                  <div>
                    <h3 className="text-xs font-bold text-slate-900">D. Ketidakhadiran</h3>
                    <table className="mt-2 w-full border-collapse border border-slate-300 text-xs">
                      <tbody>
                        <tr>
                          <td className="border border-slate-300 px-3 py-1.5">Sakit</td>
                          <td className="border border-slate-300 px-3 py-1.5 text-right font-mono tabular-nums">
                            {studentWali?.sakit ?? 0} hari
                          </td>
                        </tr>
                        <tr>
                          <td className="border border-slate-300 px-3 py-1.5">Izin</td>
                          <td className="border border-slate-300 px-3 py-1.5 text-right font-mono tabular-nums">
                            {studentWali?.izin ?? 0} hari
                          </td>
                        </tr>
                        <tr>
                          <td className="border border-slate-300 px-3 py-1.5">Tanpa Keterangan</td>
                          <td className="border border-slate-300 px-3 py-1.5 text-right font-mono tabular-nums">
                            {studentWali?.tanpaKeterangan ?? 0} hari
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="mt-5 rounded-lg border border-slate-300 p-3 text-xs space-y-1.5">
                  <p className="font-bold text-slate-900">E. Catatan Wali Kelas &amp; Keputusan</p>
                  <p className="text-slate-700 leading-relaxed">
                    {studentWali?.catatanWali ||
                      'Pertahankan prestasi dan kedisiplinan belajar pada semester mendatang.'}
                  </p>
                  <p className="text-[11px] font-semibold text-slate-800 pt-1">
                    Keputusan: <span className="font-bold">{studentWali?.keputusanNaik || 'Proses'}</span>
                  </p>
                </div>

                {/* Signatures */}
                <footer className="mt-8 grid grid-cols-3 gap-6 text-center text-xs">
                  <div>
                    <p>Mengetahui,</p>
                    <p>Orang Tua / Wali</p>
                    <div className="h-14" />
                    <p className="font-bold underline">{activeStudent.namaOrangTua}</p>
                  </div>
                  <div>
                    <p>Mengetahui,</p>
                    <p>Kepala Sekolah</p>
                    <div className="h-14" />
                    <p className="font-bold underline">{dataset.school.kepalaSekolah}</p>
                    <p className="font-mono text-[11px] text-slate-600">
                      NIP {dataset.school.nipKepalaSekolah}
                    </p>
                  </div>
                  <div>
                    <p>{dataset.school.kabupaten}, Desember 2026</p>
                    <p>Wali Kelas {activeRombel?.nama}</p>
                    <div className="h-14" />
                    <p className="font-bold underline">{activeRombel?.waliKelasNama}</p>
                    <p className="font-mono text-[11px] text-slate-600">
                      NIP {activeRombel?.waliKelasNip}
                    </p>
                  </div>
                </footer>
              </article>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: Leger Nilai Rombel */}
      {subTab === 'leger' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex items-center gap-3">
              <label htmlFor="leger-rombel-select" className="text-xs font-semibold text-slate-700">
                Rombel:
              </label>
              <select
                id="leger-rombel-select"
                value={selectedRombelId}
                onChange={(e) => setSelectedRombelId(e.target.value)}
                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-900"
              >
                {dataset.rombels.map((rb) => (
                  <option key={rb.id} value={rb.id}>
                    {rb.nama}
                  </option>
                ))}
              </select>
              <span className="text-xs text-slate-500">
                Kelengkapan: <strong className="font-mono text-slate-900">{leger.completionRate}%</strong>
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleExportExcelPackage}
                className="inline-flex items-center gap-2 rounded-lg bg-emerald-700 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-800 cursor-pointer"
              >
                <FileSpreadsheet className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Unduh Paket Nilai Excel (.xlsx)</span>
              </button>
              <button
                type="button"
                onClick={handleExportLegerCsv}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50 cursor-pointer"
              >
                <Download className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Unduh Leger CSV</span>
              </button>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-slate-700">
                    <th className="px-4 py-3 font-semibold">Nama Peserta Didik</th>
                    {leger.subjects.map((sub) => (
                      <th key={sub.id} className="px-2.5 py-3 text-right font-mono font-semibold">
                        {sub.kode}
                      </th>
                    ))}
                    <th className="px-3 py-3 text-right font-semibold">Rata-rata</th>
                    <th className="px-3 py-3 text-center font-semibold">S/I/A</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {leger.rows.map((row) => (
                    <tr key={row.student.id} className="hover:bg-slate-50/70">
                      <td className="px-4 py-2.5 font-semibold text-slate-900 whitespace-nowrap">
                        {row.student.nama}
                      </td>
                      {leger.subjects.map((sub) => {
                        const cell = row.scoresBySubject[sub.id];
                        const isLow = cell && cell.nilai < sub.kkm;
                        return (
                          <td
                            key={sub.id}
                            className={`px-2.5 py-2.5 text-right font-mono tabular-nums ${
                              isLow ? 'font-bold text-red-700' : 'text-slate-800'
                            }`}
                          >
                            {cell ? cell.nilai : '—'}
                          </td>
                        );
                      })}
                      <td className="px-3 py-2.5 text-right font-mono font-bold tabular-nums text-blue-800">
                        {row.rataRata > 0 ? row.rataRata.toFixed(1) : '—'}
                      </td>
                      <td className="px-3 py-2.5 text-center font-mono tabular-nums text-slate-600">
                        {row.sakit}/{row.izin}/{row.tanpaKeterangan}
                      </td>
                    </tr>
                  ))}
                  <tr className="bg-slate-50 font-semibold text-slate-900">
                    <td className="px-4 py-3">Rata-Rata Kelas</td>
                    {leger.subjects.map((sub) => (
                      <td key={sub.id} className="px-2.5 py-3 text-right font-mono tabular-nums">
                        {leger.subjectAverages[sub.id] > 0
                          ? leger.subjectAverages[sub.id].toFixed(1)
                          : '—'}
                      </td>
                    ))}
                    <td colSpan={2} className="px-3 py-3" />
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: Principal Analytics & Deep Thinking Analysis */}
      {subTab === 'principal' && (
        <div className="space-y-6">
          <section
            aria-label="Kesiapan Pembelajaran Mendalam 2026"
            className="rounded-xl border border-slate-200 bg-white p-6"
          >
            <div className="flex flex-col gap-1 border-b border-slate-200 pb-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-sm font-bold text-slate-900">
                  Kesiapan Pembelajaran Mendalam 2026 (Permendikdasmen 10 &amp; 13/2025)
                </h2>
                <p className="mt-0.5 text-xs text-slate-500">
                  Pemetaan taksonomi belajar mendalam, 8 Dimensi Profil Lulusan, dan mata pelajaran pilihan KKA.
                </p>
              </div>
              <span className="text-xs font-medium text-slate-600 whitespace-nowrap shrink-0">
                {dataset.school.kurikulum}
              </span>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <p className="text-[11px] font-medium text-slate-500">TP Berbasis Mendalam</p>
                <p className="mt-1 font-mono text-2xl font-bold tabular-nums text-slate-900">
                  {deepReadiness.deepTpCount}/{deepReadiness.totalTp}
                </p>
                <p className="mt-0.5 font-mono text-xs tabular-nums text-blue-700">
                  {deepReadiness.tpCoveragePct}% terpetakan
                </p>
              </div>

              <div>
                <p className="text-[11px] font-medium text-slate-500">Sebaran Pengalaman Belajar</p>
                <p className="mt-1 font-mono text-sm font-bold tabular-nums text-slate-900">
                  {deepReadiness.byLevel.Memahami} / {deepReadiness.byLevel.Mengaplikasi} /{' '}
                  {deepReadiness.byLevel.Merefleksi}
                </p>
                <p className="mt-1 text-xs text-slate-600">
                  Memahami · Mengaplikasi · Merefleksi
                </p>
              </div>

              <div>
                <p className="text-[11px] font-medium text-slate-500">
                  Mapel Pilihan KKA (2026)
                </p>
                <p
                  className={`mt-1 text-xl font-bold ${
                    deepReadiness.kkaActive ? 'text-emerald-700' : 'text-amber-700'
                  }`}
                >
                  {deepReadiness.kkaActive ? 'Aktif' : 'Belum Diaktifkan'}
                </p>
                <p className="mt-0.5 text-xs text-slate-600">
                  Koding &amp; Kecerdasan Artifisial
                </p>
              </div>

              <div>
                <p className="text-[11px] font-medium text-slate-500">
                  Kokurikuler 8 Dimensi
                </p>
                <p className="mt-1 font-mono text-2xl font-bold tabular-nums text-slate-900">
                  {deepReadiness.kokurikuler2026Students}/{deepReadiness.totalWaliStudents}
                </p>
                <p className="mt-0.5 text-xs text-slate-600">
                  Siswa dengan alur Mahir/Cakap/Berkembang
                </p>
              </div>
            </div>
          </section>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Subject Mastery Breakdown */}
            <section className="rounded-xl border border-slate-200 bg-white p-6">
              <h2 className="text-sm font-bold text-slate-900">
                Rekap Ketuntasan Mata Pelajaran
              </h2>
              <div className="mt-4 space-y-3">
                {principalMetrics.subjectStats.map((stat) => (
                  <div key={stat.subjectId} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-800">{stat.subjectName}</span>
                      <span className="font-mono tabular-nums text-slate-600">
                        Rata {stat.averageScore.toFixed(1)} · Tuntas {stat.tuntasPct}%
                      </span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                      <div
                        className={`h-full ${
                          stat.tuntasPct >= 80 ? 'bg-emerald-600' : 'bg-amber-600'
                        }`}
                        style={{ width: `${stat.tuntasPct}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Students Requiring KKTP Intervention */}
            <section className="rounded-xl border border-slate-200 bg-white p-6">
              <h2 className="text-sm font-bold text-slate-900">
                Daftar Siswa Prioritas Remedial (Di Bawah KKTP)
              </h2>
              {principalMetrics.interventionList.length === 0 ? (
                <p className="mt-4 text-xs text-emerald-700">
                  Seluruh nilai yang sudah masuk telah memenuhi KKTP.
                </p>
              ) : (
                <div className="mt-4 divide-y divide-slate-200 max-h-64 overflow-y-auto">
                  {principalMetrics.interventionList.map((item, idx) => (
                    <div
                      key={`${item.studentId}-${item.subjectName}-${idx}`}
                      className="flex items-center justify-between py-2.5 text-xs"
                    >
                      <div>
                        <p className="font-semibold text-slate-900">{item.studentName}</p>
                        <p className="text-slate-500">
                          {item.rombelName} · {item.subjectName}
                        </p>
                      </div>
                      <span className="font-mono font-bold tabular-nums text-red-700">
                        {item.nilai} / {item.kkm}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>

          {/* Deep Thinking Executive Analysis */}
          <section className="rounded-xl border border-slate-200 bg-white p-6">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2">
                <BrainCircuit className="h-4 w-4 text-blue-700" aria-hidden="true" />
                <h2 className="text-sm font-bold text-slate-900">
                  Asisten Analisis Eksekutif Kepala Sekolah
                </h2>
              </div>
              <span className="text-xs text-slate-500">
                Analisis Pedagogis Mendalam · Dukungan Ringkasan Offline
              </span>
            </div>

            <div className="mt-4 space-y-3">
              <label htmlFor="principal-ai-prompt" className="block text-xs font-semibold text-slate-700">
                Pertanyaan atau Fokus Evaluasi Sekolah
              </label>
              <textarea
                id="principal-ai-prompt"
                rows={2}
                value={aiQuestion}
                onChange={(e) => setAiQuestion(e.target.value)}
                className="w-full rounded-lg border border-slate-300 p-3 text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
              />
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  disabled={aiLoading}
                  onClick={() => void handleRunAiAnalysis()}
                  className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-800 disabled:opacity-50 cursor-pointer"
                >
                  <BrainCircuit className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>
                    {aiLoading
                      ? 'Menganalisis Mendalam...'
                      : 'Jalankan Analisis Kepala Sekolah'}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={generateDeterministicOfflineReport}
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50 cursor-pointer"
                >
                  <Download className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Buat Ringkasan Otomatis (Offline)</span>
                </button>
              </div>
            </div>

            {aiError && (
              <div className="mt-4 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" aria-hidden="true" />
                <div>
                  <p className="font-semibold">{aiError}</p>
                  <p className="mt-1">
                    Anda tetap dapat menekan tombol <strong>Buat Ringkasan Otomatis (Offline)</strong> untuk laporan langsung tanpa koneksi AI.
                  </p>
                </div>
              </div>
            )}

            {aiResult && (
              <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
                {aiMeta && (
                  <p className="mb-2 text-[11px] font-semibold text-blue-700">{aiMeta}</p>
                )}
                <pre className="whitespace-pre-wrap font-sans text-xs leading-relaxed text-slate-800">
                  {aiResult}
                </pre>
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
};
