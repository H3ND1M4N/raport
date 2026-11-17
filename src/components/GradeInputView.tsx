import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  CheckCircle2,
  Clock,
  Download,
  FileSpreadsheet,
  Send,
  SlidersHorizontal,
  Sparkles,
  Upload,
  Wand2,
  X,
} from 'lucide-react';
import {
  buildSubjectGradeTemplateXlsxBytes,
  parseSubjectGradeSpreadsheetBuffer,
} from '../lib/dapodikExcel';
import {
  calculateNilaiAkhir,
  clampScore,
  computePredikat,
  generateAutoDeskripsi,
  validateKktpValue,
  type EraporDataset,
  type StudentGradeRecord,
} from '../lib/eraporCore';

interface GradeInputViewProps {
  dataset: EraporDataset;
  initialRombelId?: string;
  onSaveGrade: (record: StudentGradeRecord) => Promise<void>;
  onSaveGradesBatch?: (records: StudentGradeRecord[]) => Promise<void>;
  onUpdateSubjectsKktp: (
    updates: Array<{ mapelId: string; kktp: number }>
  ) => Promise<{ recalculatedGradesCount: number }>;
  onSubmitToOperator?: (rombelId: string, notes?: string) => Promise<void>;
  isOnline: boolean;
}

export const GradeInputView: React.FC<GradeInputViewProps> = ({
  dataset,
  initialRombelId,
  onSaveGrade,
  onSaveGradesBatch,
  onUpdateSubjectsKktp,
  onSubmitToOperator,
  isOnline,
}) => {
  const [selectedRombelId, setSelectedRombelId] = useState(
    initialRombelId || dataset.rombels[2]?.id || dataset.rombels[0]?.id || ''
  );
  const [selectedMapelId, setSelectedMapelId] = useState(
    dataset.subjects[3]?.id || dataset.subjects[0]?.id || ''
  );
  const [expandedStudentId, setExpandedStudentId] = useState<string | null>(null);
  const [savingStudentId, setSavingStudentId] = useState<string | null>(null);
  const [toastText, setToastText] = useState<string | null>(null);
  const [operatorNote, setOperatorNote] = useState<string>('');
  const [isSubmittingOperator, setIsSubmittingOperator] = useState(false);

  const selectedRombel = dataset.rombels.find((r) => r.id === selectedRombelId);
  const selectedSubject = dataset.subjects.find((s) => s.id === selectedMapelId);
  const [kktpInput, setKktpInput] = useState<string>(
    String(selectedSubject?.kkm ?? 75)
  );
  const [kktpError, setKktpError] = useState<string | null>(null);
  const [savingKktp, setSavingKktp] = useState(false);
  const [showAllKktpModal, setShowAllKktpModal] = useState(false);
  const [batchKktpValues, setBatchKktpValues] = useState<Record<string, string>>({});
  const [batchKktpError, setBatchKktpError] = useState<string | null>(null);
  const [importingExcel, setImportingExcel] = useState(false);
  const gradeExcelInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (selectedSubject) {
      setKktpInput(String(selectedSubject.kkm));
      setKktpError(null);
    }
  }, [selectedSubject?.id, selectedSubject?.kkm]);

  const currentSubmission = (dataset.submissions ?? []).find(
    (s) => s.rombelId === selectedRombelId
  );

  const studentsInRombel = useMemo(
    () =>
      dataset.students
        .filter((s) => s.rombelId === selectedRombelId && s.statusAktif === 'Aktif')
        .sort((a, b) => a.nama.localeCompare(b.nama, 'id')),
    [dataset.students, selectedRombelId]
  );

  const tpListForSubject = useMemo(
    () => dataset.tujuanPembelajaran.filter((tp) => tp.mapelId === selectedMapelId),
    [dataset.tujuanPembelajaran, selectedMapelId]
  );

  const getOrInitGrade = (studentId: string): StudentGradeRecord => {
    const existing = dataset.grades.find(
      (g) => g.studentId === studentId && g.mapelId === selectedMapelId
    );
    if (existing) return existing;
    return {
      id: `grd-${studentId}-${selectedMapelId}`,
      studentId,
      mapelId: selectedMapelId,
      rombelId: selectedRombelId,
      semesterId: dataset.school.semesterId,
      sumatifLingkup: [0, 0, 0],
      sumatifAkhirSemester: null,
      tpTercapaiIds: tpListForSubject.length > 0 ? [tpListForSubject[0].id] : [],
      tpPerluBimbinganIds: [],
      nilaiAkhir: 0,
      predikat: 'D',
      deskripsiCapaian: '',
      customDeskripsi: false,
      updatedAt: new Date().toISOString(),
      updatedBy: selectedSubject?.guruPengampu || 'Guru Mapel',
      syncStatus: 'synced',
    };
  };

  const handleScoreChange = async (
    studentId: string,
    studentName: string,
    lingkupIndex: number | 'sas',
    rawVal: string
  ) => {
    if (!selectedSubject) return;
    const current = getOrInitGrade(studentId);
    const parsed = rawVal.trim() === '' ? null : clampScore(Number(rawVal));

    let nextLingkup = [...current.sumatifLingkup];
    while (nextLingkup.length < 3) nextLingkup.push(0);
    let nextSas = current.sumatifAkhirSemester;

    if (lingkupIndex === 'sas') {
      nextSas = parsed;
    } else {
      nextLingkup[lingkupIndex] = parsed ?? 0;
    }

    const activeLingkup = nextLingkup.filter((v) => v > 0);
    const nilaiAkhir = calculateNilaiAkhir(
      activeLingkup.length > 0 ? activeLingkup : [0],
      nextSas
    );
    const { predikat } = computePredikat(nilaiAkhir, selectedSubject.kkm);

    const deskripsiCapaian = current.customDeskripsi
      ? current.deskripsiCapaian
      : generateAutoDeskripsi({
          studentName,
          subjectName: selectedSubject.nama,
          nilaiAkhir,
          kkm: selectedSubject.kkm,
          tpList: tpListForSubject,
          tpTercapaiIds: current.tpTercapaiIds,
          tpPerluBimbinganIds: current.tpPerluBimbinganIds,
        });

    const nextRecord: StudentGradeRecord = {
      ...current,
      rombelId: selectedRombelId,
      sumatifLingkup: nextLingkup,
      sumatifAkhirSemester: nextSas,
      nilaiAkhir,
      predikat,
      deskripsiCapaian,
      updatedAt: new Date().toISOString(),
      updatedBy: selectedSubject.guruPengampu,
    };

    setSavingStudentId(studentId);
    await onSaveGrade(nextRecord);
    setSavingStudentId(null);
    setToastText(
      isOnline
        ? `Nilai ${studentName} tersimpan & tersinkron.`
        : `Nilai ${studentName} tersimpan di brankas offline (menunggu jaringan).`
    );
  };

  const handleTpToggle = async (
    studentId: string,
    studentName: string,
    tpId: string,
    kind: 'tercapai' | 'perlu'
  ) => {
    if (!selectedSubject) return;
    const current = getOrInitGrade(studentId);
    let nextTercapai = [...current.tpTercapaiIds];
    let nextPerlu = [...current.tpPerluBimbinganIds];

    if (kind === 'tercapai') {
      nextTercapai = nextTercapai.includes(tpId)
        ? nextTercapai.filter((id) => id !== tpId)
        : [...nextTercapai, tpId];
      nextPerlu = nextPerlu.filter((id) => id !== tpId);
    } else {
      nextPerlu = nextPerlu.includes(tpId)
        ? nextPerlu.filter((id) => id !== tpId)
        : [...nextPerlu, tpId];
      nextTercapai = nextTercapai.filter((id) => id !== tpId);
    }

    const deskripsiCapaian = generateAutoDeskripsi({
      studentName,
      subjectName: selectedSubject.nama,
      nilaiAkhir: current.nilaiAkhir,
      kkm: selectedSubject.kkm,
      tpList: tpListForSubject,
      tpTercapaiIds: nextTercapai,
      tpPerluBimbinganIds: nextPerlu,
    });

    await onSaveGrade({
      ...current,
      tpTercapaiIds: nextTercapai,
      tpPerluBimbinganIds: nextPerlu,
      deskripsiCapaian,
      customDeskripsi: false,
      updatedAt: new Date().toISOString(),
    });
  };

  const handleRegenerateAllDescriptions = async () => {
    if (!selectedSubject) return;
    for (const st of studentsInRombel) {
      const current = getOrInitGrade(st.id);
      if (current.nilaiAkhir > 0) {
        const desc = generateAutoDeskripsi({
          studentName: st.nama,
          subjectName: selectedSubject.nama,
          nilaiAkhir: current.nilaiAkhir,
          kkm: selectedSubject.kkm,
          tpList: tpListForSubject,
          tpTercapaiIds: current.tpTercapaiIds,
          tpPerluBimbinganIds: current.tpPerluBimbinganIds,
        });
        await onSaveGrade({
          ...current,
          deskripsiCapaian: desc,
          customDeskripsi: false,
          updatedAt: new Date().toISOString(),
        });
      }
    }
    setToastText('Deskripsi capaian kompetensi seluruh siswa berhasil disusun otomatis.');
  };

  const handleCustomDeskripsiSave = async (
    studentId: string,
    newDeskripsi: string
  ) => {
    const current = getOrInitGrade(studentId);
    await onSaveGrade({
      ...current,
      deskripsiCapaian: newDeskripsi,
      customDeskripsi: true,
      updatedAt: new Date().toISOString(),
    });
    setToastText('Deskripsi khusus siswa disimpan.');
  };

  const handleDownloadGradeTemplateXlsx = () => {
    if (!selectedRombel || !selectedSubject) return;
    const bytes = buildSubjectGradeTemplateXlsxBytes({
      school: dataset.school,
      rombel: selectedRombel,
      subject: selectedSubject,
      students: dataset.students,
      existingGrades: dataset.grades,
    });
    const blob = new Blob([bytes], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Format-Nilai-${selectedSubject.kode}-${selectedRombel.nama.replace(/[^a-zA-Z0-9]+/g, '-')}.xlsx`;
    link.click();
    URL.revokeObjectURL(url);
    setToastText(
      `Template nilai Excel ${selectedSubject.nama} (${selectedRombel.nama}) berhasil diunduh.`
    );
  };

  const handleImportGradeXlsxFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !selectedSubject) return;

    setImportingExcel(true);
    try {
      const buffer = await file.arrayBuffer();
      const parsed = parseSubjectGradeSpreadsheetBuffer(buffer, {
        students: dataset.students,
        subject: selectedSubject,
        rombelId: selectedRombelId,
        semesterId: dataset.school.semesterId,
        tpList: tpListForSubject,
        existingGrades: dataset.grades,
      });

      if (onSaveGradesBatch) {
        await onSaveGradesBatch(parsed.records);
      } else {
        for (const rec of parsed.records) {
          await onSaveGrade(rec);
        }
      }

      setToastText(
        `Impor nilai Excel selesai: ${parsed.matchedCount} nilai siswa diperbarui otomatis (${parsed.skippedCount} baris kosong/tidak cocok dilewati).`
      );
    } catch (err) {
      setToastText(
        err instanceof Error ? err.message : 'Gagal membaca file Excel nilai.'
      );
    } finally {
      setImportingExcel(false);
    }
  };

  const handleSaveSingleKktp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!selectedSubject) return;
    const check = validateKktpValue(kktpInput);
    if (!check.valid) {
      setKktpError(check.error || 'Nilai KKTP tidak valid.');
      return;
    }

    setKktpError(null);
    setSavingKktp(true);
    try {
      const { recalculatedGradesCount } = await onUpdateSubjectsKktp([
        { mapelId: selectedSubject.id, kktp: check.kktp },
      ]);
      setToastText(
        recalculatedGradesCount > 0
          ? `KKTP ${selectedSubject.nama} diubah menjadi ${check.kktp} (${recalculatedGradesCount} predikat & deskripsi siswa diperbarui otomatis).`
          : `KKTP ${selectedSubject.nama} disimpan sebagai ${check.kktp}.`
      );
    } catch (err) {
      setKktpError(
        err instanceof Error ? err.message : 'Gagal menyimpan perubahan KKTP.'
      );
    } finally {
      setSavingKktp(false);
    }
  };

  const openAllKktpModal = () => {
    const initial: Record<string, string> = {};
    for (const sub of dataset.subjects) {
      initial[sub.id] = String(sub.kkm);
    }
    setBatchKktpValues(initial);
    setBatchKktpError(null);
    setShowAllKktpModal(true);
  };

  const handleSaveAllKktp = async (e: React.FormEvent) => {
    e.preventDefault();
    const updates: Array<{ mapelId: string; kktp: number }> = [];
    for (const sub of dataset.subjects) {
      const raw = batchKktpValues[sub.id] ?? String(sub.kkm);
      const check = validateKktpValue(raw);
      if (!check.valid) {
        setBatchKktpError(`${sub.nama}: ${check.error}`);
        return;
      }
      if (check.kktp !== sub.kkm) {
        updates.push({ mapelId: sub.id, kktp: check.kktp });
      }
    }

    if (updates.length === 0) {
      setShowAllKktpModal(false);
      return;
    }

    setBatchKktpError(null);
    setSavingKktp(true);
    try {
      const { recalculatedGradesCount } = await onUpdateSubjectsKktp(updates);
      setShowAllKktpModal(false);
      setToastText(
        `KKTP untuk ${updates.length} mata pelajaran berhasil diperbarui (${recalculatedGradesCount} nilai siswa disesuaikan otomatis).`
      );
    } catch (err) {
      setBatchKktpError(
        err instanceof Error ? err.message : 'Gagal menyimpan daftar KKTP.'
      );
    } finally {
      setSavingKktp(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 border-b border-slate-200 pb-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">
            Input Nilai Sumatif & Deskripsi Otomatis
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Format ringkas satu layar: nilai akhir dan deskripsi rapor terhitung seketika, tetap aktif saat offline.
          </p>
        </div>

        <div className="flex flex-wrap lg:flex-nowrap items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() => void handleRegenerateAllDescriptions()}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Wand2 className="h-3.5 w-3.5 text-blue-700" aria-hidden="true" />
            <span>Susun Deskripsi Otomatis Kelas</span>
          </button>

          {onSubmitToOperator && selectedRombel && (
            <button
              type="button"
              disabled={isSubmittingOperator || !isOnline}
              onClick={async () => {
                setIsSubmittingOperator(true);
                try {
                  await onSubmitToOperator(
                    selectedRombel.id,
                    operatorNote || `Input nilai ${selectedSubject?.nama || ''} kelas ${selectedRombel.nama} selesai disimpan.`
                  );
                } finally {
                  setIsSubmittingOperator(false);
                }
              }}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-800 disabled:opacity-50 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Send className="h-3.5 w-3.5" aria-hidden="true" />
              <span>
                {isSubmittingOperator
                  ? 'Mengirim ke Operator...'
                  : 'Simpan & Kirim ke Akun Operator'}
              </span>
            </button>
          )}
        </div>
      </div>

      {onSubmitToOperator && selectedRombel && (
        <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold text-slate-900">
              Pengiriman Data ke Akun Operator ({selectedRombel.nama})
            </p>
            <p className="mt-0.5 text-xs text-slate-600">
              {currentSubmission
                ? currentSubmission.status === 'tersinkron_dapodik'
                  ? `Status: Sudah disinkronkan Operator ke Dapodik (${new Date(currentSubmission.operatorActionAt || currentSubmission.submittedAt).toLocaleString('id-ID')}).`
                  : currentSubmission.status === 'dicetak_rapor'
                    ? `Status: Sudah diproses cetak rapor oleh Operator (${new Date(currentSubmission.operatorActionAt || currentSubmission.submittedAt).toLocaleString('id-ID')}).`
                    : `Status: Terkirim & masuk ke Akun Operator (${new Date(currentSubmission.submittedAt).toLocaleString('id-ID')}) — menunggu sinkron Dapodik atau cetak rapor.`
                : 'Setiap angka otomatis tersimpan. Setelah selesai mengisi, tekan "Simpan & Kirim ke Akun Operator" agar masuk ke antrean Operator.'}
            </p>
          </div>
          <div className="flex items-center gap-2 sm:w-80">
            <input
              type="text"
              aria-label="Catatan untuk Operator Sekolah"
              value={operatorNote}
              onChange={(e) => setOperatorNote(e.target.value)}
              placeholder="Catatan singkat untuk Operator (opsional)..."
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none"
            />
          </div>
        </div>
      )}

      {/* Filter Bar */}
      <div className="grid grid-cols-1 gap-4 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-3">
        <div>
          <label htmlFor="grade-rombel-select" className="block text-xs font-semibold text-slate-700">
            Rombongan Belajar (Dapodik)
          </label>
          <select
            id="grade-rombel-select"
            value={selectedRombelId}
            onChange={(e) => setSelectedRombelId(e.target.value)}
            className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-900"
          >
            {dataset.rombels.map((rb) => (
              <option key={rb.id} value={rb.id}>
                {rb.nama} · {rb.fase} · Wali: {rb.waliKelasNama}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="grade-mapel-select" className="block text-xs font-semibold text-slate-700">
            Mata Pelajaran
          </label>
          <select
            id="grade-mapel-select"
            value={selectedMapelId}
            onChange={(e) => setSelectedMapelId(e.target.value)}
            className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-900"
          >
            {dataset.subjects.map((sub) => (
              <option key={sub.id} value={sub.id}>
                {sub.nama} (KKTP {sub.kkm})
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs text-slate-600">
          <div className="flex items-center justify-between gap-2">
            <label htmlFor="mapel-kktp-input" className="font-semibold text-slate-800">
              KKTP {selectedSubject?.kode || 'Mapel'} (50–95)
            </label>
            <button
              type="button"
              onClick={openAllKktpModal}
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-700 hover:underline whitespace-nowrap cursor-pointer"
            >
              <SlidersHorizontal className="h-3 w-3" aria-hidden="true" />
              <span>Atur Semua Mapel</span>
            </button>
          </div>

          <form onSubmit={(e) => void handleSaveSingleKktp(e)} className="flex items-center gap-2">
            <input
              id="mapel-kktp-input"
              type="number"
              min={50}
              max={95}
              aria-label="Nilai KKTP Mata Pelajaran"
              value={kktpInput}
              onChange={(e) => {
                setKktpInput(e.target.value);
                if (kktpError) setKktpError(null);
              }}
              className="w-20 rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-center font-mono text-xs font-bold tabular-nums text-slate-900 focus:border-blue-600 focus:outline-none"
            />
            <button
              type="submit"
              disabled={savingKktp}
              className="flex-1 rounded-md bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50 whitespace-nowrap cursor-pointer"
            >
              {savingKktp ? 'Menyimpan...' : 'Simpan KKTP'}
            </button>
          </form>

          {kktpError ? (
            <p role="alert" className="text-[11px] font-medium text-red-700">
              {kktpError}
            </p>
          ) : (
            <p className="text-[11px] text-slate-500 truncate">
              Pengampu: <strong className="text-slate-800">{selectedSubject?.guruPengampu}</strong> · 60% Lingkup + 40% SAS
            </p>
          )}
        </div>
      </div>

      {toastText && (
        <div
          role="status"
          className="flex items-center justify-between rounded-lg border border-blue-200 bg-blue-50 px-4 py-2 text-xs text-blue-900"
        >
          <span>{toastText}</span>
          <button
            type="button"
            onClick={() => setToastText(null)}
            className="font-semibold text-blue-700 hover:underline cursor-pointer"
          >
            Tutup
          </button>
        </div>
      )}

      {/* Spreadsheet Grade Grid */}
      <section className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-slate-200 bg-slate-50/70 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 text-xs text-slate-700">
            <FileSpreadsheet className="h-4 w-4 text-emerald-700 shrink-0" aria-hidden="true" />
            <span>
              <strong className="text-slate-900">
                {selectedSubject?.nama || 'Mata Pelajaran'}
              </strong>{' '}
              · {studentsInRombel.length} siswa · Bisa input langsung di tabel atau lewat Excel
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <input
              ref={gradeExcelInputRef}
              type="file"
              accept=".xlsx,.xls"
              aria-label="Pilih file Excel nilai siswa"
              onChange={(e) => void handleImportGradeXlsxFile(e)}
              className="hidden"
            />
            <button
              type="button"
              disabled={!selectedRombel || !selectedSubject}
              onClick={handleDownloadGradeTemplateXlsx}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-50 whitespace-nowrap cursor-pointer"
            >
              <Download className="h-3.5 w-3.5 text-slate-600" aria-hidden="true" />
              <span>Unduh Format Excel (.xlsx)</span>
            </button>
            <button
              type="button"
              disabled={importingExcel || !selectedRombel || !selectedSubject}
              onClick={() => gradeExcelInputRef.current?.click()}
              className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-700 bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-800 disabled:opacity-50 whitespace-nowrap cursor-pointer"
            >
              <Upload className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{importingExcel ? 'Mengimpor...' : 'Impor Nilai Excel (.xlsx)'}</span>
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-slate-700">
                <th className="px-4 py-3 font-semibold">No</th>
                <th className="px-4 py-3 font-semibold">Nama Peserta Didik</th>
                <th className="px-2 py-3 text-center font-semibold">LM 1</th>
                <th className="px-2 py-3 text-center font-semibold">LM 2</th>
                <th className="px-2 py-3 text-center font-semibold">LM 3</th>
                <th className="px-2 py-3 text-center font-semibold">SAS</th>
                <th className="px-3 py-3 text-right font-semibold">Nilai Rapor</th>
                <th className="px-3 py-3 text-center font-semibold">Predikat</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 text-right font-semibold">TP & Deskripsi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {studentsInRombel.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-6 py-10 text-center text-xs text-slate-500">
                    Belum ada peserta didik aktif pada rombel ini. Silakan tarik data dari WebService Dapodik atau impor berkas JSON Dapodik di menu{' '}
                    <strong className="text-slate-700">Referensi Dapodik</strong>.
                  </td>
                </tr>
              ) : (
              studentsInRombel.map((student, idx) => {
                const rec = getOrInitGrade(student.id);
                const lm1 = rec.sumatifLingkup[0] ?? 0;
                const lm2 = rec.sumatifLingkup[1] ?? 0;
                const lm3 = rec.sumatifLingkup[2] ?? 0;
                const isExpanded = expandedStudentId === student.id;
                const belowKkm =
                  rec.nilaiAkhir > 0 && selectedSubject && rec.nilaiAkhir < selectedSubject.kkm;

                return (
                  <React.Fragment key={student.id}>
                    <tr className="hover:bg-slate-50/70">
                      <td className="px-4 py-2.5 font-mono tabular-nums text-slate-500">
                        {idx + 1}
                      </td>
                      <td className="px-4 py-2.5">
                        <p className="font-semibold text-slate-900">{student.nama}</p>
                        <p className="font-mono text-[11px] tabular-nums text-slate-500">
                          NISN {student.nisn}
                        </p>
                      </td>
                      <td className="px-2 py-2.5 text-center">
                        <input
                          type="number"
                          min={0}
                          max={100}
                          aria-label={`Nilai Lingkup Materi 1 untuk ${student.nama}`}
                          value={lm1 === 0 ? '' : lm1}
                          onChange={(e) =>
                            void handleScoreChange(student.id, student.nama, 0, e.target.value)
                          }
                          placeholder="-"
                          className="w-14 rounded-md border border-slate-300 px-2 py-1.5 text-center font-mono tabular-nums text-slate-900 focus:border-blue-600 focus:outline-none"
                        />
                      </td>
                      <td className="px-2 py-2.5 text-center">
                        <input
                          type="number"
                          min={0}
                          max={100}
                          aria-label={`Nilai Lingkup Materi 2 untuk ${student.nama}`}
                          value={lm2 === 0 ? '' : lm2}
                          onChange={(e) =>
                            void handleScoreChange(student.id, student.nama, 1, e.target.value)
                          }
                          placeholder="-"
                          className="w-14 rounded-md border border-slate-300 px-2 py-1.5 text-center font-mono tabular-nums text-slate-900 focus:border-blue-600 focus:outline-none"
                        />
                      </td>
                      <td className="px-2 py-2.5 text-center">
                        <input
                          type="number"
                          min={0}
                          max={100}
                          aria-label={`Nilai Lingkup Materi 3 untuk ${student.nama}`}
                          value={lm3 === 0 ? '' : lm3}
                          onChange={(e) =>
                            void handleScoreChange(student.id, student.nama, 2, e.target.value)
                          }
                          placeholder="-"
                          className="w-14 rounded-md border border-slate-300 px-2 py-1.5 text-center font-mono tabular-nums text-slate-900 focus:border-blue-600 focus:outline-none"
                        />
                      </td>
                      <td className="px-2 py-2.5 text-center">
                        <input
                          type="number"
                          min={0}
                          max={100}
                          aria-label={`Nilai Sumatif Akhir Semester untuk ${student.nama}`}
                          value={rec.sumatifAkhirSemester ?? ''}
                          onChange={(e) =>
                            void handleScoreChange(student.id, student.nama, 'sas', e.target.value)
                          }
                          placeholder="-"
                          className="w-14 rounded-md border border-slate-300 bg-slate-50 px-2 py-1.5 text-center font-mono tabular-nums text-slate-900 focus:border-blue-600 focus:bg-white focus:outline-none"
                        />
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono text-sm font-bold tabular-nums">
                        <span className={belowKkm ? 'text-red-700' : 'text-slate-900'}>
                          {rec.nilaiAkhir > 0 ? rec.nilaiAkhir : '—'}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-center font-mono font-bold text-slate-800">
                        {rec.nilaiAkhir > 0 ? rec.predikat : '—'}
                      </td>
                      <td className="px-4 py-2.5 whitespace-nowrap">
                        {savingStudentId === student.id ? (
                          <span className="text-slate-500">Menyimpan...</span>
                        ) : rec.syncStatus === 'pending' ? (
                          <span className="inline-flex items-center gap-1 font-medium text-amber-700">
                            <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                            <span>Antre Offline</span>
                          </span>
                        ) : rec.nilaiAkhir > 0 ? (
                          <span className="inline-flex items-center gap-1 font-medium text-emerald-700">
                            <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                            <span>Tersinkron</span>
                          </span>
                        ) : (
                          <span className="text-slate-400">Belum diisi</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() =>
                            setExpandedStudentId(isExpanded ? null : student.id)
                          }
                          aria-expanded={isExpanded}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-blue-700 hover:underline cursor-pointer"
                        >
                          <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                          <span>{isExpanded ? 'Tutup Detail' : 'Atur TP & Deskripsi'}</span>
                        </button>
                      </td>
                    </tr>

                    {isExpanded && (
                      <tr className="bg-slate-50/90">
                        <td colSpan={10} className="px-6 py-4">
                          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                            <div>
                              <h3 className="text-xs font-bold text-slate-900">
                                Capaian Tujuan Pembelajaran ({selectedSubject?.nama})
                              </h3>
                              <div className="mt-2 space-y-2">
                                {tpListForSubject.length === 0 ? (
                                  <p className="text-xs text-slate-500">
                                    Belum ada TP khusus pada semester ini.
                                  </p>
                                ) : (
                                  tpListForSubject.map((tp) => {
                                    const isTercapai = rec.tpTercapaiIds.includes(tp.id);
                                    const isPerlu = rec.tpPerluBimbinganIds.includes(tp.id);
                                    return (
                                      <div
                                        key={tp.id}
                                        className="rounded-lg border border-slate-200 bg-white p-2.5 text-xs"
                                      >
                                        <p className="font-medium text-slate-800">
                                          <span className="font-mono font-bold text-blue-700">
                                            {tp.kode}
                                          </span>
                                          {tp.levelMendalam && (
                                            <span className="text-slate-500">
                                              {' '}
                                              · {tp.levelMendalam}
                                            </span>
                                          )}{' '}
                                          · {tp.deskripsi}
                                        </p>
                                        <div className="mt-2 flex items-center gap-4">
                                          <label className="inline-flex items-center gap-1.5 text-emerald-700 cursor-pointer">
                                            <input
                                              type="checkbox"
                                              checked={isTercapai}
                                              onChange={() =>
                                                void handleTpToggle(
                                                  student.id,
                                                  student.nama,
                                                  tp.id,
                                                  'tercapai'
                                                )
                                              }
                                            />
                                            <span>Sangat Menguasai</span>
                                          </label>
                                          <label className="inline-flex items-center gap-1.5 text-amber-700 cursor-pointer">
                                            <input
                                              type="checkbox"
                                              checked={isPerlu}
                                              onChange={() =>
                                                void handleTpToggle(
                                                  student.id,
                                                  student.nama,
                                                  tp.id,
                                                  'perlu'
                                                )
                                              }
                                            />
                                            <span>Perlu Bimbingan</span>
                                          </label>
                                        </div>
                                      </div>
                                    );
                                  })
                                )}
                              </div>
                            </div>

                            <div>
                              <label
                                htmlFor={`desc-${student.id}`}
                                className="block text-xs font-bold text-slate-900"
                              >
                                Narasi Deskripsi Capaian Kompetensi (Tercetak di Rapor)
                              </label>
                              <textarea
                                id={`desc-${student.id}`}
                                rows={4}
                                value={rec.deskripsiCapaian}
                                onChange={(e) =>
                                  void handleCustomDeskripsiSave(student.id, e.target.value)
                                }
                                placeholder="Deskripsi akan terisi otomatis saat nilai dan TP dipilih..."
                                className="mt-2 w-full rounded-lg border border-slate-300 bg-white p-3 text-xs leading-relaxed text-slate-800 focus:border-blue-600 focus:outline-none"
                              />
                              <p className="mt-1 text-[11px] text-slate-500">
                                Di kelas {selectedRombel?.nama}, batas ketuntasan KKTP adalah{' '}
                                <span className="font-mono font-semibold">{selectedSubject?.kkm}</span>.
                              </p>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })
              )}
            </tbody>
          </table>
        </div>
      </section>

      {showAllKktpModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-kktp-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
        >
          <div className="w-full max-w-2xl rounded-xl border border-slate-200 bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <div>
                <h2 id="modal-kktp-title" className="text-sm font-bold text-slate-900">
                  Atur KKTP Seluruh Mata Pelajaran
                </h2>
                <p className="mt-0.5 text-xs text-slate-600">
                  Sesuaikan batas ketuntasan (50–95) tiap mata pelajaran. Predikat &amp; status tuntas siswa langsung diperbarui otomatis.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowAllKktpModal(false)}
                aria-label="Tutup pengaturan KKTP"
                className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={(e) => void handleSaveAllKktp(e)}>
              <div className="max-h-[60vh] overflow-y-auto divide-y divide-slate-100 px-5 py-2">
                {dataset.subjects.map((sub) => (
                  <div
                    key={sub.id}
                    className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-slate-900">
                        <span className="font-mono text-blue-700">{sub.kode}</span> · {sub.nama}
                      </p>
                      <p className="text-[11px] text-slate-500">
                        Pengampu: {sub.guruPengampu}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <label
                        htmlFor={`batch-kktp-${sub.id}`}
                        className="text-[11px] font-medium text-slate-600"
                      >
                        KKTP:
                      </label>
                      <input
                        id={`batch-kktp-${sub.id}`}
                        type="number"
                        min={50}
                        max={95}
                        aria-label={`KKTP untuk ${sub.nama}`}
                        value={batchKktpValues[sub.id] ?? String(sub.kkm)}
                        onChange={(e) => {
                          const val = e.target.value;
                          setBatchKktpValues((prev) => ({ ...prev, [sub.id]: val }));
                          if (batchKktpError) setBatchKktpError(null);
                        }}
                        className="w-20 rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-center font-mono text-xs font-bold tabular-nums text-slate-900 focus:border-blue-600 focus:outline-none"
                      />
                    </div>
                  </div>
                ))}
              </div>

              {batchKktpError && (
                <div
                  role="alert"
                  className="mx-5 mt-2 rounded-lg border border-red-200 bg-red-50 px-3.5 py-2 text-xs text-red-800"
                >
                  {batchKktpError}
                </div>
              )}

              <div className="flex items-center justify-end gap-2.5 border-t border-slate-200 px-5 py-3.5">
                <button
                  type="button"
                  onClick={() => setShowAllKktpModal(false)}
                  className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={savingKktp}
                  className="rounded-lg bg-blue-700 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-800 disabled:opacity-50 cursor-pointer"
                >
                  {savingKktp ? 'Menyimpan...' : 'Simpan Semua KKTP'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
