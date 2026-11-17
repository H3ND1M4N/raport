import React, { useState } from 'react';
import {
  CheckCircle2,
  Download,
  FileUp,
  PlusCircle,
  ShieldAlert,
  Wifi,
} from 'lucide-react';
import { parseDapodikSpreadsheetBuffer } from '../lib/dapodikExcel';
import {
  normalizeNpsnInput,
  parseDapodikImportText,
  safeParseJsonResponse,
  type DapodikIncomingPayload,
  type EraporDataset,
  type KurikulumType,
  type SchoolJenjang,
} from '../lib/eraporCore';

export interface RegisterSchoolInput {
  npsn: string;
  namaSekolah: string;
  jenjang: SchoolJenjang;
  sourceHost: string;
  token: string;
  alamat: string;
  kabupaten: string;
  provinsi: string;
  kepalaSekolah: string;
  nipKepalaSekolah: string;
  semesterLabel: string;
  kurikulum: KurikulumType;
  mode: 'live_dapodik' | 'import_json' | 'clean_template';
  importJson?: DapodikIncomingPayload;
}

interface SchoolProfileSyncViewProps {
  dataset: EraporDataset;
  isOnline: boolean;
  onRegisterSchool: (input: RegisterSchoolInput) => Promise<void>;
  onTestConnection: (params: {
    hostUrl: string;
    npsn: string;
    token: string;
  }) => Promise<{
    reachable: boolean;
    detectedSchoolName?: string;
    rombelCount?: number;
    studentCount?: number;
    error?: string;
  }>;
}

