import React, { useState } from 'react';
import { CheckCircle2, Clock, Plus, Save, Send, Sparkles, Trash2 } from 'lucide-react';
import {
  DELAPAN_DIMENSI_PROFIL_LULUSAN,
  generateKokurikulerNarasi,
  type DeepLearningPrinsip,
  type EraporDataset,
  type KokurikulerBentukType,
  type P5CapaianType,
  type P5Entry,
  type WaliKelasRecord,
} from '../lib/eraporCore';

interface WaliP5ViewProps {
  dataset: EraporDataset;
  onSaveWali: (record: WaliKelasRecord) => Promise<void>;
  onSubmitToOperator?: (rombelId: string, notes?: string) => Promise<void>;
  isOnline: boolean;
}

const DEEP_LEARNING_PRINSIP_OPTIONS: DeepLearningPrinsip[] = [
  'Berkesadaran',
  'Bermakna',
  'Menggembirakan',
];

function getDimensiArray(entry: P5Entry): string[] {
  if (entry.dimensiList && entry.dimensiList.length > 0) {
    return entry.dimensiList;
  }
  return DELAPAN_DIMENSI_PROFIL_LULUSAN.filter((d) =>
    entry.dimensi.toLowerCase().includes(d.toLowerCase())
  );
}

export const WaliP5View: React.FC<WaliP5ViewProps> = ({
  dataset,
  onSaveWali,
  onSubmitToOperator,
  isOnline,
}) => {
  const [selectedRombelId, setSelectedRombelId] = useState(
    dataset.rombels[2]?.id || dataset.rombels[0]?.id || ''
  );
  const [isSendingOperator, setIsSendingOperator] = useState(false);

  const studentsInRombel = dataset.students
    .filter((s) => s.rombelId === selectedRombelId && s.statusAktif === 'Aktif')
    .sort((a, b) => a.nama.localeCompare(b.nama, 'id'));

  const [selectedStudentId, setSelectedStudentId] = useState(
    studentsInRombel[0]?.id || ''
  );

  const activeStudent =
    studentsInRombel.find((s) => s.id === selectedStudentId) || studentsInRombel[0];

  const existingRecord = dataset.waliRecords.find(
    (w) => w.studentId === activeStudent?.id
  );

  const [draft, setDraft] = useState<WaliKelasRecord | null>(null);
  const [savedToast, setSavedToast] = useState<string | null>(null);

  const currentRecord: WaliKelasRecord =
    draft && draft.studentId === activeStudent?.id
      ? draft
      : existingRecord || {
          id: `wali-${activeStudent?.id || 'none'}`,
          studentId: activeStudent?.id || '',
          rombelId: selectedRombelId,
          semesterId: dataset.school.semesterId,
          sakit: 0,
          izin: 0,
          tanpaKeterangan: 0,
          ekstrakurikuler: [
            {
              nama: 'Pramuka',
              predikat: 'Baik',
              keterangan: 'Mengikuti kegiatan kepramukaan sekolah secara aktif.',
            },
          ],
          kokurikulerP5: [
            {
              bentukKegiatan: 'Lintas Disiplin Ilmu',
              tema: 'Kearifan Lokal: Subak & Pelestarian Alam Bali',
              dimensi: 'Kolaborasi, Kewargaan, Penalaran Kritis',
              dimensiList: ['Kolaborasi', 'Kewargaan', 'Penalaran Kritis'],
              prinsipDeepLearning: ['Berkesadaran', 'Bermakna', 'Menggembirakan'],
              capaian: 'Cakap',
              catatan:
                'Mampu berkolaborasi lintas mata pelajaran secara sadar dan bermakna dalam menyelesaikan kegiatan kokurikuler kelas.',
            },
          ],
          catatanWali:
            'Terus jaga semangat belajar, kejujuran, dan kepedulian terhadap lingkungan sekolah.',
          keputusanNaik: 'Proses',
          updatedAt: new Date().toISOString(),
          syncStatus: isOnline ? 'synced' : 'pending',
        };

  const updateDraft = (patch: Partial<WaliKelasRecord>) => {
    setDraft({
      ...currentRecord,
      ...patch,
      updatedAt: new Date().toISOString(),
    });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeStudent) return;
    await onSaveWali({
      ...currentRecord,
      studentId: activeStudent.id,
      rombelId: selectedRombelId,
      updatedAt: new Date().toISOString(),
    });
    setDraft(null);
    setSavedToast(
      isOnline
        ? `Data wali kelas & kokurikuler untuk ${activeStudent.nama} tersimpan & tersinkron.`
        : `Data wali kelas & kokurikuler untuk ${activeStudent.nama} disimpan offline (antre sinkronisasi).`
    );
  };

  return (
    <div className="space-y-6">
      <div className="border-b border-slate-200 pb-4">
        <h1 className="text-xl font-bold text-slate-900">
          Wali Kelas, Absensi &amp; Kokurikuler (8 Dimensi · 2026)
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Lengkapi ketidakhadiran, ekstrakurikuler, Kokurikuler Lintas Disiplin Ilmu &amp; 8 Dimensi Profil Lulusan (Permendikdasmen No. 10 &amp; 13/2025), serta catatan wali kelas.
        </p>
      </div>

      {/* Selector Bar */}
      <div className="grid grid-cols-1 gap-4 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-2">
        <div>
          <label htmlFor="wali-rombel-select" className="block text-xs font-semibold text-slate-700">
            Pilih Rombel
          </label>
          <select
            id="wali-rombel-select"
            value={selectedRombelId}
            onChange={(e) => {
              const nextRombel = e.target.value;
              setSelectedRombelId(nextRombel);
              const firstSt = dataset.students.find((s) => s.rombelId === nextRombel);
              if (firstSt) setSelectedStudentId(firstSt.id);
              setDraft(null);
            }}
            className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-900"
          >
            {dataset.rombels.map((rb) => (
              <option key={rb.id} value={rb.id}>
                {rb.nama} · Wali: {rb.waliKelasNama}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="wali-student-select" className="block text-xs font-semibold text-slate-700">
            Pilih Peserta Didik
          </label>
          <select
            id="wali-student-select"
            value={activeStudent?.id || ''}
            onChange={(e) => {
              setSelectedStudentId(e.target.value);
              setDraft(null);
              setSavedToast(null);
            }}
            className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-900"
          >
            {studentsInRombel.map((st) => (
              <option key={st.id} value={st.id}>
                {st.nama} (NISN: {st.nisn})
              </option>
            ))}
          </select>
        </div>
      </div>

      {savedToast && (
        <div
          role="status"
          className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-xs text-emerald-900"
        >
          {savedToast}
        </div>
      )}

      {!activeStudent ? (
        <div className="rounded-xl border border-slate-200 bg-white px-6 py-10 text-center text-xs text-slate-500">
          Belum ada peserta didik aktif pada rombel ini. Tarik data siswa dari Dapodik sekolah terlebih dahulu di menu{' '}
          <strong className="text-slate-700">Referensi Dapodik</strong>.
        </div>
      ) : (
        <form onSubmit={(e) => void handleSave(e)} className="space-y-6">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Ketidakhadiran & Keputusan */}
            <section className="rounded-xl border border-slate-200 bg-white p-6">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-slate-900">
                  Ketidakhadiran &amp; Catatan Wali
                </h2>
                {currentRecord.syncStatus === 'pending' ? (
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700">
                    <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Antre Offline</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700">
                    <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Tersinkron</span>
                  </span>
                )}
              </div>

              <div className="mt-4 grid grid-cols-3 gap-3">
                <div>
                  <label htmlFor="absen-sakit" className="block text-xs font-semibold text-slate-700">
                    Sakit (Hari)
                  </label>
                  <input
                    id="absen-sakit"
                    type="number"
                    min={0}
                    value={currentRecord.sakit}
                    onChange={(e) => updateDraft({ sakit: Math.max(0, Number(e.target.value)) })}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-xs tabular-nums text-slate-900"
                  />
                </div>
                <div>
                  <label htmlFor="absen-izin" className="block text-xs font-semibold text-slate-700">
                    Izin (Hari)
                  </label>
                  <input
                    id="absen-izin"
                    type="number"
                    min={0}
                    value={currentRecord.izin}
                    onChange={(e) => updateDraft({ izin: Math.max(0, Number(e.target.value)) })}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-xs tabular-nums text-slate-900"
                  />
                </div>
                <div>
                  <label htmlFor="absen-alpa" className="block text-xs font-semibold text-slate-700">
                    Tanpa Ket.
                  </label>
                  <input
                    id="absen-alpa"
                    type="number"
                    min={0}
                    value={currentRecord.tanpaKeterangan}
                    onChange={(e) =>
                      updateDraft({ tanpaKeterangan: Math.max(0, Number(e.target.value)) })
                    }
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-xs tabular-nums text-slate-900"
                  />
                </div>
              </div>

              <div className="mt-4">
                <label htmlFor="catatan-wali" className="block text-xs font-semibold text-slate-700">
                  Catatan Wali Kelas
                </label>
                <textarea
                  id="catatan-wali"
                  rows={3}
                  value={currentRecord.catatanWali}
                  onChange={(e) => updateDraft({ catatanWali: e.target.value })}
                  className="mt-1.5 w-full rounded-lg border border-slate-300 p-3 text-xs leading-relaxed text-slate-900"
                />
              </div>

              <div className="mt-4">
                <label htmlFor="keputusan-naik" className="block text-xs font-semibold text-slate-700">
                  Keputusan Akhir Semester
                </label>
                <select
                  id="keputusan-naik"
                  value={currentRecord.keputusanNaik}
                  onChange={(e) =>
                    updateDraft({
                      keputusanNaik: e.target.value as WaliKelasRecord['keputusanNaik'],
                    })
                  }
                  className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-900"
                >
                  <option value="Proses">Semester Ganjil (Dalam Proses)</option>
                  <option value="Naik Kelas">Naik ke Tingkat Berikutnya</option>
                  <option value="Lulus">Lulus Satuan Pendidikan</option>
                  <option value="Tinggal Kelas">Tinggal Kelas</option>
                </select>
              </div>
            </section>

            {/* Kokurikuler 8 Dimensi & Ekskul */}
            <section className="rounded-xl border border-slate-200 bg-white p-6 space-y-5">
              <div>
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-bold text-slate-900">
                    Capaian Kokurikuler (8 Dimensi · 2026)
                  </h2>
                  <button
                    type="button"
                    onClick={() =>
                      updateDraft({
                        kokurikulerP5: [
                          ...currentRecord.kokurikulerP5,
                          {
                            bentukKegiatan: 'Lintas Disiplin Ilmu',
                            tema: 'Gaya Hidup Berkelanjutan & Peduli Lingkungan',
                            dimensi: 'Kolaborasi, Kreativitas, Kewargaan',
                            dimensiList: ['Kolaborasi', 'Kreativitas', 'Kewargaan'],
                            prinsipDeepLearning: ['Berkesadaran', 'Bermakna', 'Menggembirakan'],
                            capaian: 'Cakap',
                            catatan:
                              'Aktif berkolaborasi dan merefleksikan aksi nyata dalam kegiatan kokurikuler kelas.',
                          },
                        ],
                      })
                    }
                    className="inline-flex items-center gap-1 text-xs font-semibold text-blue-700 hover:underline cursor-pointer"
                  >
                    <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Tambah Kokurikuler</span>
                  </button>
                </div>
                <div className="mt-3 space-y-3">
                  {currentRecord.kokurikulerP5.length === 0 ? (
                    <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-4 text-center text-xs text-slate-500">
                      Belum ada kegiatan kokurikuler dicatat. Klik &ldquo;Tambah Kokurikuler&rdquo; di kanan atas.
                    </p>
                  ) : (
                    currentRecord.kokurikulerP5.map((p5, idx) => {
                      const activeDims = getDimensiArray(p5);
                      const activePrinsip = p5.prinsipDeepLearning ?? [
                        'Berkesadaran',
                        'Bermakna',
                      ];
                      return (
                        <div key={idx} className="rounded-lg border border-slate-200 bg-slate-50 p-3.5 space-y-2.5">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[11px] font-bold text-slate-700">
                              Kegiatan Kokurikuler #{idx + 1}
                            </span>
                            <button
                              type="button"
                              onClick={() =>
                                updateDraft({
                                  kokurikulerP5: currentRecord.kokurikulerP5.filter(
                                    (_, i) => i !== idx
                                  ),
                                })
                              }
                              aria-label={`Hapus Kokurikuler ${idx + 1}`}
                              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium text-slate-500 hover:bg-red-50 hover:text-red-700 cursor-pointer"
                            >
                              <Trash2 className="h-3 w-3" aria-hidden="true" />
                              <span>Hapus</span>
                            </button>
                          </div>

                          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                            <select
                              aria-label={`Bentuk Kokurikuler ${idx + 1}`}
                              value={p5.bentukKegiatan || 'Lintas Disiplin Ilmu'}
                              onChange={(e) => {
                                const next = [...currentRecord.kokurikulerP5];
                                next[idx] = {
                                  ...p5,
                                  bentukKegiatan: e.target.value as KokurikulerBentukType,
                                };
                                updateDraft({ kokurikulerP5: next });
                              }}
                              className="rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-900"
                            >
                              <option value="Lintas Disiplin Ilmu">Lintas Disiplin Ilmu</option>
                              <option value="Kebiasaan Anak Indonesia Hebat">
                                Kebiasaan Anak Indonesia Hebat
                              </option>
                              <option value="Projek Kontekstual Sekolah">
                                Projek Kontekstual Sekolah
                              </option>
                            </select>

                            <select
                              aria-label={`Capaian Kokurikuler ${idx + 1}`}
                              value={p5.capaian}
                              onChange={(e) => {
                                const next = [...currentRecord.kokurikulerP5];
                                next[idx] = { ...p5, capaian: e.target.value as P5CapaianType };
                                updateDraft({ kokurikulerP5: next });
                              }}
                              className="rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-900"
                            >
                              <option value="Mahir">Mahir (Sangat Baik)</option>
                              <option value="Cakap">Cakap (Sesuai Harapan)</option>
                              <option value="Berkembang">Berkembang</option>
                              {(p5.capaian === 'BB' ||
                                p5.capaian === 'MB' ||
                                p5.capaian === 'BSH' ||
                                p5.capaian === 'SB') && (
                                <option value={p5.capaian}>{p5.capaian} (Arsip)</option>
                              )}
                            </select>
                          </div>

                          <input
                            type="text"
                            aria-label={`Tema Kokurikuler ${idx + 1}`}
                            placeholder="Tema Kegiatan Kokurikuler"
                            value={p5.tema}
                            onChange={(e) => {
                              const next = [...currentRecord.kokurikulerP5];
                              next[idx] = { ...p5, tema: e.target.value };
                              updateDraft({ kokurikulerP5: next });
                            }}
                            className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-900"
                          />

                          <div>
                            <p className="text-[11px] font-semibold text-slate-700">
                              8 Dimensi Profil Lulusan (Permendikdasmen 10/2025):
                            </p>
                            <div className="mt-1.5 grid grid-cols-1 gap-1.5 sm:grid-cols-2 pt-1">
                              {DELAPAN_DIMENSI_PROFIL_LULUSAN.map((dim) => {
                                const checked = activeDims.includes(dim);
                                return (
                                  <label
                                    key={dim}
                                    className="inline-flex items-start gap-1.5 text-[11px] text-slate-700 cursor-pointer"
                                  >
                                    <input
                                      type="checkbox"
                                      checked={checked}
                                      onChange={() => {
                                        const updatedList = checked
                                          ? activeDims.filter((d) => d !== dim)
                                          : [...activeDims, dim];
                                        const next = [...currentRecord.kokurikulerP5];
                                        next[idx] = {
                                          ...p5,
                                          dimensiList: updatedList,
                                          dimensi: updatedList.join(', '),
                                        };
                                        updateDraft({ kokurikulerP5: next });
                                      }}
                                      className="mt-0.5 shrink-0"
                                    />
                                    <span className="leading-tight">{dim}</span>
                                  </label>
                                );
                              })}
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex flex-wrap items-center gap-3">
                              {DEEP_LEARNING_PRINSIP_OPTIONS.map((pr) => {
                                const checked = activePrinsip.includes(pr);
                                return (
                                  <label
                                    key={pr}
                                    className="inline-flex items-center gap-1.5 text-[11px] text-slate-700 cursor-pointer"
                                  >
                                    <input
                                      type="checkbox"
                                      checked={checked}
                                      onChange={() => {
                                        const updatedPr = checked
                                          ? activePrinsip.filter((p) => p !== pr)
                                          : [...activePrinsip, pr];
                                        const next = [...currentRecord.kokurikulerP5];
                                        next[idx] = {
                                          ...p5,
                                          prinsipDeepLearning: updatedPr,
                                        };
                                        updateDraft({ kokurikulerP5: next });
                                      }}
                                    />
                                    <span>{pr}</span>
                                  </label>
                                );
                              })}
                            </div>

                            <button
                              type="button"
                              onClick={() => {
                                const next = [...currentRecord.kokurikulerP5];
                                next[idx] = {
                                  ...p5,
                                  catatan: generateKokurikulerNarasi({
                                    studentName: activeStudent.nama,
                                    tema: p5.tema,
                                    bentukKegiatan: p5.bentukKegiatan,
                                    dimensiList: activeDims,
                                    capaian: p5.capaian,
                                    prinsipDeepLearning: activePrinsip,
                                  }),
                                };
                                updateDraft({ kokurikulerP5: next });
                              }}
                              className="inline-flex items-center gap-1 rounded-md border border-blue-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-blue-700 hover:bg-blue-50 whitespace-nowrap cursor-pointer"
                            >
                              <Sparkles className="h-3 w-3" aria-hidden="true" />
                              <span>Susun Narasi Positif (2026)</span>
                            </button>
                          </div>

                          <textarea
                            rows={3}
                            aria-label={`Catatan Kokurikuler ${idx + 1}`}
                            placeholder="Deskripsi kualitatif perkembangan kokurikuler yang positif & membangun..."
                            value={p5.catatan}
                            onChange={(e) => {
                              const next = [...currentRecord.kokurikulerP5];
                              next[idx] = { ...p5, catatan: e.target.value };
                              updateDraft({ kokurikulerP5: next });
                            }}
                            className="w-full rounded-md border border-slate-300 bg-white p-2 text-xs text-slate-800"
                          />
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-bold text-slate-900">Ekstrakurikuler</h2>
                  <button
                    type="button"
                    onClick={() =>
                      updateDraft({
                        ekstrakurikuler: [
                          ...currentRecord.ekstrakurikuler,
                          {
                            nama: 'Kegiatan Baru',
                            predikat: 'Baik',
                            keterangan: 'Aktif berpartisipasi dalam latihan rutin.',
                          },
                        ],
                      })
                    }
                    className="inline-flex items-center gap-1 text-xs font-semibold text-blue-700 hover:underline cursor-pointer"
                  >
                    <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Tambah Ekskul</span>
                  </button>
                </div>

                <div className="mt-3 space-y-2.5">
                  {currentRecord.ekstrakurikuler.map((eks, idx) => (
                    <div
                      key={idx}
                      className="flex flex-col gap-2 rounded-lg border border-slate-200 p-3 sm:flex-row sm:items-center"
                    >
                      <input
                        type="text"
                        aria-label="Nama Ekstrakurikuler"
                        value={eks.nama}
                        onChange={(e) => {
                          const next = [...currentRecord.ekstrakurikuler];
                          next[idx] = { ...eks, nama: e.target.value };
                          updateDraft({ ekstrakurikuler: next });
                        }}
                        className="flex-1 rounded-md border border-slate-300 px-2.5 py-1.5 text-xs font-medium text-slate-900"
                      />
                      <select
                        aria-label="Predikat Ekstrakurikuler"
                        value={eks.predikat}
                        onChange={(e) => {
                          const next = [...currentRecord.ekstrakurikuler];
                          next[idx] = {
                            ...eks,
                            predikat: e.target.value as 'Sangat Baik' | 'Baik' | 'Cukup',
                          };
                          updateDraft({ ekstrakurikuler: next });
                        }}
                        className="rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900"
                      >
                        <option value="Sangat Baik">Sangat Baik</option>
                        <option value="Baik">Baik</option>
                        <option value="Cukup">Cukup</option>
                      </select>
                      <button
                        type="button"
                        onClick={() =>
                          updateDraft({
                            ekstrakurikuler: currentRecord.ekstrakurikuler.filter(
                              (_, i) => i !== idx
                            ),
                          })
                        }
                        aria-label={`Hapus ${eks.nama}`}
                        className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-700 cursor-pointer"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-3">
            {onSubmitToOperator && (
              <button
                type="button"
                disabled={isSendingOperator || !isOnline}
                onClick={async () => {
                  setIsSendingOperator(true);
                  try {
                    if (activeStudent) {
                      await onSaveWali({
                        ...currentRecord,
                        studentId: activeStudent.id,
                        rombelId: selectedRombelId,
                        updatedAt: new Date().toISOString(),
                      });
                    }
                    await onSubmitToOperator(
                      selectedRombelId,
                      `Data Wali Kelas, Absensi & Kokurikuler untuk ${activeStudent?.nama || 'siswa'} telah disimpan dan dikirim.`
                    );
                    setDraft(null);
                    setSavedToast(
                      'Data Wali Kelas & Kokurikuler berhasil disimpan dan masuk ke Akun Operator.'
                    );
                  } finally {
                    setIsSendingOperator(false);
                  }
                }}
                className="inline-flex items-center gap-2 rounded-lg border border-blue-700 bg-white px-4 py-2.5 text-xs font-semibold text-blue-700 hover:bg-blue-50 disabled:opacity-50 cursor-pointer"
              >
                <Send className="h-3.5 w-3.5" aria-hidden="true" />
                <span>
                  {isSendingOperator
                    ? 'Mengirim ke Operator...'
                    : 'Simpan & Kirim ke Akun Operator'}
                </span>
              </button>
            )}

            <button
              type="submit"
              className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-5 py-2.5 text-xs font-semibold text-white hover:bg-blue-800 cursor-pointer"
            >
              <Save className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Simpan Catatan Wali &amp; Kokurikuler</span>
            </button>
          </div>
        </form>
      )}
    </div>
  );
};
