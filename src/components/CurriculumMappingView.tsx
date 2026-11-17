import React, { useMemo, useState } from 'react';
import {
  BookOpen,
  Cpu,
  Edit3,
  Plus,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import {
  computeDeepLearningReadiness,
  DELAPAN_DIMENSI_PROFIL_LULUSAN,
  type DapodikSubject,
  type DeepLearningLevel,
  type EraporDataset,
  type TujuanPembelajaran,
} from '../lib/eraporCore';

interface CurriculumMappingViewProps {
  dataset: EraporDataset;
  isOnline: boolean;
  onSaveSubjectMapping: (params: {
    id?: string;
    kode: string;
    nama: string;
    kelompok: DapodikSubject['kelompok'];
    kkm: number;
    guruPengampu: string;
    nipGuru?: string;
  }) => Promise<void>;
  onSaveTp: (params: {
    id?: string;
    mapelId: string;
    tingkat: number;
    kode: string;
    deskripsi: string;
    levelMendalam?: DeepLearningLevel;
    dimensiProfil?: string[];
  }) => Promise<void>;
  onDeleteTp: (tpId: string) => Promise<void>;
  onActivateKka: () => Promise<{ alreadyActive: boolean; addedTpCount: number }>;
}

export const CurriculumMappingView: React.FC<CurriculumMappingViewProps> = ({
  dataset,
  isOnline,
  onSaveSubjectMapping,
  onSaveTp,
  onDeleteTp,
  onActivateKka,
}) => {
  const [selectedMapelId, setSelectedMapelId] = useState(
    dataset.subjects[0]?.id || ''
  );
  const [statusMsg, setStatusMsg] = useState<{
    type: 'ok' | 'err';
    text: string;
  } | null>(null);
  const [activatingKka, setActivatingKka] = useState(false);

  // Subject Mapping Modal State
  const [subjectModalOpen, setSubjectModalOpen] = useState(false);
  const [editingSubjectId, setEditingSubjectId] = useState<string | undefined>(
    undefined
  );
  const [subKode, setSubKode] = useState('');
  const [subNama, setSubNama] = useState('');
  const [subKelompok, setSubKelompok] =
    useState<DapodikSubject['kelompok']>('Umum');
  const [subKkm, setSubKkm] = useState('75');
  const [subGuru, setSubGuru] = useState('');
  const [subNip, setSubNip] = useState('-');
  const [subSaving, setSubSaving] = useState(false);
  const [subError, setSubError] = useState<string | null>(null);

  // TP Form State
  const defaultTingkat =
    dataset.rombels[0]?.tingkat ||
    (dataset.school.jenjang === 'SMP'
      ? 7
      : dataset.school.jenjang === 'SMA' || dataset.school.jenjang === 'SMK'
        ? 10
        : 6);
  const [editingTpId, setEditingTpId] = useState<string | undefined>(undefined);
  const [tpKode, setTpKode] = useState('');
  const [tpTingkat, setTpTingkat] = useState(String(defaultTingkat));
  const [tpDeskripsi, setTpDeskripsi] = useState('');
  const [tpLevelMendalam, setTpLevelMendalam] =
    useState<DeepLearningLevel>('Memahami');
  const [tpDimensiProfil, setTpDimensiProfil] = useState<string[]>([
    'Penalaran Kritis',
  ]);
  const [tpSaving, setTpSaving] = useState(false);

  const readiness = useMemo(
    () => computeDeepLearningReadiness(dataset),
    [dataset]
  );

  const activeSubject =
    dataset.subjects.find((s) => s.id === selectedMapelId) || dataset.subjects[0];

  const tpsForSelectedSubject = useMemo(
    () =>
      dataset.tujuanPembelajaran.filter(
        (tp) => tp.mapelId === activeSubject?.id
      ),
    [dataset.tujuanPembelajaran, activeSubject?.id]
  );

  const openAddSubjectModal = () => {
    setEditingSubjectId(undefined);
    setSubKode('');
    setSubNama('');
    setSubKelompok('Muatan Lokal');
    setSubKkm('75');
    setSubGuru('');
    setSubNip('-');
    setSubError(null);
    setSubjectModalOpen(true);
  };

  const openEditSubjectModal = (sub: DapodikSubject) => {
    setEditingSubjectId(sub.id);
    setSubKode(sub.kode);
    setSubNama(sub.nama);
    setSubKelompok(sub.kelompok);
    setSubKkm(String(sub.kkm));
    setSubGuru(sub.guruPengampu);
    setSubNip(sub.nipGuru || '-');
    setSubError(null);
    setSubjectModalOpen(true);
  };

  const handleSubmitSubjectModal = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubError(null);
    setSubSaving(true);
    try {
      await onSaveSubjectMapping({
        id: editingSubjectId,
        kode: subKode,
        nama: subNama,
        kelompok: subKelompok,
        kkm: Number(subKkm),
        guruPengampu: subGuru,
        nipGuru: subNip,
      });
      setSubjectModalOpen(false);
      setStatusMsg({
        type: 'ok',
        text: editingSubjectId
          ? `Pemetaan mata pelajaran ${subNama} (${subGuru}) diperbarui.`
          : `Mata pelajaran baru ${subNama} berhasil ditambahkan.`,
      });
    } catch (err) {
      setSubError(
        err instanceof Error
          ? err.message
          : 'Gagal menyimpan pemetaan mata pelajaran.'
      );
    } finally {
      setSubSaving(false);
    }
  };

  const handleEditTpClick = (tp: TujuanPembelajaran) => {
    setEditingTpId(tp.id);
    setTpKode(tp.kode);
    setTpTingkat(String(tp.tingkat));
    setTpDeskripsi(tp.deskripsi);
    setTpLevelMendalam(tp.levelMendalam || 'Memahami');
    setTpDimensiProfil(
      tp.dimensiProfil && tp.dimensiProfil.length > 0
        ? tp.dimensiProfil
        : ['Penalaran Kritis']
    );
  };

  const resetTpForm = () => {
    setEditingTpId(undefined);
    setTpKode('');
    setTpTingkat(String(defaultTingkat));
    setTpDeskripsi('');
    setTpLevelMendalam('Memahami');
    setTpDimensiProfil(['Penalaran Kritis']);
  };

  const toggleTpDimensi = (dimensi: string) => {
    setTpDimensiProfil((prev) =>
      prev.includes(dimensi)
        ? prev.filter((d) => d !== dimensi)
        : [...prev, dimensi]
    );
  };

  const handleActivateKkaClick = async () => {
    setActivatingKka(true);
    setStatusMsg(null);
    try {
      const result = await onActivateKka();
      setSelectedMapelId('mapel-kka');
      setStatusMsg({
        type: 'ok',
        text: result.alreadyActive
          ? 'Mata Pelajaran Pilihan Koding & Kecerdasan Artifisial (KKA) sudah aktif.'
          : `Mapel Pilihan Koding dan Kecerdasan Artifisial (KKA) berhasil diaktifkan beserta ${result.addedTpCount} TP Pembelajaran Mendalam.`,
      });
    } catch (err) {
      setStatusMsg({
        type: 'err',
        text:
          err instanceof Error
            ? err.message
            : 'Gagal mengaktifkan mata pelajaran KKA.',
      });
    } finally {
      setActivatingKka(false);
    }
  };

  const handleSubmitTp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeSubject) return;
    setTpSaving(true);
    setStatusMsg(null);
    try {
      await onSaveTp({
        id: editingTpId,
        mapelId: activeSubject.id,
        tingkat: Number(tpTingkat),
        kode: tpKode,
        deskripsi: tpDeskripsi,
        levelMendalam: tpLevelMendalam,
        dimensiProfil: tpDimensiProfil,
      });
      setStatusMsg({
        type: 'ok',
        text: editingTpId
          ? `Tujuan Pembelajaran ${tpKode.toUpperCase()} (${tpLevelMendalam}) diperbarui.`
          : `Tujuan Pembelajaran ${tpKode.toUpperCase()} (${tpLevelMendalam}) ditambahkan ke ${activeSubject.nama}.`,
      });
      resetTpForm();
    } catch (err) {
      setStatusMsg({
        type: 'err',
        text:
          err instanceof Error
            ? err.message
            : 'Gagal menyimpan Tujuan Pembelajaran.',
      });
    } finally {
      setTpSaving(false);
    }
  };

  const handleDeleteTpClick = async (tp: TujuanPembelajaran) => {
    setStatusMsg(null);
    try {
      await onDeleteTp(tp.id);
      if (editingTpId === tp.id) resetTpForm();
      setStatusMsg({
        type: 'ok',
        text: `Tujuan Pembelajaran ${tp.kode} dihapus.`,
      });
    } catch (err) {
      setStatusMsg({
        type: 'err',
        text: err instanceof Error ? err.message : 'Gagal menghapus TP.',
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 border-b border-slate-200 pb-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">
            Pemetaan Pembelajaran Mendalam (2026), Guru Mapel &amp; TP
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Selaras Permendikdasmen No. 10 &amp; No. 13 Tahun 2025: pemetaan guru, KKTP, taksonomi Memahami–Mengaplikasi–Merefleksi, 8 Dimensi Profil Lulusan, dan Mapel Pilihan KKA.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {!readiness.kkaActive && (
            <button
              type="button"
              disabled={!isOnline || activatingKka}
              onClick={() => void handleActivateKkaClick()}
              className="inline-flex items-center gap-2 rounded-lg border border-blue-700 bg-white px-3.5 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-50 disabled:opacity-50 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Cpu className="h-4 w-4" aria-hidden="true" />
              <span>
                {activatingKka
                  ? 'Mengaktifkan KKA...'
                  : 'Aktifkan Mapel Pilihan KKA (2026)'}
              </span>
            </button>
          )}
          <button
            type="button"
            disabled={!isOnline}
            onClick={openAddSubjectModal}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-800 disabled:opacity-50 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            <span>Tambah Mapel / Mulok</span>
          </button>
        </div>
      </div>

      {/* Unboxed Deep Learning 2026 Alignment Strip */}
      <section
        aria-label="Ringkasan keselarasan Kurikulum Pembelajaran Mendalam 2026"
        className="grid grid-cols-1 gap-4 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-4"
      >
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Kurikulum Aktif
          </p>
          <p className="mt-1 text-xs font-bold text-slate-900">
            Pembelajaran Mendalam 2026
          </p>
          <p className="mt-0.5 text-[11px] text-slate-500">
            Berkesadaran · Bermakna · Menggembirakan
          </p>
        </div>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Cakupan TP Mendalam
          </p>
          <p className="mt-1 font-mono text-sm font-bold tabular-nums text-slate-900">
            {readiness.deepTpCount}/{readiness.totalTp} TP ({readiness.tpCoveragePct}%)
          </p>
          <p className="mt-0.5 font-mono text-[11px] tabular-nums text-slate-500">
            Memahami {readiness.byLevel.Memahami} · Mengaplikasi {readiness.byLevel.Mengaplikasi} · Merefleksi {readiness.byLevel.Merefleksi}
          </p>
        </div>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            8 Dimensi Profil Lulusan
          </p>
          <p className="mt-1 font-mono text-sm font-bold tabular-nums text-slate-900">
            Permendikdasmen 10/2025
          </p>
          <p className="mt-0.5 text-[11px] text-slate-500">
            Terintegrasi pada TP &amp; Kokurikuler
          </p>
        </div>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Mapel Pilihan KKA
          </p>
          <p
            className={`mt-1 text-xs font-bold ${
              readiness.kkaActive ? 'text-emerald-700' : 'text-amber-700'
            }`}
          >
            {readiness.kkaActive
              ? 'Aktif (Koding & Kecerdasan Artifisial)'
              : 'Belum Diaktifkan'}
          </p>
          <p className="mt-0.5 text-[11px] text-slate-500">
            Kepmendikdasmen No. 127/P/2025
          </p>
        </div>
      </section>

      {statusMsg && (
        <div
          role="status"
          className={`rounded-lg border px-4 py-2.5 text-xs ${
            statusMsg.type === 'ok'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
              : 'border-red-200 bg-red-50 text-red-900'
          }`}
        >
          {statusMsg.text}
        </div>
      )}

      {/* Section 1: Subject & Teacher Mapping */}
      <section className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3.5">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-blue-700" aria-hidden="true" />
            <h2 className="text-sm font-bold text-slate-900">
              Pemetaan Mata Pelajaran &amp; Guru Pengampu ({dataset.subjects.length})
            </h2>
          </div>
          <span className="text-xs text-slate-500">
            Jenjang {dataset.school.jenjang} · {dataset.school.kurikulum}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-slate-600">
                <th className="px-4 py-3 font-semibold">Kode</th>
                <th className="px-4 py-3 font-semibold">Mata Pelajaran</th>
                <th className="px-4 py-3 font-semibold">Kelompok</th>
                <th className="px-4 py-3 text-center font-semibold">KKTP</th>
                <th className="px-4 py-3 font-semibold">Guru Pengampu &amp; NIP</th>
                <th className="px-4 py-3 text-center font-semibold">Jumlah TP</th>
                <th className="px-4 py-3 text-right font-semibold">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {dataset.subjects.map((sub) => {
                const tpCount = dataset.tujuanPembelajaran.filter(
                  (t) => t.mapelId === sub.id
                ).length;
                return (
                  <tr key={sub.id} className="hover:bg-slate-50/70">
                    <td className="px-4 py-2.5 font-mono font-bold text-blue-700">
                      {sub.kode}
                    </td>
                    <td className="px-4 py-2.5 font-semibold text-slate-900">
                      {sub.nama}
                    </td>
                    <td className="px-4 py-2.5 text-slate-600">{sub.kelompok}</td>
                    <td className="px-4 py-2.5 text-center font-mono font-bold tabular-nums text-slate-900">
                      {sub.kkm}
                    </td>
                    <td className="px-4 py-2.5">
                      <p className="font-medium text-slate-900">{sub.guruPengampu}</p>
                      <p className="font-mono text-[11px] text-slate-500">
                        NIP {sub.nipGuru || '-'}
                      </p>
                    </td>
                    <td className="px-4 py-2.5 text-center font-mono tabular-nums text-slate-700">
                      {tpCount} TP
                    </td>
                    <td className="px-4 py-2.5 text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => openEditSubjectModal(sub)}
                        aria-label={`Ubah pemetaan ${sub.nama}`}
                        className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-slate-800 hover:bg-slate-50 cursor-pointer"
                      >
                        <Edit3 className="h-3 w-3" aria-hidden="true" />
                        <span>Ubah</span>
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Section 2: Tujuan Pembelajaran (TP) Manager */}
      <section className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="lg:col-span-5 rounded-xl border border-slate-200 bg-white p-5 space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-200 pb-3">
            <BookOpen className="h-4 w-4 text-blue-700" aria-hidden="true" />
            <h2 className="text-sm font-bold text-slate-900">
              {editingTpId
                ? 'Ubah Tujuan Pembelajaran'
                : 'Tambah Tujuan Pembelajaran (TP Mendalam)'}
            </h2>
          </div>

          <form onSubmit={(e) => void handleSubmitTp(e)} className="space-y-3.5">
            <div>
              <label htmlFor="tp-mapel-select" className="block text-xs font-semibold text-slate-700">
                Mata Pelajaran
              </label>
              <select
                id="tp-mapel-select"
                value={activeSubject?.id || ''}
                onChange={(e) => {
                  setSelectedMapelId(e.target.value);
                  resetTpForm();
                }}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-900"
              >
                {dataset.subjects.map((sub) => (
                  <option key={sub.id} value={sub.id}>
                    {sub.kode} · {sub.nama}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="tp-kode-input" className="block text-xs font-semibold text-slate-700">
                  Kode TP
                </label>
                <input
                  id="tp-kode-input"
                  type="text"
                  value={tpKode}
                  onChange={(e) => setTpKode(e.target.value)}
                  placeholder={`Contoh: TP-${activeSubject?.kode || 'MTK'}-03`}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
                />
              </div>
              <div>
                <label htmlFor="tp-tingkat-input" className="block text-xs font-semibold text-slate-700">
                  Tingkat / Kelas
                </label>
                <input
                  id="tp-tingkat-input"
                  type="number"
                  min={1}
                  max={12}
                  value={tpTingkat}
                  onChange={(e) => setTpTingkat(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label htmlFor="tp-level-select" className="block text-xs font-semibold text-slate-700">
                Tahap Pengalaman Belajar Mendalam
              </label>
              <select
                id="tp-level-select"
                value={tpLevelMendalam}
                onChange={(e) =>
                  setTpLevelMendalam(e.target.value as DeepLearningLevel)
                }
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-900"
              >
                <option value="Memahami">
                  Memahami (Konstruksi Pengetahuan Esensial)
                </option>
                <option value="Mengaplikasi">
                  Mengaplikasi (Kontekstual &amp; Pemecahan Masalah)
                </option>
                <option value="Merefleksi">
                  Merefleksi (Evaluasi Diri, Etika &amp; Makna)
                </option>
              </select>
            </div>

            <div>
              <label htmlFor="tp-desc-input" className="block text-xs font-semibold text-slate-700">
                Deskripsi Capaian Kompetensi TP
              </label>
              <textarea
                id="tp-desc-input"
                rows={3}
                value={tpDeskripsi}
                onChange={(e) => setTpDeskripsi(e.target.value)}
                placeholder="Contoh: Menerapkan operasi pecahan untuk menyelesaikan masalah belanja sehari-hari secara kritis"
                className="mt-1 w-full rounded-lg border border-slate-300 p-3 text-xs leading-relaxed text-slate-900 focus:border-blue-600 focus:outline-none"
              />
            </div>

            <div>
              <p className="text-xs font-semibold text-slate-700">
                Keterkaitan 8 Dimensi Profil Lulusan (2025/2026)
              </p>
              <div className="mt-1.5 grid grid-cols-1 gap-1.5 sm:grid-cols-2 rounded-lg border border-slate-200 bg-slate-50/70 p-2.5">
                {DELAPAN_DIMENSI_PROFIL_LULUSAN.map((dim) => (
                  <label
                    key={dim}
                    className="inline-flex items-start gap-2 text-[11px] text-slate-700 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={tpDimensiProfil.includes(dim)}
                      onChange={() => toggleTpDimensi(dim)}
                      className="mt-0.5 shrink-0"
                    />
                    <span className="leading-tight">{dim}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2">
              {editingTpId && (
                <button
                  type="button"
                  onClick={resetTpForm}
                  className="rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  Batal Edit
                </button>
              )}
              <button
                type="submit"
                disabled={tpSaving || !isOnline}
                className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50 cursor-pointer"
              >
                <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                <span>
                  {tpSaving
                    ? 'Menyimpan...'
                    : editingTpId
                      ? 'Simpan Perubahan TP'
                      : 'Tambahkan TP'}
                </span>
              </button>
            </div>
          </form>
        </div>

        <div className="lg:col-span-7 rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between border-b border-slate-200 pb-3">
            <h2 className="text-sm font-bold text-slate-900">
              Daftar Tujuan Pembelajaran · {activeSubject?.nama || '-'} ({tpsForSelectedSubject.length})
            </h2>
          </div>

          <div className="mt-4 space-y-2.5">
            {tpsForSelectedSubject.length === 0 ? (
              <p className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-6 text-center text-xs text-slate-500">
                Belum ada Tujuan Pembelajaran untuk mata pelajaran ini. Tambahkan TP pertama di formulir sebelah kiri agar otomatis muncul saat guru mengisi nilai.
              </p>
            ) : (
              tpsForSelectedSubject.map((tp) => (
                <div
                  key={tp.id}
                  className="flex items-start justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50/70 p-3.5 text-xs"
                >
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-900">
                      <span className="font-mono text-blue-700">{tp.kode}</span> · Kelas {tp.tingkat}
                      {tp.levelMendalam && (
                        <>
                          <span aria-hidden="true"> · </span>
                          <span className="text-slate-700">{tp.levelMendalam}</span>
                        </>
                      )}
                    </p>
                    <p className="mt-1 leading-relaxed text-slate-700">{tp.deskripsi}</p>
                    {tp.dimensiProfil && tp.dimensiProfil.length > 0 && (
                      <p className="mt-1 text-[11px] text-slate-500">
                        Dimensi: {tp.dimensiProfil.join(' · ')}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleEditTpClick(tp)}
                      aria-label={`Ubah ${tp.kode}`}
                      className="rounded-md p-1.5 text-slate-500 hover:bg-white hover:text-blue-700 cursor-pointer"
                    >
                      <Edit3 className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleDeleteTpClick(tp)}
                      aria-label={`Hapus ${tp.kode}`}
                      className="rounded-md p-1.5 text-slate-500 hover:bg-red-50 hover:text-red-700 cursor-pointer"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </section>

      {subjectModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-subject-map-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
        >
          <div className="w-full max-w-lg rounded-xl border border-slate-200 bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <h2 id="modal-subject-map-title" className="text-sm font-bold text-slate-900">
                {editingSubjectId
                  ? 'Ubah Pemetaan Mata Pelajaran & Guru'
                  : 'Tambah Mata Pelajaran / Muatan Lokal'}
              </h2>
              <button
                type="button"
                onClick={() => setSubjectModalOpen(false)}
                aria-label="Tutup modal pemetaan mata pelajaran"
                className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={(e) => void handleSubmitSubjectModal(e)} className="space-y-4 p-5">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div>
                  <label htmlFor="sub-kode" className="block text-xs font-semibold text-slate-700">
                    Kode Mapel
                  </label>
                  <input
                    id="sub-kode"
                    type="text"
                    value={subKode}
                    onChange={(e) => setSubKode(e.target.value)}
                    placeholder="Contoh: BING"
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label htmlFor="sub-nama" className="block text-xs font-semibold text-slate-700">
                    Nama Mata Pelajaran
                  </label>
                  <input
                    id="sub-nama"
                    type="text"
                    value={subNama}
                    onChange={(e) => setSubNama(e.target.value)}
                    placeholder="Contoh: Bahasa Inggris"
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label htmlFor="sub-kelompok" className="block text-xs font-semibold text-slate-700">
                    Kelompok Mapel
                  </label>
                  <select
                    id="sub-kelompok"
                    value={subKelompok}
                    onChange={(e) =>
                      setSubKelompok(e.target.value as DapodikSubject['kelompok'])
                    }
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900"
                  >
                    <option value="Umum">Umum (Wajib)</option>
                    <option value="Muatan Lokal">Muatan Lokal</option>
                    <option value="Pilihan">Pilihan / Kejuruan</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="sub-kkm" className="block text-xs font-semibold text-slate-700">
                    KKTP (50–95)
                  </label>
                  <input
                    id="sub-kkm"
                    type="number"
                    min={50}
                    max={95}
                    value={subKkm}
                    onChange={(e) => setSubKkm(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-xs font-bold text-slate-900 focus:border-blue-600 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label htmlFor="sub-guru" className="block text-xs font-semibold text-slate-700">
                    Nama Guru Pengampu
                  </label>
                  <input
                    id="sub-guru"
                    type="text"
                    value={subGuru}
                    onChange={(e) => setSubGuru(e.target.value)}
                    placeholder="Contoh: Ni Wayan Lestari, S.Pd."
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label htmlFor="sub-nip" className="block text-xs font-semibold text-slate-700">
                    NIP Guru (Opsional)
                  </label>
                  <input
                    id="sub-nip"
                    type="text"
                    value={subNip}
                    onChange={(e) => setSubNip(e.target.value)}
                    placeholder="-"
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
                  />
                </div>
              </div>

              {subError && (
                <div
                  role="alert"
                  className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2 text-xs text-red-800"
                >
                  {subError}
                </div>
              )}

              <div className="flex items-center justify-end gap-2.5 border-t border-slate-200 pt-3">
                <button
                  type="button"
                  onClick={() => setSubjectModalOpen(false)}
                  className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={subSaving}
                  className="rounded-lg bg-blue-700 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-800 disabled:opacity-50 cursor-pointer"
                >
                  {subSaving ? 'Menyimpan...' : 'Simpan Pemetaan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