export const SchoolProfileSyncView: React.FC<SchoolProfileSyncViewProps> = ({
  dataset,
  isOnline,
  onRegisterSchool,
  onTestConnection,
}) => {
  const [namaSekolah, setNamaSekolah] = useState('');
  const [npsn, setNpsn] = useState('');
  const [jenjang, setJenjang] = useState<SchoolJenjang>('SMP');
  const [sourceHost, setSourceHost] = useState('http://localhost:5774/WebService');
  const [token, setToken] = useState('');
  const [kepalaSekolah, setKepalaSekolah] = useState('');
  const [nipKepalaSekolah, setNipKepalaSekolah] = useState('');
  const [kabupaten, setKabupaten] = useState('');
  const [provinsi, setProvinsi] = useState('');
  const [alamat, setAlamat] = useState('');
  const [kurikulum, setKurikulum] = useState<KurikulumType>('Kurikulum Merdeka');
  const [semesterLabel, setSemesterLabel] = useState('2025/2026 Ganjil');
  const [mode, setMode] = useState<'live_dapodik' | 'import_json' | 'clean_template'>(
    'clean_template'
  );
  const [importJsonText, setImportJsonText] = useState('');
  const [importFileName, setImportFileName] = useState<string | null>(null);
  const [importParsedExcel, setImportParsedExcel] = useState<DapodikIncomingPayload | null>(null);

  const [testingConn, setTestingConn] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(
    null
  );

  const handleTestConn = async () => {
    setTestingConn(true);
    setStatusMsg(null);
    try {
      const res = await onTestConnection({
        hostUrl: sourceHost,
        npsn: npsn || dataset.school.npsn,
        token,
      });
      if (res.reachable) {
        setStatusMsg({
          type: 'ok',
          text: `Koneksi Read-Only Dapodik berhasil: ${res.detectedSchoolName} (${res.rombelCount ?? 0} rombel, ${res.studentCount ?? 0} peserta didik).`,
        });
      } else {
        setStatusMsg({
          type: 'err',
          text: res.error || 'WebService Dapodik tidak terjangkau.',
        });
      }
    } catch (err) {
      setStatusMsg({
        type: 'err',
        text: err instanceof Error ? err.message : 'Gagal menguji koneksi Dapodik.',
      });
    } finally {
      setTestingConn(false);
    }
  };

  const handleUploadImportJson = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const lower = file.name.toLowerCase();
      if (lower.endsWith('.xlsx') || lower.endsWith('.xls')) {
        const buffer = await file.arrayBuffer();
        const parsed = parseDapodikSpreadsheetBuffer(buffer, {
          npsn: npsn.trim() || dataset.school.npsn,
          namaSekolah: namaSekolah.trim() || dataset.school.namaSekolah,
          kurikulum,
        });
        setImportParsedExcel(parsed);
        setImportJsonText(JSON.stringify(parsed, null, 2));
      } else {
        const text = await file.text();
        setImportParsedExcel(null);
        setImportJsonText(text);
      }
      setImportFileName(file.name);
      setMode('import_json');
      setStatusMsg({
        type: 'ok',
        text: `Berkas "${file.name}" siap diimpor untuk sekolah baru.`,
      });
    } catch (err) {
      setStatusMsg({
        type: 'err',
        text:
          err instanceof Error
            ? err.message
            : 'Gagal membaca berkas Excel/CSV/JSON Dapodik.',
      });
    } finally {
      e.target.value = '';
    }
  };

  const handleDownloadSampleJson = () => {
    const sampleNpsn = /^\d{8}$/.test(npsn.trim()) ? npsn.trim() : '50103122';
    const sampleNama = namaSekolah.trim() || 'SMP Negeri 2 Denpasar';
    const sampleTingkat = jenjang === 'SD' ? 6 : jenjang === 'SMP' ? 7 : 10;
    const sampleFase = jenjang === 'SD' ? 'Fase C' : jenjang === 'SMP' ? 'Fase D' : 'Fase E';

    const template = {
      school: {
        npsn: sampleNpsn,
        namaSekolah: sampleNama,
        jenjang,
        alamat: alamat.trim() || 'Jl. Pendidikan No. 1',
      },
      rombels: [
        {
          id: `rombel-${sampleNpsn}-a`,
          dapodikRombelId: `RB-${sampleNpsn}-A`,
          nama: jenjang === 'SD' ? 'Kelas 6A' : jenjang === 'SMP' ? 'Kelas VII A' : 'Kelas X A',
          tingkat: sampleTingkat,
          fase: sampleFase,
          waliKelasId: `PTK-${sampleNpsn}-01`,
          waliKelasNama: 'I Made Suardika, S.Pd.',
          waliKelasNip: '198405122010011009',
          kurikulum,
        },
      ],
      students: [
        {
          id: `std-${sampleNpsn}-001`,
          pesertaDidikId: `PD-${sampleNpsn}-001`,
          nisn: '0124567801',
          nipd: '25001',
          nama: 'Putu Aditya Mahendra',
          jenisKelamin: 'L',
          tempatLahir: kabupaten.trim() || 'Denpasar',
          tanggalLahir: '2012-06-15',
          agama: 'Hindu',
          rombelId: `rombel-${sampleNpsn}-a`,
          namaOrangTua: 'Made Mahendra',
          alamat: 'Jl. Melati No. 12',
          statusAktif: 'Aktif',
        },
      ],
    };

    const blob = new Blob([JSON.stringify(template, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Template-Dapodik-${sampleNpsn}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setStatusMsg(null);
    try {
      let parsedImport: DapodikIncomingPayload | undefined;
      if (mode === 'import_json') {
        if (importParsedExcel) {
          parsedImport = importParsedExcel;
        } else {
          if (!importJsonText.trim()) {
            throw new Error(
              'Silakan pilih file Excel (.xlsx/.csv) atau JSON Dapodik terlebih dahulu.'
            );
          }
          parsedImport = parseDapodikImportText(importJsonText, {
            npsn: npsn.trim() || dataset.school.npsn,
            namaSekolah: namaSekolah.trim() || dataset.school.namaSekolah,
            kurikulum,
          });
        }
      }

      await onRegisterSchool({
        npsn,
        namaSekolah,
        jenjang,
        sourceHost,
        token,
        alamat,
        kabupaten,
        provinsi,
        kepalaSekolah,
        nipKepalaSekolah,
        semesterLabel,
        kurikulum,
        mode,
        importJson: parsedImport,
      });

      setStatusMsg({
        type: 'ok',
        text: `Sekolah "${namaSekolah.trim()}" (NPSN ${npsn.trim()}) berhasil didaftarkan ke brankas terisolasi & diaktifkan.`,
      });
      setNamaSekolah('');
      setNpsn('');
      setToken('');
      setImportJsonText('');
      setImportParsedExcel(null);
      setImportFileName(null);
    } catch (err) {
      setStatusMsg({
        type: 'err',
        text: err instanceof Error ? err.message : 'Gagal mendaftarkan profil sekolah.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 border-b border-slate-200 pb-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">
            Profil & Sinkronisasi Dapodik Sekolah Lain (Multi-Sekolah)
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Setiap sekolah dapat mendaftarkan NPSN dan alamat WebService Dapodik-nya sendiri. Seluruh nilai dan data peserta didik disimpan dalam brankas terenkripsi AES-256-GCM terpisah per NPSN.
          </p>
        </div>

        <button
          type="button"
          onClick={handleDownloadSampleJson}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50 whitespace-nowrap shrink-0 cursor-pointer"
        >
          <Download className="h-3.5 w-3.5 text-blue-700" aria-hidden="true" />
          <span>Unduh Contoh JSON Dapodik</span>
        </button>
      </div>

      {statusMsg && (
        <div
          role="status"
          className={`flex items-start gap-2 rounded-lg border px-4 py-3 text-xs ${
            statusMsg.type === 'ok'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
              : 'border-red-200 bg-red-50 text-red-900'
          }`}
        >
          {statusMsg.type === 'ok' ? (
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" aria-hidden="true" />
          ) : (
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-red-700" aria-hidden="true" />
          )}
          <span>{statusMsg.text}</span>
        </div>
      )}

      {/* Register & Connect Another School Form */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <section className="lg:col-span-2 rounded-xl border border-slate-200 bg-white p-6">
          <div className="flex items-center gap-2 border-b border-slate-200 pb-3">
            <PlusCircle className="h-4 w-4 text-blue-700" aria-hidden="true" />
            <h2 className="text-sm font-bold text-slate-900">
              Daftarkan & Hubungkan Sekolah Baru ke Dapodik Sendiri
            </h2>
          </div>

          <form onSubmit={(e) => void handleSubmit(e)} className="mt-4 space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="sm:col-span-2">
                <label htmlFor="new-school-name" className="block text-xs font-semibold text-slate-700">
                  Nama Sekolah *
                </label>
                <input
                  id="new-school-name"
                  type="text"
                  required
                  value={namaSekolah}
                  onChange={(e) => setNamaSekolah(e.target.value)}
                  placeholder="Contoh: SMP Negeri 2 Denpasar"
                  className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
                />
              </div>

              <div>
                <label htmlFor="new-school-npsn" className="block text-xs font-semibold text-slate-700">
                  NPSN (8 Digit Angka) *
                </label>
                <input
                  id="new-school-npsn"
                  type="text"
                  inputMode="numeric"
                  required
                  maxLength={8}
                  value={npsn}
                  onChange={(e) => {
                    const clean = normalizeNpsnInput(e.target.value);
                    setNpsn(clean);
                    if (clean.length === 8 && isOnline) {
                      void fetch(`/api/dapodik/lookup-npsn?npsn=${encodeURIComponent(clean)}`)
                        .then((r) =>
                          safeParseJsonResponse<{
                            ok?: boolean;
                            school?: {
                              namaSekolah?: string;
                              jenjang?: SchoolJenjang;
                              alamat?: string;
                              kabupaten?: string;
                              provinsi?: string;
                            };
                          }>(r, 'api')
                        )
                        .then((res) => {
                          if (res.ok && res.school?.namaSekolah && !res.school.namaSekolah.startsWith('Sekolah NPSN')) {
                            setNamaSekolah((prev) => prev || res.school!.namaSekolah || '');
                            if (res.school.jenjang) setJenjang(res.school.jenjang);
                            if (res.school.alamat) setAlamat((prev) => prev || res.school!.alamat || '');
                            if (res.school.kabupaten) setKabupaten((prev) => prev || res.school!.kabupaten || '');
                            if (res.school.provinsi) setProvinsi((prev) => prev || res.school!.provinsi || '');
                          }
                        })
                        .catch(() => undefined);
                    }
                  }}
                  placeholder="50103122"
                  className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-xs tabular-nums tracking-wider text-slate-900 focus:border-blue-600 focus:outline-none"
                />
              </div>

              <div>
                <label htmlFor="new-school-jenjang" className="block text-xs font-semibold text-slate-700">
                  Jenjang Sekolah
                </label>
                <select
                  id="new-school-jenjang"
                  value={jenjang}
                  onChange={(e) => setJenjang(e.target.value as SchoolJenjang)}
                  className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-900"
                >
                  <option value="SD">SD / Sederajat</option>
                  <option value="SMP">SMP / Sederajat</option>
                  <option value="SMA">SMA / Sederajat</option>
                  <option value="SMK">SMK / Sederajat</option>
                </select>
              </div>

              <div className="sm:col-span-2">
                <label htmlFor="new-school-token" className="block text-xs font-semibold text-slate-700">
                  Token WebService Dapodik (Opsional, bisa diisi nanti)
                </label>
                <input
                  id="new-school-token"
                  type="password"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  placeholder="Tempel Token dari Dapodik menu Pengaturan -> WebService..."
                  className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-xs text-slate-900"
                />
              </div>
            </div>

            <details className="rounded-lg border border-slate-200 bg-slate-50/70 p-3.5">
              <summary className="cursor-pointer text-xs font-semibold text-slate-700">
                Lengkapi Detail Kepala Sekolah, Alamat &amp; Pengaturan Lanjutan (Opsional)
              </summary>

              <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div>
                  <label htmlFor="new-school-kurikulum" className="block text-xs font-semibold text-slate-700">
                    Kurikulum
                  </label>
                  <select
                    id="new-school-kurikulum"
                    value={kurikulum}
                    onChange={(e) => setKurikulum(e.target.value as KurikulumType)}
                    className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-900"
                  >
                    <option value="Kurikulum Merdeka">Kurikulum Merdeka</option>
                    <option value="Kurikulum 2013">Kurikulum 2013</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="new-school-semester" className="block text-xs font-semibold text-slate-700">
                    Tahun Ajaran / Semester
                  </label>
                  <input
                    id="new-school-semester"
                    type="text"
                    value={semesterLabel}
                    onChange={(e) => setSemesterLabel(e.target.value)}
                    className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900"
                  />
                </div>

                <div>
                  <label htmlFor="new-school-host" className="block text-xs font-semibold text-slate-700">
                    Alamat WebService Dapodik
                  </label>
                  <input
                    id="new-school-host"
                    type="text"
                    value={sourceHost}
                    onChange={(e) => setSourceHost(e.target.value)}
                    placeholder="http://localhost:5774/WebService"
                    className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-xs text-slate-900"
                  />
                </div>

                <div>
                  <label htmlFor="new-school-kepsek" className="block text-xs font-semibold text-slate-700">
                    Nama Kepala Sekolah
                  </label>
                  <input
                    id="new-school-kepsek"
                    type="text"
                    value={kepalaSekolah}
                    onChange={(e) => setKepalaSekolah(e.target.value)}
                    placeholder="Nama lengkap & gelar"
                    className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900"
                  />
                </div>

                <div>
                  <label htmlFor="new-school-nip" className="block text-xs font-semibold text-slate-700">
                    NIP Kepala Sekolah
                  </label>
                  <input
                    id="new-school-nip"
                    type="text"
                    value={nipKepalaSekolah}
                    onChange={(e) => setNipKepalaSekolah(e.target.value)}
                    placeholder="197203..."
                    className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-xs text-slate-900"
                  />
                </div>

                <div>
                  <label htmlFor="new-school-kab" className="block text-xs font-semibold text-slate-700">
                    Kabupaten / Kota
                  </label>
                  <input
                    id="new-school-kab"
                    type="text"
                    value={kabupaten}
                    onChange={(e) => setKabupaten(e.target.value)}
                    placeholder="Contoh: Kota Denpasar"
                    className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900"
                  />
                </div>

                <div>
                  <label htmlFor="new-school-prov" className="block text-xs font-semibold text-slate-700">
                    Provinsi
                  </label>
                  <input
                    id="new-school-prov"
                    type="text"
                    value={provinsi}
                    onChange={(e) => setProvinsi(e.target.value)}
                    placeholder="Contoh: Bali"
                    className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label htmlFor="new-school-alamat" className="block text-xs font-semibold text-slate-700">
                    Alamat Sekolah
                  </label>
                  <input
                    id="new-school-alamat"
                    type="text"
                    value={alamat}
                    onChange={(e) => setAlamat(e.target.value)}
                    placeholder="Jalan / Desa / Kecamatan"
                    className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900"
                  />
                </div>
              </div>

              {/* Initial Sync Mode */}
              <div className="mt-4 border-t border-slate-200 pt-3 space-y-2.5">
                <p className="text-xs font-bold text-slate-900">
                  Cara Mengisi Data Siswa Awal
                </p>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                  <label className="flex items-start gap-2 rounded-lg border border-slate-200 bg-white p-2.5 text-xs cursor-pointer">
                    <input
                      type="radio"
                      name="sync-init-mode"
                      checked={mode === 'clean_template'}
                      onChange={() => setMode('clean_template')}
                      className="mt-0.5"
                    />
                    <span>
                      <strong className="block text-slate-900">Buat Profil Sekolah Dulu</strong>
                      <span className="text-slate-500">Sambungkan Dapodik setelahnya</span>
                    </span>
                  </label>

                  <label className="flex items-start gap-2 rounded-lg border border-slate-200 bg-white p-2.5 text-xs cursor-pointer">
                    <input
                      type="radio"
                      name="sync-init-mode"
                      checked={mode === 'live_dapodik'}
                      onChange={() => setMode('live_dapodik')}
                      className="mt-0.5"
                    />
                    <span>
                      <strong className="block text-slate-900">Tarik Langsung Sekarang</strong>
                      <span className="text-slate-500">Jika WebService sudah online</span>
                    </span>
                  </label>

                  <label className="flex items-start gap-2 rounded-lg border border-slate-200 bg-white p-2.5 text-xs cursor-pointer">
                    <input
                      type="radio"
                      name="sync-init-mode"
                      checked={mode === 'import_json'}
                      onChange={() => setMode('import_json')}
                      className="mt-0.5"
                    />
                    <span>
                      <strong className="block text-slate-900">Upload Excel / CSV / JSON</strong>
                      <span className="text-slate-500">Unggah unduhan peserta didik Dapodik</span>
                    </span>
                  </label>
                </div>

                {mode === 'import_json' && (
                  <div className="space-y-2 pt-1">
                    <div className="flex flex-wrap items-center gap-3">
                      <label className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-100 cursor-pointer">
                        <FileUp className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>Pilih File Excel (.xlsx / .csv / .json)</span>
                        <input
                          type="file"
                          accept=".xlsx,.xls,.csv,.txt,.json,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv,application/json"
                          onChange={(e) => void handleUploadImportJson(e)}
                          className="sr-only"
                        />
                      </label>
                      {importFileName && (
                        <span className="font-mono text-xs text-emerald-700">
                          Berkas: {importFileName}
                        </span>
                      )}
                    </div>
                    <label htmlFor="import-json-raw" className="sr-only">
                      Isi Excel/CSV/JSON Dapodik
                    </label>
                    <textarea
                      id="import-json-raw"
                      rows={3}
                      value={importJsonText}
                      onChange={(e) => {
                        setImportParsedExcel(null);
                        setImportJsonText(e.target.value);
                      }}
                      placeholder='Atau tempel salinan tabel dari Excel / CSV / JSON Dapodik di sini...'
                      className="w-full rounded-lg border border-slate-300 bg-white p-2.5 font-mono text-[11px] text-slate-800"
                    />
                  </div>
                )}

                <button
                  type="button"
                  disabled={testingConn || !isOnline}
                  onClick={() => void handleTestConn()}
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-50 cursor-pointer"
                >
                  <Wifi className="h-3.5 w-3.5 text-blue-700" aria-hidden="true" />
                  <span>{testingConn ? 'Menguji...' : 'Tes Koneksi Dapodik Sekarang'}</span>
                </button>
              </div>
            </details>

            <div className="flex flex-wrap items-center gap-3 pt-1">
              <button
                type="submit"
                disabled={submitting || !isOnline}
                className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-5 py-2.5 text-xs font-semibold text-white hover:bg-blue-800 disabled:opacity-50 cursor-pointer"
              >
                <PlusCircle className="h-4 w-4" aria-hidden="true" />
                <span>{submitting ? 'Menyimpan...' : 'Simpan & Aktifkan Sekolah'}</span>
              </button>
            </div>
          </form>
        </section>

        {/* Step-by-Step Guide for Other Schools */}
        <aside className="rounded-xl border border-slate-200 bg-white p-6 space-y-4">
          <h2 className="text-sm font-bold text-slate-900">
            Panduan Koneksi Dapodik Sekolah Lain
          </h2>
          <ol className="space-y-3 text-xs text-slate-600 leading-relaxed">
            <li>
              <strong className="block text-slate-900">1. Buka Aplikasi Dapodik Sekolah</strong>
              Masuk sebagai Operator Sekolah di Dapodik, lalu buka menu{' '}
              <span className="font-semibold text-slate-800">Pengaturan &rarr; WebService</span>.
            </li>
            <li>
              <strong className="block text-slate-900">2. Buat Koneksi Aplikasi e-Rapor</strong>
              Tambahkan aplikasi baru dan salin <strong>Token</strong> serta catat IP komputer server Dapodik (contoh:{' '}
              <code className="font-mono text-slate-800">http://192.168.1.10:5774/WebService</code>).
            </li>
            <li>
              <strong className="block text-slate-900">3. Jaminan Aman & Terisolasi</strong>
              e-Rapor hanya memakai permintaan <code className="font-mono text-slate-800">GET</code> sehingga database Dapodik Anda tidak akan pernah berubah. Setiap NPSN memiliki file brankas terenkripsi AES-256-GCM sendiri.
            </li>
          </ol>
        </aside>
      </div>
    </div>
  );
};
