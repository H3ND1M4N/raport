export type KurikulumType =
  | 'Kurikulum Merdeka'
  | 'Kurikulum Merdeka (Pembelajaran Mendalam 2026)'
  | 'Kurikulum 2013';
export type PredikatType = 'A' | 'B' | 'C' | 'D';
export type P5CapaianType = 'Berkembang' | 'Cakap' | 'Mahir' | 'BB' | 'MB' | 'BSH' | 'SB';
export type UserRole = 'guru' | 'kepala_sekolah' | 'operator';

export const DELAPAN_DIMENSI_PROFIL_LULUSAN = [
  'Keimanan dan Ketakwaan terhadap Tuhan YME',
  'Kewargaan',
  'Penalaran Kritis',
  'Kreativitas',
  'Kolaborasi',
  'Kemandirian',
  'Kesehatan',
  'Komunikasi',
] as const;

export type DimensiProfilLulusan = (typeof DELAPAN_DIMENSI_PROFIL_LULUSAN)[number];
export type DeepLearningLevel = 'Memahami' | 'Mengaplikasi' | 'Merefleksi';
export type DeepLearningPrinsip = 'Berkesadaran' | 'Bermakna' | 'Menggembirakan';
export type KokurikulerBentukType =
  | 'Lintas Disiplin Ilmu'
  | 'Kebiasaan Anak Indonesia Hebat'
  | 'Projek Kontekstual Sekolah';

export interface DapodikSchool {
  npsn: string;
  namaSekolah: string;
  jenjang: 'SD' | 'SMP' | 'SMA' | 'SMK';
  alamat: string;
  kelurahan: string;
  kecamatan: string;
  kabupaten: string;
  provinsi: string;
  kepalaSekolah: string;
  nipKepalaSekolah: string;
  semesterId: string;
  semesterLabel: string;
  tahunAjaran: string;
  kurikulum: KurikulumType;
  dapodikVersion: string;
  sourceHost: string;
  lastSyncAt: string;
  readOnlyVerified: boolean;
  checksumSha256: string;
}

export interface DapodikRombel {
  id: string;
  dapodikRombelId: string;
  nama: string;
  tingkat: number;
  fase: string;
  waliKelasId: string;
  waliKelasNama: string;
  waliKelasNip: string;
  kurikulum: KurikulumType;
}

export interface DapodikStudent {
  id: string;
  pesertaDidikId: string;
  nisn: string;
  nipd: string;
  nama: string;
  jenisKelamin: 'L' | 'P';
  tempatLahir: string;
  tanggalLahir: string;
  agama: string;
  rombelId: string;
  namaOrangTua: string;
  alamat: string;
  statusAktif: 'Aktif' | 'Mutasi' | 'Lulus';
}

export interface DapodikSubject {
  id: string;
  kode: string;
  nama: string;
  kelompok: 'Umum' | 'Muatan Lokal' | 'Pilihan';
  kkm: number;
  tingkatList: number[];
  guruPengampu: string;
  nipGuru: string;
}

export interface TujuanPembelajaran {
  id: string;
  mapelId: string;
  tingkat: number;
  kode: string;
  deskripsi: string;
  levelMendalam?: DeepLearningLevel;
  dimensiProfil?: string[];
}

export interface StudentGradeRecord {
  id: string;
  studentId: string;
  mapelId: string;
  rombelId: string;
  semesterId: string;
  sumatifLingkup: number[];
  sumatifAkhirSemester: number | null;
  tpTercapaiIds: string[];
  tpPerluBimbinganIds: string[];
  nilaiAkhir: number;
  predikat: PredikatType;
  deskripsiCapaian: string;
  customDeskripsi: boolean;
  updatedAt: string;
  updatedBy: string;
  syncStatus: 'synced' | 'pending';
}

export interface EkskulEntry {
  nama: string;
  predikat: 'Sangat Baik' | 'Baik' | 'Cukup';
  keterangan: string;
}

export interface P5Entry {
  tema: string;
  dimensi: string;
  capaian: P5CapaianType;
  catatan: string;
  bentukKegiatan?: KokurikulerBentukType;
  dimensiList?: string[];
  prinsipDeepLearning?: DeepLearningPrinsip[];
}

export interface WaliKelasRecord {
  id: string;
  studentId: string;
  rombelId: string;
  semesterId: string;
  sakit: number;
  izin: number;
  tanpaKeterangan: number;
  ekstrakurikuler: EkskulEntry[];
  kokurikulerP5: P5Entry[];
  catatanWali: string;
  keputusanNaik: 'Naik Kelas' | 'Tinggal Kelas' | 'Lulus' | 'Proses';
  updatedAt: string;
  syncStatus: 'synced' | 'pending';
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  actor: string;
  action: string;
  target: string;
  readOnlyGuardPassed: boolean;
  integrityHash: string;
}

export type AuthRole = 'guru' | 'operator';

export interface AuthUserAccount {
  username: string;
  role: AuthRole;
  displayName: string;
  nip: string;
  schoolNpsn: string;
  assignedRombelId?: string;
}

export type GuruSubmissionStatus =
  | 'menunggu_operator'
  | 'tersinkron_dapodik'
  | 'dicetak_rapor';

export interface GuruSubmission {
  id: string;
  schoolNpsn: string;
  rombelId: string;
  rombelNama: string;
  submittedBy: string;
  submittedByNip: string;
  submittedAt: string;
  gradesCount: number;
  waliCount: number;
  studentCount: number;
  completionPct: number;
  notes?: string;
  status: GuruSubmissionStatus;
  operatorActionBy?: string;
  operatorActionAt?: string;
  dapodikSyncVerified?: boolean;
}

export interface EraporDataset {
  school: DapodikSchool;
  rombels: DapodikRombel[];
  students: DapodikStudent[];
  subjects: DapodikSubject[];
  tujuanPembelajaran: TujuanPembelajaran[];
  grades: StudentGradeRecord[];
  waliRecords: WaliKelasRecord[];
  auditLogs: AuditLogEntry[];
  submissions?: GuruSubmission[];
}

export interface DapodikIncomingPayload {
  school?: Partial<DapodikSchool>;
  rombels?: DapodikRombel[];
  students?: DapodikStudent[];
  sourceHost?: string;
}

export type SchoolJenjang = 'SD' | 'SMP' | 'SMA' | 'SMK';

export interface SchoolProfileSummary {
  npsn: string;
  namaSekolah: string;
  jenjang: SchoolJenjang;
  kabupaten: string;
  provinsi: string;
  kepalaSekolah: string;
  sourceHost: string;
  kurikulum: KurikulumType;
  semesterLabel: string;
  studentCount: number;
  rombelCount: number;
  lastSyncAt: string;
  checksumSha256: string;
}

export interface DapodikSyncDiff {
  addedStudents: number;
  updatedStudents: number;
  movedRombelStudents: number;
  removedStudents: number;
  unchangedStudents: number;
  addedRombels: number;
  updatedRombels: number;
  readOnlyVerified: true;
  syncedAt: string;
  checksumSha256: string;
}

export const READ_ONLY_DAPODIK_ENDPOINTS = [
  '/WebService/getSekolah',
  '/WebService/getRombonganBelajar',
  '/WebService/getPesertaDidik',
  '/WebService/getGtk',
  '/WebService/getPengguna',
] as const;

export function assertDapodikReadOnlyMethod(httpMethod: string, targetUrl: string): void {
  const normalizedMethod = httpMethod.trim().toUpperCase();
  if (normalizedMethod !== 'GET') {
    throw new Error(
      `READ_ONLY_VIOLATION: Operasi ${normalizedMethod} ke Dapodik (${targetUrl}) ditolak. e-Rapor hanya mengizinkan akses GET (read-only) agar data Dapodik sekolah tidak pernah berubah.`
    );
  }
}

export function clampScore(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function calculateNilaiAkhir(
  sumatifLingkup: number[],
  sumatifAkhirSemester: number | null
): number {
  const validLingkup = sumatifLingkup.filter(
    (score) => Number.isFinite(score) && score >= 0 && score <= 100
  );
  const hasSas =
    sumatifAkhirSemester !== null &&
    Number.isFinite(sumatifAkhirSemester) &&
    sumatifAkhirSemester >= 0 &&
    sumatifAkhirSemester <= 100;

  if (validLingkup.length === 0 && !hasSas) {
    return 0;
  }

  if (validLingkup.length === 0 && hasSas) {
    return clampScore(sumatifAkhirSemester as number);
  }

  const avgLingkup =
    validLingkup.reduce((acc, cur) => acc + cur, 0) / validLingkup.length;

  if (!hasSas) {
    return clampScore(avgLingkup);
  }

  // Kurikulum Merdeka standard: 60% Sumatif Lingkup Materi + 40% Sumatif Akhir Semester
  return clampScore(avgLingkup * 0.6 + (sumatifAkhirSemester as number) * 0.4);
}

export function computePredikat(
  nilaiAkhir: number,
  kkm: number = 75
): { predikat: PredikatType; label: string } {
  const score = clampScore(nilaiAkhir);
  const threshold = Math.max(50, Math.min(95, kkm));
  const interval = (100 - threshold) / 3;

  if (score >= threshold + interval * 2) {
    return { predikat: 'A', label: 'Sangat Baik' };
  }
  if (score >= threshold + interval) {
    return { predikat: 'B', label: 'Baik' };
  }
  if (score >= threshold) {
    return { predikat: 'C', label: 'Cukup' };
  }
  return { predikat: 'D', label: 'Perlu Bimbingan' };
}

export function generateAutoDeskripsi(params: {
  studentName: string;
  subjectName: string;
  nilaiAkhir: number;
  kkm?: number;
  tpList: TujuanPembelajaran[];
  tpTercapaiIds: string[];
  tpPerluBimbinganIds: string[];
}): string {
  const {
    studentName,
    subjectName,
    nilaiAkhir,
    kkm = 75,
    tpList,
    tpTercapaiIds,
    tpPerluBimbinganIds,
  } = params;

  const firstName = studentName.trim().split(/\s+/)[0] || studentName;
  const { label } = computePredikat(nilaiAkhir, kkm);

  const tercapaiTps = tpList.filter((tp) => tpTercapaiIds.includes(tp.id));
  const tercapaiTexts = tercapaiTps.map(
    (tp) => tp.deskripsi.charAt(0).toLowerCase() + tp.deskripsi.slice(1)
  );
  const deepLevels = Array.from(
    new Set(
      tercapaiTps
        .map((tp) => tp.levelMendalam)
        .filter((lv): lv is DeepLearningLevel => Boolean(lv))
    )
  );
  const deepClause =
    deepLevels.length > 0 ? ` (tahap ${deepLevels.join(' & ')})` : '';

  const perluTexts = tpList
    .filter((tp) => tpPerluBimbinganIds.includes(tp.id))
    .map((tp) => tp.deskripsi.charAt(0).toLowerCase() + tp.deskripsi.slice(1));

  const parts: string[] = [];

  if (tercapaiTexts.length > 0) {
    parts.push(
      `Ananda ${firstName} menunjukkan penguasaan dengan capaian ${label.toLowerCase()} pada mata pelajaran ${subjectName}${deepClause}, terutama dalam ${tercapaiTexts.slice(0, 2).join(' serta ')}.`
    );
  } else if (nilaiAkhir >= kkm) {
    parts.push(
      `Ananda ${firstName} menunjukkan pemahaman yang ${label.toLowerCase()} terhadap materi esensial ${subjectName} pada semester ini.`
    );
  } else {
    parts.push(
      `Ananda ${firstName} mulai menunjukkan perkembangan dasar dalam mata pelajaran ${subjectName} dengan pendampingan bertahap.`
    );
  }

  if (perluTexts.length > 0) {
    parts.push(
      `Perlu bimbingan dan penguatan lebih lanjut dalam ${perluTexts.slice(0, 2).join(' dan ')}.`
    );
  } else if (nilaiAkhir < kkm) {
    parts.push(
      `Disarankan latihan terstruktur dan bimbingan lanjutan agar mencapai ketuntasan tujuan pembelajaran.`
    );
  }

  return parts.join(' ');
}

export function computeDeterministicChecksum(input: unknown): string {
  const str = JSON.stringify(input);
  let h1 = 0xdeadbeef ^ str.length;
  let h2 = 0x41c6ce57 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  const part1 = (h1 >>> 0).toString(16).padStart(8, '0');
  const part2 = (h2 >>> 0).toString(16).padStart(8, '0');
  const part3 = ((h1 ^ h2) >>> 0).toString(16).padStart(8, '0');
  const part4 = ((h1 + h2) >>> 0).toString(16).padStart(8, '0');
  return `${part1}${part2}${part3}${part4}`;
}

export function reconcileDapodikSync(
  current: EraporDataset,
  incoming: DapodikIncomingPayload,
  actor: string = 'Sinkronisasi Dapodik (Read-Only)'
): { nextDataset: EraporDataset; diff: DapodikSyncDiff } {
  const nowIso = new Date().toISOString();

  const incomingRombels = incoming.rombels ?? current.rombels;
  const currentRombelMap = new Map(current.rombels.map((r) => [r.dapodikRombelId, r]));
  let addedRombels = 0;
  let updatedRombels = 0;

  for (const r of incomingRombels) {
    const prev = currentRombelMap.get(r.dapodikRombelId);
    if (!prev) {
      addedRombels++;
    } else if (
      prev.nama !== r.nama ||
      prev.waliKelasNama !== r.waliKelasNama ||
      prev.tingkat !== r.tingkat
    ) {
      updatedRombels++;
    }
  }

  const incomingStudents = incoming.students ?? current.students;
  const currentByDapodikId = new Map(
    current.students.map((s) => [s.pesertaDidikId, s])
  );
  const incomingByDapodikId = new Map(
    incomingStudents.map((s) => [s.pesertaDidikId, s])
  );

  let addedStudents = 0;
  let updatedStudents = 0;
  let movedRombelStudents = 0;
  let unchangedStudents = 0;
  let removedStudents = 0;

  for (const s of incomingStudents) {
    const prev = currentByDapodikId.get(s.pesertaDidikId);
    if (!prev) {
      addedStudents++;
    } else {
      const moved = prev.rombelId !== s.rombelId;
      const changed =
        prev.nama !== s.nama ||
        prev.nisn !== s.nisn ||
        prev.nipd !== s.nipd ||
        prev.statusAktif !== s.statusAktif ||
        prev.namaOrangTua !== s.namaOrangTua;
      if (moved) movedRombelStudents++;
      if (changed) updatedStudents++;
      if (!moved && !changed) unchangedStudents++;
    }
  }

  for (const prev of current.students) {
    if (!incomingByDapodikId.has(prev.pesertaDidikId)) {
      removedStudents++;
    }
  }

  // Update grades' rombelId if a student moved rombel in Dapodik, preserving all teacher scores!
  const studentRombelLookup = new Map(incomingStudents.map((s) => [s.id, s.rombelId]));
  const reconciledGrades = current.grades.map((g) => {
    const targetRombel = studentRombelLookup.get(g.studentId);
    if (targetRombel && targetRombel !== g.rombelId) {
      return { ...g, rombelId: targetRombel };
    }
    return g;
  });

  const reconciledWali = current.waliRecords.map((w) => {
    const targetRombel = studentRombelLookup.get(w.studentId);
    if (targetRombel && targetRombel !== w.rombelId) {
      return { ...w, rombelId: targetRombel };
    }
    return w;
  });

  const nextSchoolBase: DapodikSchool = {
    ...current.school,
    ...(incoming.school ?? {}),
    sourceHost: incoming.sourceHost ?? incoming.school?.sourceHost ?? current.school.sourceHost,
    lastSyncAt: nowIso,
    readOnlyVerified: true,
    checksumSha256: '',
  };

  const checksumSha256 = computeDeterministicChecksum({
    school: nextSchoolBase.npsn,
    rombels: incomingRombels,
    students: incomingStudents,
  });

  const nextSchool: DapodikSchool = {
    ...nextSchoolBase,
    checksumSha256,
  };

  const diff: DapodikSyncDiff = {
    addedStudents,
    updatedStudents,
    movedRombelStudents,
    removedStudents,
    unchangedStudents,
    addedRombels,
    updatedRombels,
    readOnlyVerified: true,
    syncedAt: nowIso,
    checksumSha256,
  };

  const auditEntry: AuditLogEntry = {
    id: `aud-${Date.now()}`,
    timestamp: nowIso,
    actor,
    action: 'SINKRON_DAPODIK_READ_ONLY',
    target: `${incomingStudents.length} Peserta Didik · ${incomingRombels.length} Rombel`,
    readOnlyGuardPassed: true,
    integrityHash: checksumSha256.slice(0, 16),
  };

  return {
    nextDataset: {
      ...current,
      school: nextSchool,
      rombels: incomingRombels,
      students: incomingStudents,
      grades: reconciledGrades,
      waliRecords: reconciledWali,
      auditLogs: [auditEntry, ...current.auditLogs].slice(0, 40),
    },
    diff,
  };
}

export interface LegerRow {
  student: DapodikStudent;
  scoresBySubject: Record<string, { nilai: number; predikat: PredikatType } | null>;
  totalNilai: number;
  rataRata: number;
  tuntasCount: number;
  totalMapel: number;
  sakit: number;
  izin: number;
  tanpaKeterangan: number;
  keputusan: string;
}

export function computeLegerRombel(
  dataset: EraporDataset,
  rombelId: string
): {
  rombel: DapodikRombel | undefined;
  subjects: DapodikSubject[];
  rows: LegerRow[];
  subjectAverages: Record<string, number>;
  completionRate: number;
} {
  const rombel = dataset.rombels.find((r) => r.id === rombelId);
  const students = dataset.students
    .filter((s) => s.rombelId === rombelId && s.statusAktif === 'Aktif')
    .sort((a, b) => a.nama.localeCompare(b.nama, 'id'));

  const subjects = rombel
    ? dataset.subjects.filter((sub) => sub.tingkatList.includes(rombel.tingkat))
    : dataset.subjects;

  let filledCells = 0;
  const totalCells = students.length * subjects.length;

  const subjectSums: Record<string, { sum: number; count: number }> = {};
  for (const sub of subjects) {
    subjectSums[sub.id] = { sum: 0, count: 0 };
  }

  const rows: LegerRow[] = students.map((student) => {
    const scoresBySubject: Record<string, { nilai: number; predikat: PredikatType } | null> = {};
    let totalNilai = 0;
    let gradedCount = 0;
    let tuntasCount = 0;

    for (const sub of subjects) {
      const rec = dataset.grades.find(
        (g) => g.studentId === student.id && g.mapelId === sub.id
      );
      if (rec && rec.nilaiAkhir > 0) {
        scoresBySubject[sub.id] = { nilai: rec.nilaiAkhir, predikat: rec.predikat };
        totalNilai += rec.nilaiAkhir;
        gradedCount++;
        filledCells++;
        if (rec.nilaiAkhir >= sub.kkm) tuntasCount++;
        subjectSums[sub.id].sum += rec.nilaiAkhir;
        subjectSums[sub.id].count += 1;
      } else {
        scoresBySubject[sub.id] = null;
      }
    }

    const wali = dataset.waliRecords.find((w) => w.studentId === student.id);

    return {
      student,
      scoresBySubject,
      totalNilai,
      rataRata: gradedCount > 0 ? Math.round((totalNilai / gradedCount) * 10) / 10 : 0,
      tuntasCount,
      totalMapel: subjects.length,
      sakit: wali?.sakit ?? 0,
      izin: wali?.izin ?? 0,
      tanpaKeterangan: wali?.tanpaKeterangan ?? 0,
      keputusan: wali?.keputusanNaik ?? 'Proses',
    };
  });

  const subjectAverages: Record<string, number> = {};
  for (const sub of subjects) {
    const entry = subjectSums[sub.id];
    subjectAverages[sub.id] =
      entry.count > 0 ? Math.round((entry.sum / entry.count) * 10) / 10 : 0;
  }

  const completionRate =
    totalCells > 0 ? Math.round((filledCells / totalCells) * 100) : 0;

  return {
    rombel,
    subjects,
    rows,
    subjectAverages,
    completionRate,
  };
}

export interface PrincipalMetrics {
  totalStudents: number;
  totalRombels: number;
  totalSubjects: number;
  overallCompletionPct: number;
  schoolAverageScore: number;
  studentsBelowKkmCount: number;
  pendingSyncCount: number;
  rombelProgress: {
    rombelId: string;
    rombelNama: string;
    waliKelas: string;
    studentCount: number;
    completionPct: number;
    averageScore: number;
    waliDoneCount: number;
  }[];
  subjectStats: {
    subjectId: string;
    subjectName: string;
    kkm: number;
    averageScore: number;
    tuntasPct: number;
    gradedCount: number;
  }[];
  interventionList: {
    studentId: string;
    studentName: string;
    rombelName: string;
    subjectName: string;
    nilai: number;
    kkm: number;
  }[];
}

export function computePrincipalMetrics(dataset: EraporDataset): PrincipalMetrics {
  const activeStudents = dataset.students.filter((s) => s.statusAktif === 'Aktif');
  const pendingSyncCount =
    dataset.grades.filter((g) => g.syncStatus === 'pending').length +
    dataset.waliRecords.filter((w) => w.syncStatus === 'pending').length;

  let totalRequiredCells = 0;
  let totalFilledCells = 0;
  let scoreSum = 0;
  let scoreCount = 0;

  const rombelProgress = dataset.rombels.map((rombel) => {
    const leger = computeLegerRombel(dataset, rombel.id);
    const req = leger.rows.length * leger.subjects.length;
    totalRequiredCells += req;
    const filled = Math.round((leger.completionRate / 100) * req);
    totalFilledCells += filled;

    const studentAvgs = leger.rows.filter((r) => r.rataRata > 0).map((r) => r.rataRata);
    const avgScore =
      studentAvgs.length > 0
        ? Math.round(
            (studentAvgs.reduce((a, b) => a + b, 0) / studentAvgs.length) * 10
          ) / 10
        : 0;

    for (const r of leger.rows) {
      for (const sub of leger.subjects) {
        const cell = r.scoresBySubject[sub.id];
        if (cell) {
          scoreSum += cell.nilai;
          scoreCount++;
        }
      }
    }

    const waliDoneCount = leger.rows.filter((r) => {
      const w = dataset.waliRecords.find((wr) => wr.studentId === r.student.id);
      return Boolean(w && w.catatanWali.trim().length > 0);
    }).length;

    return {
      rombelId: rombel.id,
      rombelNama: rombel.nama,
      waliKelas: rombel.waliKelasNama,
      studentCount: leger.rows.length,
      completionPct: leger.completionRate,
      averageScore: avgScore,
      waliDoneCount,
    };
  });

  const interventionList: PrincipalMetrics['interventionList'] = [];
  const belowSet = new Set<string>();

  const subjectStats = dataset.subjects.map((sub) => {
    const subGrades = dataset.grades.filter((g) => g.mapelId === sub.id && g.nilaiAkhir > 0);
    const avg =
      subGrades.length > 0
        ? Math.round(
            (subGrades.reduce((a, b) => a + b.nilaiAkhir, 0) / subGrades.length) * 10
          ) / 10
        : 0;
    const tuntas = subGrades.filter((g) => g.nilaiAkhir >= sub.kkm).length;
    for (const g of subGrades) {
      if (g.nilaiAkhir < sub.kkm) {
        belowSet.add(g.studentId);
        const st = dataset.students.find((s) => s.id === g.studentId);
        const rb = dataset.rombels.find((r) => r.id === g.rombelId);
        if (st && rb) {
          interventionList.push({
            studentId: st.id,
            studentName: st.nama,
            rombelName: rb.nama,
            subjectName: sub.nama,
            nilai: g.nilaiAkhir,
            kkm: sub.kkm,
          });
        }
      }
    }
    return {
      subjectId: sub.id,
      subjectName: sub.nama,
      kkm: sub.kkm,
      averageScore: avg,
      tuntasPct: subGrades.length > 0 ? Math.round((tuntas / subGrades.length) * 100) : 0,
      gradedCount: subGrades.length,
    };
  });

  return {
    totalStudents: activeStudents.length,
    totalRombels: dataset.rombels.length,
    totalSubjects: dataset.subjects.length,
    overallCompletionPct:
      totalRequiredCells > 0
        ? Math.round((totalFilledCells / totalRequiredCells) * 100)
        : 0,
    schoolAverageScore:
      scoreCount > 0 ? Math.round((scoreSum / scoreCount) * 10) / 10 : 0,
    studentsBelowKkmCount: belowSet.size,
    pendingSyncCount,
    rombelProgress,
    subjectStats,
    interventionList: interventionList.sort((a, b) => a.nilai - b.nilai),
  };
}

export function validateSchoolProfileInput(input: {
  npsn: string;
  namaSekolah: string;
  sourceHost: string;
}): {
  valid: boolean;
  error?: string;
  normalized: { npsn: string; namaSekolah: string; sourceHost: string };
} {
  const npsn = input.npsn.trim();
  const namaSekolah = input.namaSekolah.trim();
  const sourceHost = input.sourceHost.trim().replace(/\/+$/, '');

  if (!/^\d{8}$/.test(npsn)) {
    return {
      valid: false,
      error: 'NPSN harus terdiri dari tepat 8 digit angka resmi Kemdikdasmen.',
      normalized: { npsn, namaSekolah, sourceHost },
    };
  }

  if (namaSekolah.length < 3) {
    return {
      valid: false,
      error: 'Nama satuan pendidikan minimal 3 karakter.',
      normalized: { npsn, namaSekolah, sourceHost },
    };
  }

  try {
    const parsedUrl = new URL(sourceHost);
    if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
      return {
        valid: false,
        error: 'Alamat WebService Dapodik wajib menggunakan protokol http:// atau https://.',
        normalized: { npsn, namaSekolah, sourceHost },
      };
    }
  } catch {
    return {
      valid: false,
      error: 'Format alamat WebService Dapodik tidak valid (contoh: http://localhost:5774/WebService).',
      normalized: { npsn, namaSekolah, sourceHost },
    };
  }

  return {
    valid: true,
    normalized: { npsn, namaSekolah, sourceHost },
  };
}

export function getDefaultSubjectsForJenjang(jenjang: SchoolJenjang): {
  subjects: DapodikSubject[];
  tujuanPembelajaran: TujuanPembelajaran[];
} {
  const kkaTemplate = getKkaElectiveTemplate(jenjang);

  if (jenjang === 'SMP') {
    const subjects: DapodikSubject[] = [
      { id: 'mapel-pai', kode: 'PABP', nama: 'Pendidikan Agama & Budi Pekerti', kelompok: 'Umum', kkm: 75, tingkatList: [7, 8, 9], guruPengampu: 'Guru Mapel PABP', nipGuru: '-' },
      { id: 'mapel-ppkn', kode: 'PPKN', nama: 'Pendidikan Pancasila', kelompok: 'Umum', kkm: 75, tingkatList: [7, 8, 9], guruPengampu: 'Guru Mapel Pancasila', nipGuru: '-' },
      { id: 'mapel-bind', kode: 'BIND', nama: 'Bahasa Indonesia', kelompok: 'Umum', kkm: 75, tingkatList: [7, 8, 9], guruPengampu: 'Guru Mapel B. Indonesia', nipGuru: '-' },
      { id: 'mapel-mtk', kode: 'MTK', nama: 'Matematika', kelompok: 'Umum', kkm: 75, tingkatList: [7, 8, 9], guruPengampu: 'Guru Mapel Matematika', nipGuru: '-' },
      { id: 'mapel-ipa', kode: 'IPA', nama: 'Ilmu Pengetahuan Alam (IPA)', kelompok: 'Umum', kkm: 75, tingkatList: [7, 8, 9], guruPengampu: 'Guru Mapel IPA', nipGuru: '-' },
      { id: 'mapel-ips', kode: 'IPS', nama: 'Ilmu Pengetahuan Sosial (IPS)', kelompok: 'Umum', kkm: 75, tingkatList: [7, 8, 9], guruPengampu: 'Guru Mapel IPS', nipGuru: '-' },
      { id: 'mapel-bing', kode: 'BING', nama: 'Bahasa Inggris', kelompok: 'Umum', kkm: 75, tingkatList: [7, 8, 9], guruPengampu: 'Guru Mapel B. Inggris', nipGuru: '-' },
      { id: 'mapel-inf', kode: 'INF', nama: 'Informatika', kelompok: 'Umum', kkm: 75, tingkatList: [7, 8, 9], guruPengampu: 'Guru Mapel Informatika', nipGuru: '-' },
      kkaTemplate.subject,
    ];
    const tujuanPembelajaran: TujuanPembelajaran[] = [
      { id: 'tp-smp-mtk-1', mapelId: 'mapel-mtk', tingkat: 7, kode: 'TP.7.1', deskripsi: 'Memahami operasi bilangan bulat, rasional, dan aljabar linear satu variabel', levelMendalam: 'Memahami', dimensiProfil: ['Penalaran Kritis'] },
      { id: 'tp-smp-ipa-1', mapelId: 'mapel-ipa', tingkat: 7, kode: 'TP.7.1', deskripsi: 'Melakukan pengukuran besaran fisika dan menganalisis klasifikasi makhluk hidup', levelMendalam: 'Mengaplikasi', dimensiProfil: ['Penalaran Kritis', 'Kreativitas'] },
      { id: 'tp-smp-bind-1', mapelId: 'mapel-bind', tingkat: 7, kode: 'TP.7.1', deskripsi: 'Menelaah struktur dan kebahasaan teks deskripsi serta teks prosedur', levelMendalam: 'Memahami', dimensiProfil: ['Komunikasi'] },
      ...kkaTemplate.tujuanPembelajaran,
    ];
    return { subjects, tujuanPembelajaran };
  }

  if (jenjang === 'SMA') {
    const subjects: DapodikSubject[] = [
      { id: 'mapel-pai', kode: 'PABP', nama: 'Pendidikan Agama & Budi Pekerti', kelompok: 'Umum', kkm: 78, tingkatList: [10, 11, 12], guruPengampu: 'Guru Mapel PABP', nipGuru: '-' },
      { id: 'mapel-ppkn', kode: 'PPKN', nama: 'Pendidikan Pancasila', kelompok: 'Umum', kkm: 78, tingkatList: [10, 11, 12], guruPengampu: 'Guru Mapel Pancasila', nipGuru: '-' },
      { id: 'mapel-bind', kode: 'BIND', nama: 'Bahasa Indonesia', kelompok: 'Umum', kkm: 78, tingkatList: [10, 11, 12], guruPengampu: 'Guru Mapel B. Indonesia', nipGuru: '-' },
      { id: 'mapel-mtk', kode: 'MTK', nama: 'Matematika', kelompok: 'Umum', kkm: 76, tingkatList: [10, 11, 12], guruPengampu: 'Guru Mapel Matematika', nipGuru: '-' },
      { id: 'mapel-bing', kode: 'BING', nama: 'Bahasa Inggris', kelompok: 'Umum', kkm: 78, tingkatList: [10, 11, 12], guruPengampu: 'Guru Mapel B. Inggris', nipGuru: '-' },
      { id: 'mapel-fis', kode: 'FIS', nama: 'Fisika', kelompok: 'Pilihan', kkm: 75, tingkatList: [10, 11, 12], guruPengampu: 'Guru Mapel Fisika', nipGuru: '-' },
      { id: 'mapel-eko', kode: 'EKO', nama: 'Ekonomi', kelompok: 'Pilihan', kkm: 76, tingkatList: [10, 11, 12], guruPengampu: 'Guru Mapel Ekonomi', nipGuru: '-' },
      { id: 'mapel-inf', kode: 'INF', nama: 'Informatika', kelompok: 'Pilihan', kkm: 78, tingkatList: [10, 11, 12], guruPengampu: 'Guru Mapel Informatika', nipGuru: '-' },
      kkaTemplate.subject,
    ];
    const tujuanPembelajaran: TujuanPembelajaran[] = [
      { id: 'tp-sma-mtk-1', mapelId: 'mapel-mtk', tingkat: 10, kode: 'TP.10.1', deskripsi: 'Menerapkan konsep eksponen, logaritma, serta sistem persamaan linear tiga variabel', levelMendalam: 'Mengaplikasi', dimensiProfil: ['Penalaran Kritis'] },
      { id: 'tp-sma-fis-1', mapelId: 'mapel-fis', tingkat: 10, kode: 'TP.10.1', deskripsi: 'Menerapkan prinsip pengukuran ilmiah, besaran vektor, dan hukum gerak Newton', levelMendalam: 'Mengaplikasi', dimensiProfil: ['Penalaran Kritis', 'Kolaborasi'] },
      ...kkaTemplate.tujuanPembelajaran,
    ];
    return { subjects, tujuanPembelajaran };
  }

  if (jenjang === 'SMK') {
    const subjects: DapodikSubject[] = [
      { id: 'mapel-pai', kode: 'PABP', nama: 'Pendidikan Agama & Budi Pekerti', kelompok: 'Umum', kkm: 75, tingkatList: [10, 11, 12], guruPengampu: 'Guru Mapel PABP', nipGuru: '-' },
      { id: 'mapel-ppkn', kode: 'PPKN', nama: 'Pendidikan Pancasila', kelompok: 'Umum', kkm: 75, tingkatList: [10, 11, 12], guruPengampu: 'Guru Mapel Pancasila', nipGuru: '-' },
      { id: 'mapel-bind', kode: 'BIND', nama: 'Bahasa Indonesia', kelompok: 'Umum', kkm: 75, tingkatList: [10, 11, 12], guruPengampu: 'Guru Mapel B. Indonesia', nipGuru: '-' },
      { id: 'mapel-mtk', kode: 'MTK', nama: 'Matematika', kelompok: 'Umum', kkm: 75, tingkatList: [10, 11, 12], guruPengampu: 'Guru Mapel Matematika', nipGuru: '-' },
      { id: 'mapel-bing', kode: 'BING', nama: 'Bahasa Inggris', kelompok: 'Umum', kkm: 75, tingkatList: [10, 11, 12], guruPengampu: 'Guru Mapel B. Inggris', nipGuru: '-' },
      { id: 'mapel-inf', kode: 'INF', nama: 'Informatika', kelompok: 'Umum', kkm: 78, tingkatList: [10, 11, 12], guruPengampu: 'Guru Mapel Informatika', nipGuru: '-' },
      { id: 'mapel-dk', kode: 'DK', nama: 'Dasar-Dasar Program Keahlian', kelompok: 'Pilihan', kkm: 78, tingkatList: [10, 11, 12], guruPengampu: 'Guru Produktif Kejuruan', nipGuru: '-' },
      { id: 'mapel-kk', kode: 'KK', nama: 'Konsentrasi Keahlian', kelompok: 'Pilihan', kkm: 80, tingkatList: [10, 11, 12], guruPengampu: 'Guru Konsentrasi Keahlian', nipGuru: '-' },
      kkaTemplate.subject,
    ];
    const tujuanPembelajaran: TujuanPembelajaran[] = [
      { id: 'tp-smk-dk-1', mapelId: 'mapel-dk', tingkat: 10, kode: 'TP.10.1', deskripsi: 'Menerapkan keselamatan kerja K3LH dan alur proses bisnis bidang keahlian', levelMendalam: 'Mengaplikasi', dimensiProfil: ['Kemandirian', 'Kesehatan'] },
      { id: 'tp-smk-kk-1', mapelId: 'mapel-kk', tingkat: 11, kode: 'TP.11.1', deskripsi: 'Merancang dan menguji proyek kompetensi keahlian sesuai standar industri', levelMendalam: 'Merefleksi', dimensiProfil: ['Kreativitas', 'Kolaborasi'] },
      ...kkaTemplate.tujuanPembelajaran,
    ];
    return { subjects, tujuanPembelajaran };
  }

  // SD Default (KKA Pilihan kelas 5 & 6 per Permendikdasmen No. 13/2025)
  const subjects: DapodikSubject[] = [
    { id: 'mapel-pai', kode: 'PABP', nama: 'Pendidikan Agama & Budi Pekerti', kelompok: 'Umum', kkm: 75, tingkatList: [1, 2, 3, 4, 5, 6], guruPengampu: 'Guru Mapel PABP', nipGuru: '-' },
    { id: 'mapel-ppkn', kode: 'PPKN', nama: 'Pendidikan Pancasila', kelompok: 'Umum', kkm: 75, tingkatList: [1, 2, 3, 4, 5, 6], guruPengampu: 'Guru Kelas', nipGuru: '-' },
    { id: 'mapel-bind', kode: 'BIND', nama: 'Bahasa Indonesia', kelompok: 'Umum', kkm: 75, tingkatList: [1, 2, 3, 4, 5, 6], guruPengampu: 'Guru Kelas', nipGuru: '-' },
    { id: 'mapel-mtk', kode: 'MTK', nama: 'Matematika', kelompok: 'Umum', kkm: 75, tingkatList: [1, 2, 3, 4, 5, 6], guruPengampu: 'Guru Kelas', nipGuru: '-' },
    { id: 'mapel-ipas', kode: 'IPAS', nama: 'Ilmu Pengetahuan Alam dan Sosial', kelompok: 'Umum', kkm: 75, tingkatList: [3, 4, 5, 6], guruPengampu: 'Guru Kelas', nipGuru: '-' },
    { id: 'mapel-pjok', kode: 'PJOK', nama: 'Pendidikan Jasmani, Olahraga & Kesehatan', kelompok: 'Umum', kkm: 75, tingkatList: [1, 2, 3, 4, 5, 6], guruPengampu: 'Guru PJOK', nipGuru: '-' },
    kkaTemplate.subject,
  ];
  const tujuanPembelajaran: TujuanPembelajaran[] = [
    { id: 'tp-sd-mtk-1', mapelId: 'mapel-mtk', tingkat: 6, kode: 'TP.6.1', deskripsi: 'Mengoperasikan pecahan, desimal, serta menghitung rasio dalam masalah sehari-hari', levelMendalam: 'Mengaplikasi', dimensiProfil: ['Penalaran Kritis'] },
    { id: 'tp-sd-bind-1', mapelId: 'mapel-bind', tingkat: 6, kode: 'TP.6.1', deskripsi: 'Memahami ide pokok dan menyajikan gagasan secara runtut pada teks narasi dan eksplanasi', levelMendalam: 'Memahami', dimensiProfil: ['Komunikasi'] },
    ...kkaTemplate.tujuanPembelajaran,
  ];
  return { subjects, tujuanPembelajaran };
}

export function createCleanSchoolDataset(params: {
  npsn: string;
  namaSekolah: string;
  jenjang: SchoolJenjang;
  sourceHost: string;
  alamat?: string;
  kelurahan?: string;
  kecamatan?: string;
  kabupaten?: string;
  provinsi?: string;
  kepalaSekolah?: string;
  nipKepalaSekolah?: string;
  semesterId?: string;
  semesterLabel?: string;
  tahunAjaran?: string;
  kurikulum?: KurikulumType;
  initialPayload?: DapodikIncomingPayload;
}): EraporDataset {
  const nowIso = new Date().toISOString();
  const { subjects, tujuanPembelajaran } = getDefaultSubjectsForJenjang(params.jenjang);

  const starterRombelByJenjang: Record<SchoolJenjang, DapodikRombel> = {
    SD: {
      id: `rombel-${params.npsn}-1`,
      dapodikRombelId: `RB-${params.npsn}-01`,
      nama: 'Kelas 6A (Template Awal)',
      tingkat: 6,
      fase: 'Fase C',
      waliKelasId: `PTK-${params.npsn}-01`,
      waliKelasNama: 'Menunggu Sinkron Dapodik',
      waliKelasNip: '-',
      kurikulum: params.kurikulum ?? 'Kurikulum Merdeka',
    },
    SMP: {
      id: `rombel-${params.npsn}-1`,
      dapodikRombelId: `RB-${params.npsn}-01`,
      nama: 'Kelas VII A (Template Awal)',
      tingkat: 7,
      fase: 'Fase D',
      waliKelasId: `PTK-${params.npsn}-01`,
      waliKelasNama: 'Menunggu Sinkron Dapodik',
      waliKelasNip: '-',
      kurikulum: params.kurikulum ?? 'Kurikulum Merdeka',
    },
    SMA: {
      id: `rombel-${params.npsn}-1`,
      dapodikRombelId: `RB-${params.npsn}-01`,
      nama: 'Kelas X A (Template Awal)',
      tingkat: 10,
      fase: 'Fase E',
      waliKelasId: `PTK-${params.npsn}-01`,
      waliKelasNama: 'Menunggu Sinkron Dapodik',
      waliKelasNip: '-',
      kurikulum: params.kurikulum ?? 'Kurikulum Merdeka',
    },
    SMK: {
      id: `rombel-${params.npsn}-1`,
      dapodikRombelId: `RB-${params.npsn}-01`,
      nama: 'Kelas X Kejuruan 1 (Template Awal)',
      tingkat: 10,
      fase: 'Fase E',
      waliKelasId: `PTK-${params.npsn}-01`,
      waliKelasNama: 'Menunggu Sinkron Dapodik',
      waliKelasNip: '-',
      kurikulum: params.kurikulum ?? 'Kurikulum Merdeka',
    },
  };

  const baseRombels =
    params.initialPayload?.rombels && params.initialPayload.rombels.length > 0
      ? params.initialPayload.rombels
      : [starterRombelByJenjang[params.jenjang]];

  const baseStudents = params.initialPayload?.students ?? [];

  const checksumSha256 = computeDeterministicChecksum({
    school: params.npsn,
    rombels: baseRombels,
    students: baseStudents,
  });

  const school: DapodikSchool = {
    npsn: params.npsn,
    namaSekolah: params.initialPayload?.school?.namaSekolah || params.namaSekolah,
    jenjang: params.initialPayload?.school?.jenjang || params.jenjang,
    alamat: params.initialPayload?.school?.alamat || params.alamat || '-',
    kelurahan: params.kelurahan || '-',
    kecamatan: params.kecamatan || '-',
    kabupaten: params.kabupaten || 'Kabupaten/Kota',
    provinsi: params.provinsi || 'Indonesia',
    kepalaSekolah: params.kepalaSekolah || 'Kepala Sekolah',
    nipKepalaSekolah: params.nipKepalaSekolah || '-',
    semesterId: params.semesterId || '20261',
    semesterLabel: params.semesterLabel || '2026/2027 Ganjil',
    tahunAjaran: params.tahunAjaran || '2026/2027',
    kurikulum: params.kurikulum || 'Kurikulum Merdeka (Pembelajaran Mendalam 2026)',
    dapodikVersion: 'Dapodik 2026.c',
    sourceHost: params.sourceHost,
    lastSyncAt: nowIso,
    readOnlyVerified: true,
    checksumSha256,
  };

  const initialAudit: AuditLogEntry = {
    id: `aud-reg-${Date.now()}`,
    timestamp: nowIso,
    actor: 'Operator Sekolah',
    action: baseStudents.length > 0 ? 'DAFTAR_DAN_SINKRON_SEKOLAH' : 'DAFTARKAN_SEKOLAH_BARU',
    target: `${school.namaSekolah} (NPSN ${school.npsn}) · ${baseStudents.length} Siswa`,
    readOnlyGuardPassed: true,
    integrityHash: checksumSha256.slice(0, 16),
  };

  return {
    school,
    rombels: baseRombels,
    students: baseStudents,
    subjects,
    tujuanPembelajaran,
    grades: [],
    waliRecords: [],
    auditLogs: [initialAudit],
  };
}

export function summarizeSchoolProfile(dataset: EraporDataset): SchoolProfileSummary {
  return {
    npsn: dataset.school.npsn,
    namaSekolah: dataset.school.namaSekolah,
    jenjang: dataset.school.jenjang,
    kabupaten: dataset.school.kabupaten,
    provinsi: dataset.school.provinsi,
    kepalaSekolah: dataset.school.kepalaSekolah,
    sourceHost: dataset.school.sourceHost,
    kurikulum: dataset.school.kurikulum,
    semesterLabel: dataset.school.semesterLabel,
    studentCount: dataset.students.filter((s) => s.statusAktif === 'Aktif').length,
    rombelCount: dataset.rombels.length,
    lastSyncAt: dataset.school.lastSyncAt,
    checksumSha256: dataset.school.checksumSha256,
  };
}

export interface DapodikConnectionConfig {
  npsn: string;
  sourceHost: string;
  hasToken: boolean;
  autoSyncEnabled: boolean;
  autoSyncIntervalSec: number;
  bridgeKey: string;
  lastLiveChannel?: 'server_direct' | 'browser_direct' | 'local_bridge' | 'none';
  lastLiveCheckAt?: string;
  lastLiveMessage?: string;
}

export function isLocalOrPrivateUrl(urlStr: string): boolean {
  try {
    const u = new URL(urlStr.trim());
    const host = u.hostname.toLowerCase();
    if (
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host === '::1' ||
      host === '0.0.0.0' ||
      host.endsWith('.local')
    ) {
      return true;
    }
    if (/^10\./.test(host) || /^192\.168\./.test(host)) {
      return true;
    }
    const match172 = host.match(/^172\.(\d+)\./);
    if (match172) {
      const secondOctet = Number(match172[1]);
      if (secondOctet >= 16 && secondOctet <= 31) return true;
    }
    return false;
  } catch {
    return false;
  }
}

export function hasDapodikSyncChanges(diff: DapodikSyncDiff): boolean {
  return (
    diff.addedStudents > 0 ||
    diff.updatedStudents > 0 ||
    diff.movedRombelStudents > 0 ||
    diff.removedStudents > 0 ||
    diff.addedRombels > 0 ||
    diff.updatedRombels > 0
  );
}

function extractDapodikRows(raw: unknown): Record<string, unknown>[] {
  if (!raw || typeof raw !== 'object') return [];
  if (Array.isArray(raw)) {
    return raw.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === 'object'));
  }
  const obj = raw as Record<string, unknown>;
  if (Array.isArray(obj.rows)) {
    return obj.rows.filter(
      (item): item is Record<string, unknown> => Boolean(item && typeof item === 'object')
    );
  }
  if (obj.rows && typeof obj.rows === 'object') {
    return [obj.rows as Record<string, unknown>];
  }
  if (obj.nama || obj.npsn || obj.peserta_didik_id || obj.rombongan_belajar_id) {
    return [obj];
  }
  return [];
}

function parseTingkatFromDapodik(rawTingkat: unknown, rawStr: unknown): number {
  const numeric = Number(rawTingkat);
  if (Number.isFinite(numeric) && numeric >= 1 && numeric <= 13) {
    return numeric;
  }
  const str = String(rawStr || rawTingkat || '').trim().toUpperCase();
  const numMatch = str.match(/\d+/);
  if (numMatch) return Number(numMatch[0]);
  if (str.includes('XII')) return 12;
  if (str.includes('XI')) return 11;
  if (str.includes('X')) return 10;
  if (str.includes('IX')) return 9;
  if (str.includes('VIII')) return 8;
  if (str.includes('VII')) return 7;
  if (str.includes('VI')) return 6;
  if (str.includes('IV')) return 4;
  if (str.includes('V')) return 5;
  if (str.includes('III')) return 3;
  if (str.includes('II')) return 2;
  if (str.includes('I')) return 1;
  return 6;
}

function resolveFaseByTingkat(tingkat: number): string {
  if (tingkat <= 2) return 'Fase A';
  if (tingkat <= 4) return 'Fase B';
  if (tingkat <= 6) return 'Fase C';
  if (tingkat <= 9) return 'Fase D';
  if (tingkat === 10) return 'Fase E';
  return 'Fase F';
}

export function parseDapodikWebServiceResponses(params: {
  sourceHost: string;
  npsn: string;
  sekolahRaw?: unknown;
  rombelRaw?: unknown;
  pesertaDidikRaw?: unknown;
  gtkRaw?: unknown;
  fallbackSchoolName?: string;
  fallbackAlamat?: string;
  fallbackRombelId?: string;
}): {
  payload: DapodikIncomingPayload;
  detectedSchoolName: string;
  rombelCount: number;
  studentCount: number;
} {
  const cleanBase = params.sourceHost.trim().replace(/\/+$/, '');
  const sekolahRows = extractDapodikRows(params.sekolahRaw);
  const rombelRows = extractDapodikRows(params.rombelRaw);
  const pdRows = extractDapodikRows(params.pesertaDidikRaw);
  const gtkRows = extractDapodikRows(params.gtkRaw);

  const gtkNameById = new Map<string, { nama: string; nip: string }>();
  for (const g of gtkRows) {
    const ptkId = String(g.ptk_id || '').trim();
    if (ptkId) {
      gtkNameById.set(ptkId, {
        nama: String(g.nama || 'Guru / Wali Kelas'),
        nip: String(g.nip || '-'),
      });
    }
  }

  const incomingPayload: DapodikIncomingPayload = {
    sourceHost: cleanBase,
  };

  let detectedSchoolName = params.fallbackSchoolName || `Sekolah NPSN ${params.npsn}`;

  if (sekolahRows.length > 0) {
    const sk = sekolahRows[0];
    detectedSchoolName = String(sk.nama || detectedSchoolName);
    incomingPayload.school = {
      namaSekolah: detectedSchoolName,
      npsn: String(sk.npsn || params.npsn),
      alamat: String(sk.alamat_jalan || params.fallbackAlamat || '-'),
      kelurahan: sk.desa_kelurahan ? String(sk.desa_kelurahan) : undefined,
      kecamatan: sk.kecamatan ? String(sk.kecamatan) : undefined,
      kabupaten: sk.kabupaten_kota ? String(sk.kabupaten_kota) : undefined,
      provinsi: sk.provinsi ? String(sk.provinsi) : undefined,
    };
  }

  const rombelIdByName = new Map<string, string>();
  if (rombelRows.length > 0) {
    incomingPayload.rombels = rombelRows.map((r, idx) => {
      const rbId = String(r.rombongan_belajar_id || `rombel-live-${idx}`);
      const rbNama = String(r.nama || `Rombel ${idx + 1}`);
      const tingkat = parseTingkatFromDapodik(
        r.tingkat_pendidikan_id,
        r.tingkat_pendidikan_id_str
      );
      const ptkId = String(r.ptk_id || `ptk-${idx}`);
      const gtkMatch = gtkNameById.get(ptkId);
      const waliNama = String(
        r.ptk_id_str || r.wali_kelas || gtkMatch?.nama || 'Wali Kelas Dapodik'
      );
      const waliNip = String(r.nip_wali || gtkMatch?.nip || '-');
      const kurStr = String(r.kurikulum_id_str || '');
      const kurikulum: KurikulumType = kurStr.includes('2013')
        ? 'Kurikulum 2013'
        : 'Kurikulum Merdeka';

      rombelIdByName.set(rbNama.toLowerCase(), rbId);

      return {
        id: rbId,
        dapodikRombelId: rbId,
        nama: rbNama,
        tingkat,
        fase: resolveFaseByTingkat(tingkat),
        waliKelasId: ptkId,
        waliKelasNama: waliNama,
        waliKelasNip: waliNip,
        kurikulum,
      };
    });
  }

  const defaultRombelId =
    incomingPayload.rombels?.[0]?.id ||
    params.fallbackRombelId ||
    `rombel-${params.npsn}-1`;

  if (params.pesertaDidikRaw !== undefined) {
    incomingPayload.students = pdRows.map((p, idx) => {
      const rawRbId = p.rombongan_belajar_id
        ? String(p.rombongan_belajar_id)
        : undefined;
      const rawRbNama = p.nama_rombel ? String(p.nama_rombel).toLowerCase() : undefined;
      const resolvedRombelId =
        rawRbId || (rawRbNama && rombelIdByName.get(rawRbNama)) || defaultRombelId;

      return {
        id: String(p.peserta_didik_id || `std-live-${idx}`),
        pesertaDidikId: String(p.peserta_didik_id || `PD-LIVE-${idx}`),
        nisn: String(p.nisn || '-'),
        nipd: String(p.nipd || '-'),
        nama: String(p.nama || `Peserta Didik ${idx + 1}`),
        jenisKelamin: String(p.jenis_kelamin || 'L').toUpperCase() === 'P' ? 'P' : 'L',
        tempatLahir: String(p.tempat_lahir || '-'),
        tanggalLahir: String(p.tanggal_lahir || '2014-01-01'),
        agama: String(p.agama_id_str || 'Islam'),
        rombelId: resolvedRombelId,
        namaOrangTua: String(
          p.nama_ibu_kandung || p.nama_ibu || p.nama_ayah || p.nama_wali || 'Orang Tua/Wali'
        ),
        alamat: String(p.alamat_jalan || '-'),
        statusAktif: 'Aktif',
      };
    });
  }

  return {
    payload: incomingPayload,
    detectedSchoolName,
    rombelCount: incomingPayload.rombels?.length ?? 0,
    studentCount: incomingPayload.students?.length ?? 0,
  };
}

export function normalizeDapodikWebServiceUrl(rawInput: string): string {
  const trimmed = rawInput.trim();
  if (!trimmed) {
    return 'http://localhost:5774/WebService';
  }
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `http://${trimmed}`;
  try {
    const parsed = new URL(withScheme);
    let cleanPath = parsed.pathname.replace(/\/+$/, '');
    cleanPath = cleanPath.replace(
      /\/(getSekolah|getRombonganBelajar|getPesertaDidik|getGtk|getPengguna)$/i,
      ''
    );
    if (!cleanPath || cleanPath === '/') {
      cleanPath = '/WebService';
    } else if (!/\/webservice$/i.test(cleanPath)) {
      cleanPath = `${cleanPath}/WebService`;
    }
    return `${parsed.origin}${cleanPath}`;
  } catch {
    return trimmed.replace(/\/+$/, '');
  }
}

export function parseDapodikTabularRows(
  rows: unknown[][],
  schoolContext: { npsn: string; namaSekolah: string; kurikulum?: KurikulumType; sourceLabel?: string }
): DapodikIncomingPayload {
  const normalizedRows = rows
    .map((r) => (Array.isArray(r) ? r.map((cell) => String(cell ?? '').trim()) : []))
    .filter((r) => r.some((cell) => cell.length > 0));

  if (normalizedRows.length === 0) {
    throw new Error('Berkas atau tabel kosong. Pastikan berisi minimal 1 baris data peserta didik.');
  }

  // Scan top 30 rows to locate the true Dapodik header row (Dapodik .xlsx exports have 3-6 title rows first)
  let headerRowIdx = -1;
  let bestScore = 0;
  const scanLimit = Math.min(30, normalizedRows.length);

  for (let r = 0; r < scanLimit; r++) {
    const cells = normalizedRows[r].map((c) => c.toLowerCase());
    let score = 0;
    const has = (kw: string) => cells.some((c) => c === kw || c.includes(kw));
    if (has('nisn')) score += 3;
    if (has('nipd')) score += 3;
    if (cells.some((c) => c === 'nama' || c.includes('nama peserta') || c.includes('nama siswa'))) score += 3;
    if (has('rombel') || cells.some((c) => c === 'kelas' || c.includes('kelas saat ini'))) score += 2;
    if (cells.some((c) => c === 'jk' || c === 'l/p' || c.includes('jenis kelamin'))) score += 2;
    if (has('tempat lahir') || has('tanggal lahir') || has('nama ibu') || has('nama ayah')) score += 1;

    if (score >= 4 && score > bestScore) {
      bestScore = score;
      headerRowIdx = r;
    }
  }

  const hasHeader = headerRowIdx >= 0;
  const headerCells = hasHeader ? normalizedRows[headerRowIdx].map((c) => c.toLowerCase()) : [];
  const dataRows = hasHeader ? normalizedRows.slice(headerRowIdx + 1) : normalizedRows;

  if (dataRows.length === 0) {
    throw new Error('Header tabel ditemukan, namun belum ada baris peserta didik di bawahnya.');
  }

  const findExactOrMatch = (
    exactCandidates: string[],
    partialCandidates: string[],
    excludePatterns: string[],
    fallbackIndex: number
  ): number => {
    if (headerCells.length === 0) return fallbackIndex;
    const exactIdx = headerCells.findIndex((h) => exactCandidates.includes(h));
    if (exactIdx >= 0) return exactIdx;
    const partialIdx = headerCells.findIndex(
      (h) =>
        partialCandidates.some((p) => h.includes(p)) &&
        !excludePatterns.some((ex) => h.includes(ex))
    );
    return partialIdx >= 0 ? partialIdx : -1;
  };

  const colNisn = findExactOrMatch(['nisn'], ['nisn'], [], hasHeader ? -1 : 0);
  const colNipd = findExactOrMatch(['nipd', 'nis'], ['nipd', 'no induk'], [], hasHeader ? -1 : 1);
  const colNama = findExactOrMatch(
    ['nama', 'nama peserta didik', 'nama siswa', 'nama lengkap'],
    ['nama peserta', 'nama siswa', 'nama lengkap'],
    ['ayah', 'ibu', 'wali', 'orang tua', 'ortu', 'rombel', 'kelas', 'sekolah'],
    hasHeader ? -1 : 2
  );
  const colJk = findExactOrMatch(['jk', 'l/p', 'jenis kelamin'], ['kelamin'], [], hasHeader ? -1 : 3);
  const colRombel = findExactOrMatch(
    ['rombel saat ini', 'rombel', 'nama rombel', 'kelas'],
    ['rombel', 'kelas saat ini'],
    ['wali kelas'],
    hasHeader ? -1 : 4
  );
  const colOrtu = findExactOrMatch(
    ['nama orang tua', 'orang tua', 'nama ibu', 'nama ayah', 'nama wali'],
    ['orang tua', 'ortu', 'ibu', 'ayah', 'wali murid'],
    ['wali kelas'],
    hasHeader ? -1 : 5
  );
  const colTempatLahir = findExactOrMatch(['tempat lahir', 'tmp lahir'], ['tempat lahir'], [], -1);
  const colTglLahir = findExactOrMatch(['tanggal lahir', 'tgl lahir'], ['tanggal lahir', 'tgl lahir'], [], -1);
  const colAgama = findExactOrMatch(['agama'], ['agama'], [], -1);
  const colAlamat = findExactOrMatch(['alamat', 'alamat jalan'], ['alamat'], [], -1);

  const rombelMap = new Map<string, DapodikRombel>();
  const students: DapodikStudent[] = [];

  dataRows.forEach((cols, idx) => {
    const rawNama = colNama >= 0 ? cols[colNama] || '' : cols[0] || '';
    const nama = rawNama.trim();
    // Skip empty rows, merged-number subheaders ("1", "2", ...), or summary footer rows
    if (!nama || /^\d{1,4}$/.test(nama) || /^total\b|^jumlah\b/i.test(nama)) {
      return;
    }

    const rawNisn = colNisn >= 0 ? (cols[colNisn] || '').trim() : '';
    const nisn = rawNisn && rawNisn !== '-' ? rawNisn : `000000${String(students.length + 1).padStart(4, '0')}`;
    const rawNipd = colNipd >= 0 ? (cols[colNipd] || '').trim() : '';
    const nipd = rawNipd && rawNipd !== '-' ? rawNipd : String(25000 + students.length + 1);
    const jkRaw = (colJk >= 0 ? cols[colJk] || 'L' : 'L').trim().toUpperCase();
    const jenisKelamin: 'L' | 'P' = jkRaw.startsWith('P') || jkRaw.startsWith('W') ? 'P' : 'L';
    const rombelNama = (colRombel >= 0 ? cols[colRombel] || '' : '').trim() || 'Kelas Umum';
    const namaOrangTua = (colOrtu >= 0 ? cols[colOrtu] || '' : '').trim() || 'Orang Tua / Wali';

    const rombelSlug = rombelNama
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    const rombelId = `rombel-${schoolContext.npsn}-${rombelSlug || 'umum'}`;

    if (!rombelMap.has(rombelId)) {
      const tingkat = parseTingkatFromDapodik(undefined, rombelNama);
      rombelMap.set(rombelId, {
        id: rombelId,
        dapodikRombelId: `RB-${schoolContext.npsn}-${rombelSlug || 'umum'}`,
        nama: rombelNama,
        tingkat,
        fase: resolveFaseByTingkat(tingkat),
        waliKelasId: `PTK-${schoolContext.npsn}-${rombelMap.size + 1}`,
        waliKelasNama: 'Wali Kelas',
        waliKelasNip: '-',
        kurikulum: schoolContext.kurikulum || 'Kurikulum Merdeka',
      });
    }

    const uniqueKey = nisn !== '-' && nisn.length >= 4 ? nisn : `ROW-${idx + 1}`;
    students.push({
      id: `std-${schoolContext.npsn}-${uniqueKey}`,
      pesertaDidikId: `PD-${schoolContext.npsn}-${uniqueKey}`,
      nisn,
      nipd,
      nama,
      jenisKelamin,
      tempatLahir: (colTempatLahir >= 0 ? cols[colTempatLahir] : '') || '-',
      tanggalLahir: (colTglLahir >= 0 ? cols[colTglLahir] : '') || '2013-01-01',
      agama: (colAgama >= 0 ? cols[colAgama] : '') || 'Islam',
      rombelId,
      namaOrangTua,
      alamat: (colAlamat >= 0 ? cols[colAlamat] : '') || '-',
      statusAktif: 'Aktif',
    });
  });

  if (students.length === 0) {
    throw new Error(
      'Tidak ditemukan baris nama peserta didik yang valid. Pastikan kolom Nama & Rombel terisi.'
    );
  }

  return {
    sourceHost: schoolContext.sourceLabel || `excel-import://${schoolContext.npsn}`,
    rombels: Array.from(rombelMap.values()),
    students,
  };
}

export function parseDapodikCsvToPayload(
  rawText: string,
  schoolContext: { npsn: string; namaSekolah: string; kurikulum?: KurikulumType }
): DapodikIncomingPayload {
  const lines = rawText
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  if (lines.length === 0) {
    throw new Error('Berkas atau teks CSV kosong. Pastikan berisi minimal 1 baris data siswa.');
  }

  // Pick delimiter across first few non-empty lines
  const sampleText = lines.slice(0, 5).join('\n');
  const delimiter = sampleText.includes('\t')
    ? '\t'
    : (sampleText.match(/;/g)?.length ?? 0) >= (sampleText.match(/,/g)?.length ?? 0)
      ? ';'
      : ',';

  const splitRow = (line: string): string[] => {
    const cells: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (ch === delimiter && !inQuotes) {
        cells.push(current.trim());
        current = '';
      } else {
        current += ch;
      }
    }
    cells.push(current.trim());
    return cells;
  };

  const rows = lines.map(splitRow);
  return parseDapodikTabularRows(rows, {
    ...schoolContext,
    sourceLabel: `csv-import://${schoolContext.npsn}`,
  });
}

export async function safeParseJsonResponse<T = unknown>(
  res: Response,
  context: 'api' | 'dapodik' = 'api'
): Promise<T> {
  const rawText = await res.text();
  const trimmed = rawText.trim();

  if (!trimmed) {
    throw new Error(
      context === 'dapodik'
        ? `WebService Dapodik tidak mengembalikan data (HTTP ${res.status}).`
        : `Server tidak mengembalikan respons (HTTP ${res.status}).`
    );
  }

  if (
    trimmed.startsWith('<') ||
    /^<!doctype/i.test(trimmed) ||
    /^<html/i.test(trimmed)
  ) {
    if (context === 'dapodik') {
      throw new Error(
        `Alamat WebService Dapodik mengembalikan halaman web (HTML, HTTP ${res.status}), bukan data JSON Dapodik. Pastikan alamat berakhiran /WebService dan token benar.`
      );
    }
    throw new Error(
      `Server sedang memuat ulang atau mengembalikan halaman web (HTTP ${res.status}). Muat ulang halaman (F5) lalu coba kembali.`
    );
  }

  try {
    return JSON.parse(trimmed) as T;
  } catch {
    throw new Error(
      context === 'dapodik'
        ? 'Format balasan dari WebService Dapodik bukan JSON yang valid.'
        : `Format balasan server bukan JSON yang valid (HTTP ${res.status}).`
    );
  }
}

export function parseDapodikImportText(
  rawText: string,
  schoolContext: { npsn: string; namaSekolah: string; kurikulum?: KurikulumType }
): DapodikIncomingPayload {
  const trimmed = rawText.trim();
  if (!trimmed) {
    throw new Error('File atau teks impor masih kosong.');
  }

  if (
    trimmed.startsWith('<') ||
    /^<!doctype/i.test(trimmed) ||
    /^<html/i.test(trimmed)
  ) {
    throw new Error(
      'File yang dipilih adalah halaman web (HTML), bukan JSON atau CSV Dapodik. Ekspor data sebagai CSV (.csv) atau JSON (.json) terlebih dahulu.'
    );
  }

  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed) as DapodikIncomingPayload & {
        rows?: unknown;
      };
      // Support raw Kemdikdasmen WebService export JSON { rows: [...] } directly too!
      if (parsed && !parsed.students && !parsed.rombels && parsed.rows) {
        return parseDapodikWebServiceResponses({
          sourceHost: `json-import://${schoolContext.npsn}`,
          npsn: schoolContext.npsn,
          pesertaDidikRaw: parsed,
          fallbackSchoolName: schoolContext.namaSekolah,
        }).payload;
      }
      return parsed;
    } catch {
      throw new Error('File JSON tidak valid. Periksa isi file atau gunakan format CSV Excel.');
    }
  }

  return parseDapodikCsvToPayload(trimmed, schoolContext);
}

export function normalizeNpsnInput(raw: string): string {
  return String(raw || '').replace(/\D/g, '').slice(0, 8);
}

export function validateNpsnFormat(npsn: string): {
  valid: boolean;
  clean: string;
  error?: string;
} {
  const clean = String(npsn || '').trim().replace(/\D/g, '');
  if (clean.length !== 8) {
    return {
      valid: false,
      clean: clean.slice(0, 8),
      error:
        clean.length === 0
          ? 'Masukkan 8 digit NPSN sekolah terlebih dahulu.'
          : `NPSN sekolah harus tepat 8 digit angka (saat ini ${clean.length}/8 digit).`,
    };
  }
  return { valid: true, clean };
}

export function inferJenjangFromSchoolName(name: string): SchoolJenjang {
  const upper = String(name || '').toUpperCase();
  if (/\bSMKN?\b|\bSEKOLAH MENENGAH KEJURUAN\b/.test(upper)) return 'SMK';
  if (/\bSMAN?\b|\bMAN\b|\bMA\s|\bSEKOLAH MENENGAH ATAS\b/.test(upper)) return 'SMA';
  if (/\bSMPN?\b|\bMTSN?\b|\bSEKOLAH MENENGAH PERTAMA\b/.test(upper)) return 'SMP';
  return 'SD';
}

function decodeHtmlEntitiesSimple(input: string): string {
  return input
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#0*39;|&apos;/gi, "'")
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function parseKemdikbudNpsnHtml(
  html: string,
  npsn: string
): {
  npsn: string;
  namaSekolah: string;
  jenjang: SchoolJenjang;
  alamat?: string;
  kecamatan?: string;
  kabupaten?: string;
  provinsi?: string;
} | null {
  if (!html || typeof html !== 'string') return null;

  const fieldMap: Record<string, string> = {};
  const rowRegex =
    /<tr[^>]*>\s*(?:<td[^>]*>[\s\S]*?<\/td>\s*)*<\/tr>/gi;
  const cellRegex = /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi;

  const rows = html.match(rowRegex) || [];
  for (const rowHtml of rows) {
    const cells: string[] = [];
    let m: RegExpExecArray | null;
    cellRegex.lastIndex = 0;
    while ((m = cellRegex.exec(rowHtml)) !== null) {
      const text = decodeHtmlEntitiesSimple(m[1].replace(/<[^>]+>/g, ' '));
      cells.push(text);
    }
    if (cells.length >= 2) {
      const key = cells[0].toLowerCase().replace(/[:\s]+/g, ' ').trim();
      const rawVal = cells[cells.length - 1].replace(/^:\s*/, '').trim();
      if (key && rawVal && rawVal !== '-' && rawVal !== ':') {
        fieldMap[key] = rawVal;
      }
    }
  }

  let namaSekolah =
    fieldMap['nama'] ||
    fieldMap['nama satuan pendidikan'] ||
    fieldMap['nama sekolah'] ||
    '';

  if (!namaSekolah) {
    const h4Match = html.match(/<h4[^>]*>([\s\S]*?)<\/h4>/i);
    if (h4Match) {
      const candidate = decodeHtmlEntitiesSimple(h4Match[1].replace(/<[^>]+>/g, ' '));
      if (candidate && !/npsn|referensi/i.test(candidate)) {
        namaSekolah = candidate;
      }
    }
  }

  if (!namaSekolah) return null;

  const bentuk = fieldMap['bentuk pendidikan'] || '';
  const jenjang = inferJenjangFromSchoolName(`${bentuk} ${namaSekolah}`);

  return {
    npsn: normalizeNpsnInput(npsn),
    namaSekolah,
    jenjang,
    alamat: fieldMap['alamat'] || undefined,
    kecamatan:
      fieldMap['kecamatan'] || fieldMap['kec./kota (ln)'] || undefined,
    kabupaten:
      fieldMap['kab.-kota/negara (ln)'] ||
      fieldMap['kabupaten/kota'] ||
      fieldMap['kabupaten'] ||
      undefined,
    provinsi:
      fieldMap['propinsi/luar negeri (ln)'] ||
      fieldMap['provinsi'] ||
      fieldMap['propinsi'] ||
      undefined,
  };
}

export function validateLoginInput(input: {
  username: string;
  password: string;
  npsn?: string;
}): {
  valid: boolean;
  error?: string;
  normalized: { username: string; password: string; npsn: string };
} {
  const username = input.username.trim();
  const password = input.password;
  const npsn = (input.npsn || '').trim();

  if (npsn && !/^\d{8}$/.test(npsn)) {
    return {
      valid: false,
      error: 'NPSN sekolah harus terdiri dari 8 digit angka.',
      normalized: { username, password, npsn },
    };
  }
  if (!username) {
    return {
      valid: false,
      error: 'Masukkan username atau NIP akun terlebih dahulu.',
      normalized: { username, password, npsn },
    };
  }
  if (!password || password.length < 4) {
    return {
      valid: false,
      error: 'Kata sandi wajib diisi (minimal 4 karakter).',
      normalized: { username, password, npsn },
    };
  }
  return {
    valid: true,
    normalized: { username, password, npsn },
  };
}

export function createGuruSubmission(
  dataset: EraporDataset,
  params: {
    rombelId: string;
    submittedBy: string;
    submittedByNip?: string;
    notes?: string;
  }
): { nextDataset: EraporDataset; submission: GuruSubmission } {
  const targetRombel =
    dataset.rombels.find((r) => r.id === params.rombelId) || dataset.rombels[0];
  if (!targetRombel) {
    throw new Error('Rombel tidak ditemukan pada data sekolah ini.');
  }

  const leger = computeLegerRombel(dataset, targetRombel.id);
  const activeStudentIds = new Set(leger.rows.map((r) => r.student.id));
  const gradesCount = dataset.grades.filter(
    (g) =>
      g.rombelId === targetRombel.id &&
      activeStudentIds.has(g.studentId) &&
      g.nilaiAkhir > 0
  ).length;
  const waliCount = dataset.waliRecords.filter(
    (w) => w.rombelId === targetRombel.id && activeStudentIds.has(w.studentId)
  ).length;

  const nowIso = new Date().toISOString();
  const submissionId = `sub-${dataset.school.npsn}-${targetRombel.id}`;
  const submission: GuruSubmission = {
    id: submissionId,
    schoolNpsn: dataset.school.npsn,
    rombelId: targetRombel.id,
    rombelNama: targetRombel.nama,
    submittedBy: params.submittedBy.trim() || targetRombel.waliKelasNama,
    submittedByNip: (params.submittedByNip || targetRombel.waliKelasNip || '-').trim(),
    submittedAt: nowIso,
    gradesCount,
    waliCount,
    studentCount: leger.rows.length,
    completionPct: leger.completionRate,
    notes: params.notes?.trim() || undefined,
    status: 'menunggu_operator',
    dapodikSyncVerified: false,
  };

  const existing = dataset.submissions ?? [];
  const filtered = existing.filter((s) => s.id !== submissionId);
  const nextSubmissions = [submission, ...filtered];

  const integrityHash = computeDeterministicChecksum({
    submissionId,
    gradesCount,
    waliCount,
    submittedAt: nowIso,
  }).slice(0, 16);

  const auditEntry: AuditLogEntry = {
    id: `aud-sub-${Date.now()}`,
    timestamp: nowIso,
    actor: submission.submittedBy,
    action: 'GURU_KIRIM_DATA_KE_OPERATOR',
    target: `${targetRombel.nama} (${gradesCount} nilai · ${waliCount} catatan wali · ${leger.completionRate}%)`,
    readOnlyGuardPassed: true,
    integrityHash,
  };

  return {
    submission,
    nextDataset: {
      ...dataset,
      submissions: nextSubmissions,
      auditLogs: [auditEntry, ...dataset.auditLogs].slice(0, 40),
    },
  };
}

export function applyOperatorSubmissionAction(
  dataset: EraporDataset,
  params: {
    submissionId?: string;
    rombelId?: string;
    action: 'sync_dapodik' | 'print_rapor';
    operatorName: string;
  }
): { nextDataset: EraporDataset; updatedSubmission: GuruSubmission } {
  const nowIso = new Date().toISOString();
  const existing = [...(dataset.submissions ?? [])];
  let idx = params.submissionId
    ? existing.findIndex((s) => s.id === params.submissionId)
    : -1;

  if (idx < 0 && params.rombelId) {
    idx = existing.findIndex((s) => s.rombelId === params.rombelId);
  }

  let targetSub: GuruSubmission;
  if (idx >= 0) {
    targetSub = existing[idx];
  } else {
    const rb =
      dataset.rombels.find((r) => r.id === params.rombelId) || dataset.rombels[0];
    if (!rb) {
      throw new Error('Data rombel tidak ditemukan untuk diproses operator.');
    }
    const leger = computeLegerRombel(dataset, rb.id);
    const activeIds = new Set(leger.rows.map((r) => r.student.id));
    targetSub = {
      id: `sub-${dataset.school.npsn}-${rb.id}`,
      schoolNpsn: dataset.school.npsn,
      rombelId: rb.id,
      rombelNama: rb.nama,
      submittedBy: rb.waliKelasNama,
      submittedByNip: rb.waliKelasNip,
      submittedAt: nowIso,
      gradesCount: dataset.grades.filter(
        (g) => g.rombelId === rb.id && activeIds.has(g.studentId) && g.nilaiAkhir > 0
      ).length,
      waliCount: dataset.waliRecords.filter(
        (w) => w.rombelId === rb.id && activeIds.has(w.studentId)
      ).length,
      studentCount: leger.rows.length,
      completionPct: leger.completionRate,
      status: 'menunggu_operator',
    };
  }

  const nextStatus: GuruSubmissionStatus =
    params.action === 'sync_dapodik' ? 'tersinkron_dapodik' : 'dicetak_rapor';

  const updatedSubmission: GuruSubmission = {
    ...targetSub,
    status: nextStatus,
    operatorActionBy: params.operatorName.trim() || 'Operator Sekolah',
    operatorActionAt: nowIso,
    dapodikSyncVerified:
      params.action === 'sync_dapodik' ? true : targetSub.dapodikSyncVerified,
  };

  const nextSubmissions =
    idx >= 0
      ? existing.map((item, i) => (i === idx ? updatedSubmission : item))
      : [updatedSubmission, ...existing];

  const integrityHash = computeDeterministicChecksum({
    submissionId: updatedSubmission.id,
    action: params.action,
    ts: nowIso,
  }).slice(0, 16);

  const auditEntry: AuditLogEntry = {
    id: `aud-op-${Date.now()}`,
    timestamp: nowIso,
    actor: updatedSubmission.operatorActionBy || 'Operator Sekolah',
    action:
      params.action === 'sync_dapodik'
        ? 'OPERATOR_SINKRON_KE_DAPODIK'
        : 'OPERATOR_LANGSUNG_CETAK_RAPOR',
    target: `${updatedSubmission.rombelNama} (${updatedSubmission.gradesCount} nilai siap)`,
    readOnlyGuardPassed: true,
    integrityHash,
  };

  return {
    updatedSubmission,
    nextDataset: {
      ...dataset,
      submissions: nextSubmissions,
      auditLogs: [auditEntry, ...dataset.auditLogs].slice(0, 40),
    },
  };
}

export function buildDapodikNilaiCsvExport(
  dataset: EraporDataset,
  rombelId?: string
): { filename: string; csvContent: string; rowCount: number } {
  const targetRombels = rombelId
    ? dataset.rombels.filter((r) => r.id === rombelId)
    : dataset.rombels;

  const header = [
    'NPSN',
    'Semester',
    'Rombel',
    'NISN',
    'NIPD',
    'Nama Peserta Didik',
    'Kode Mapel',
    'Mata Pelajaran',
    'Nilai Akhir',
    'Predikat',
    'Deskripsi Capaian Kompetensi',
  ];

  const rows: string[] = [header.join(';')];
  let rowCount = 0;

  for (const rb of targetRombels) {
    const leger = computeLegerRombel(dataset, rb.id);
    for (const r of leger.rows) {
      for (const sub of leger.subjects) {
        const grade = dataset.grades.find(
          (g) => g.studentId === r.student.id && g.mapelId === sub.id
        );
        if (grade && grade.nilaiAkhir > 0) {
          rowCount++;
          const safeDesc = (grade.deskripsiCapaian || '').replace(/[\r\n;]+/g, ' ');
          rows.push(
            [
              dataset.school.npsn,
              dataset.school.semesterId,
              `"${rb.nama}"`,
              `"${r.student.nisn}"`,
              `"${r.student.nipd}"`,
              `"${r.student.nama}"`,
              sub.kode,
              `"${sub.nama}"`,
              grade.nilaiAkhir,
              grade.predikat,
              `"${safeDesc}"`,
            ].join(';')
          );
        }
      }
    }
  }

  const label =
    targetRombels.length === 1
      ? targetRombels[0].nama.replace(/[^a-zA-Z0-9]+/g, '-')
      : 'Semua-Rombel';
  return {
    filename: `Paket-Kirim-Nilai-Dapodik-${dataset.school.npsn}-${label}.csv`,
    csvContent: rows.join('\n'),
    rowCount,
  };
}

export function validateKktpValue(raw: unknown): {
  valid: boolean;
  kktp: number;
  error?: string;
} {
  if (raw === null || raw === undefined || String(raw).trim() === '') {
    return {
      valid: false,
      kktp: 75,
      error: 'Nilai KKTP wajib diisi (angka bulat antara 50 sampai 95).',
    };
  }
  const num = Number(raw);
  if (!Number.isFinite(num) || !Number.isInteger(num)) {
    return {
      valid: false,
      kktp: 75,
      error: 'Nilai KKTP harus berupa angka bulat antara 50 sampai 95.',
    };
  }
  if (num < 50 || num > 95) {
    return {
      valid: false,
      kktp: Math.max(50, Math.min(95, Math.round(num))),
      error: 'Nilai KKTP harus berada di rentang 50 sampai 95.',
    };
  }
  return { valid: true, kktp: num };
}

export function updateSubjectsKktp(
  dataset: EraporDataset,
  params: {
    updates: Array<{ mapelId: string; kktp: number }>;
    actor?: string;
  }
): {
  nextDataset: EraporDataset;
  updatedSubjects: DapodikSubject[];
  recalculatedGradesCount: number;
} {
  if (!Array.isArray(params.updates) || params.updates.length === 0) {
    throw new Error('Minimal satu mata pelajaran harus dipilih untuk mengubah KKTP.');
  }

  const updateMap = new Map<string, number>();
  for (const item of params.updates) {
    const check = validateKktpValue(item.kktp);
    if (!check.valid) {
      throw new Error(check.error || 'Nilai KKTP tidak valid.');
    }
    const exists = dataset.subjects.some((s) => s.id === item.mapelId);
    if (!exists) {
      throw new Error(`Mata pelajaran dengan ID "${item.mapelId}" tidak ditemukan.`);
    }
    updateMap.set(item.mapelId, check.kktp);
  }

  const changedPairs: string[] = [];
  const updatedSubjects: DapodikSubject[] = [];
  const nextSubjects = dataset.subjects.map((sub) => {
    const nextKkm = updateMap.get(sub.id);
    if (nextKkm === undefined) return sub;
    if (sub.kkm !== nextKkm) {
      changedPairs.push(`${sub.nama}: ${sub.kkm} -> ${nextKkm}`);
    } else {
      changedPairs.push(`${sub.nama}: ${nextKkm}`);
    }
    const updated: DapodikSubject = { ...sub, kkm: nextKkm };
    updatedSubjects.push(updated);
    return updated;
  });

  const subjectById = new Map(nextSubjects.map((s) => [s.id, s]));
  const studentById = new Map(dataset.students.map((st) => [st.id, st]));
  let recalculatedGradesCount = 0;

  const nextGrades = dataset.grades.map((grade) => {
    if (!updateMap.has(grade.mapelId)) return grade;
    const sub = subjectById.get(grade.mapelId);
    if (!sub) return grade;

    const { predikat } = computePredikat(grade.nilaiAkhir, sub.kkm);
    let nextDesc = grade.deskripsiCapaian;
    if (!grade.customDeskripsi && grade.nilaiAkhir > 0) {
      const student = studentById.get(grade.studentId);
      const tpForSubject = dataset.tujuanPembelajaran.filter(
        (tp) => tp.mapelId === sub.id
      );
      nextDesc = generateAutoDeskripsi({
        studentName: student?.nama || 'Peserta Didik',
        subjectName: sub.nama,
        nilaiAkhir: grade.nilaiAkhir,
        kkm: sub.kkm,
        tpList: tpForSubject,
        tpTercapaiIds: grade.tpTercapaiIds,
        tpPerluBimbinganIds: grade.tpPerluBimbinganIds,
      });
    }

    if (grade.predikat !== predikat || grade.deskripsiCapaian !== nextDesc) {
      recalculatedGradesCount++;
      return {
        ...grade,
        predikat,
        deskripsiCapaian: nextDesc,
      };
    }
    return grade;
  });

  const nowIso = new Date().toISOString();
  const auditEntry: AuditLogEntry = {
    id: `aud-kktp-${Date.now()}`,
    timestamp: nowIso,
    actor: params.actor || 'Guru Mata Pelajaran',
    action: 'UBAH_KKTP_MAPEL',
    target: changedPairs.slice(0, 4).join(', ') + (changedPairs.length > 4 ? ` (+${changedPairs.length - 4} lainnya)` : ''),
    readOnlyGuardPassed: true,
    integrityHash: computeDeterministicChecksum({
      updates: Array.from(updateMap.entries()),
      recalculatedGradesCount,
      nowIso,
    }).slice(0, 16),
  };

  return {
    updatedSubjects,
    recalculatedGradesCount,
    nextDataset: {
      ...dataset,
      subjects: nextSubjects,
      grades: nextGrades,
      auditLogs: [auditEntry, ...dataset.auditLogs].slice(0, 40),
    },
  };
}

export function upsertSubjectMapping(
  dataset: EraporDataset,
  params: {
    id?: string;
    kode: string;
    nama: string;
    kelompok: DapodikSubject['kelompok'];
    kkm: number;
    guruPengampu: string;
    nipGuru?: string;
    tingkatList?: number[];
    actor?: string;
  }
): {
  nextDataset: EraporDataset;
  subject: DapodikSubject;
  created: boolean;
} {
  const cleanKode = params.kode.trim().toUpperCase();
  const cleanNama = params.nama.trim();
  const cleanGuru = params.guruPengampu.trim() || 'Guru Mata Pelajaran';
  const cleanNip = (params.nipGuru || '-').trim() || '-';

  if (!cleanKode || cleanKode.length < 2) {
    throw new Error('Kode mata pelajaran minimal 2 karakter (misalnya MTK, BIND, MULOK).');
  }
  if (!cleanNama || cleanNama.length < 2) {
    throw new Error('Nama mata pelajaran wajib diisi.');
  }

  const kktpCheck = validateKktpValue(params.kkm);
  if (!kktpCheck.valid) {
    throw new Error(kktpCheck.error || 'Nilai KKTP harus antara 50 sampai 95.');
  }

  const defaultTingkat =
    dataset.school.jenjang === 'SMP'
      ? [7, 8, 9]
      : dataset.school.jenjang === 'SMA' || dataset.school.jenjang === 'SMK'
        ? [10, 11, 12]
        : [1, 2, 3, 4, 5, 6];

  const existing = params.id
    ? dataset.subjects.find((s) => s.id === params.id)
    : undefined;

  const targetSubject: DapodikSubject = {
    id: existing?.id || `mapel-${cleanKode.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Date.now().toString(36)}`,
    kode: cleanKode,
    nama: cleanNama,
    kelompok: params.kelompok || 'Umum',
    kkm: kktpCheck.kktp,
    tingkatList:
      params.tingkatList && params.tingkatList.length > 0
        ? params.tingkatList
        : existing?.tingkatList || defaultTingkat,
    guruPengampu: cleanGuru,
    nipGuru: cleanNip,
  };

  let workingDataset: EraporDataset = {
    ...dataset,
    subjects: existing
      ? dataset.subjects.map((s) => (s.id === existing.id ? targetSubject : s))
      : [...dataset.subjects, targetSubject],
  };

  if (existing && existing.kkm !== targetSubject.kkm) {
    workingDataset = updateSubjectsKktp(workingDataset, {
      updates: [{ mapelId: targetSubject.id, kktp: targetSubject.kkm }],
      actor: params.actor || cleanGuru,
    }).nextDataset;
  } else {
    const nowIso = new Date().toISOString();
    const auditEntry: AuditLogEntry = {
      id: `aud-mapel-${Date.now()}`,
      timestamp: nowIso,
      actor: params.actor || 'Operator / Guru',
      action: existing ? 'PERBARUI_PEMETAAN_MAPEL' : 'TAMBAH_MATA_PELAJARAN',
      target: `${targetSubject.kode} · ${targetSubject.nama} (${targetSubject.guruPengampu})`,
      readOnlyGuardPassed: true,
      integrityHash: computeDeterministicChecksum({
        subject: targetSubject,
        nowIso,
      }).slice(0, 16),
    };
    workingDataset = {
      ...workingDataset,
      auditLogs: [auditEntry, ...workingDataset.auditLogs].slice(0, 40),
    };
  }

  return {
    nextDataset: workingDataset,
    subject: targetSubject,
    created: !existing,
  };
}

export function upsertTujuanPembelajaran(
  dataset: EraporDataset,
  params: {
    id?: string;
    mapelId: string;
    tingkat: number;
    kode: string;
    deskripsi: string;
    levelMendalam?: DeepLearningLevel;
    dimensiProfil?: string[];
    actor?: string;
  }
): {
  nextDataset: EraporDataset;
  tp: TujuanPembelajaran;
  created: boolean;
} {
  const subject = dataset.subjects.find((s) => s.id === params.mapelId);
  if (!subject) {
    throw new Error('Mata pelajaran tujuan pembelajaran tidak ditemukan.');
  }
  const cleanKode = params.kode.trim().toUpperCase();
  const cleanDeskripsi = params.deskripsi.trim();
  const tingkat = Number.isFinite(params.tingkat) ? Math.max(1, Math.min(12, Math.round(params.tingkat))) : 6;

  if (!cleanKode) {
    throw new Error('Kode TP wajib diisi (misalnya TP-MTK-01).');
  }
  if (cleanDeskripsi.length < 6) {
    throw new Error('Deskripsi Tujuan Pembelajaran minimal 6 karakter.');
  }

  const existing = params.id
    ? dataset.tujuanPembelajaran.find((t) => t.id === params.id)
    : undefined;

  const cleanDimensi = Array.isArray(params.dimensiProfil)
    ? Array.from(new Set(params.dimensiProfil.map((d) => d.trim()).filter(Boolean)))
    : existing?.dimensiProfil;

  const tp: TujuanPembelajaran = {
    id: existing?.id || `tp-${subject.kode.toLowerCase()}-${Date.now().toString(36)}`,
    mapelId: subject.id,
    tingkat,
    kode: cleanKode,
    deskripsi: cleanDeskripsi,
    levelMendalam: params.levelMendalam ?? existing?.levelMendalam,
    dimensiProfil: cleanDimensi && cleanDimensi.length > 0 ? cleanDimensi : undefined,
  };

  const nextTps = existing
    ? dataset.tujuanPembelajaran.map((t) => (t.id === existing.id ? tp : t))
    : [...dataset.tujuanPembelajaran, tp];

  const nowIso = new Date().toISOString();
  const auditEntry: AuditLogEntry = {
    id: `aud-tp-${Date.now()}`,
    timestamp: nowIso,
    actor: params.actor || subject.guruPengampu,
    action: existing ? 'PERBARUI_TP_MAPEL' : 'TAMBAH_TP_MAPEL',
    target: `${subject.kode} · ${tp.kode} (Kelas ${tp.tingkat})`,
    readOnlyGuardPassed: true,
    integrityHash: computeDeterministicChecksum({ tp, nowIso }).slice(0, 16),
  };

  return {
    nextDataset: {
      ...dataset,
      tujuanPembelajaran: nextTps,
      auditLogs: [auditEntry, ...dataset.auditLogs].slice(0, 40),
    },
    tp,
    created: !existing,
  };
}

export function deleteTujuanPembelajaran(
  dataset: EraporDataset,
  tpId: string,
  actor: string = 'Guru / Operator'
): EraporDataset {
  const target = dataset.tujuanPembelajaran.find((t) => t.id === tpId);
  if (!target) {
    throw new Error('Tujuan Pembelajaran tidak ditemukan.');
  }

  const nextTps = dataset.tujuanPembelajaran.filter((t) => t.id !== tpId);
  const nextGrades = dataset.grades.map((g) => {
    if (!g.tpTercapaiIds.includes(tpId) && !g.tpPerluBimbinganIds.includes(tpId)) {
      return g;
    }
    return {
      ...g,
      tpTercapaiIds: g.tpTercapaiIds.filter((id) => id !== tpId),
      tpPerluBimbinganIds: g.tpPerluBimbinganIds.filter((id) => id !== tpId),
    };
  });

  const nowIso = new Date().toISOString();
  const auditEntry: AuditLogEntry = {
    id: `aud-tp-del-${Date.now()}`,
    timestamp: nowIso,
    actor,
    action: 'HAPUS_TP_MAPEL',
    target: `${target.kode} · ${target.deskripsi.slice(0, 40)}`,
    readOnlyGuardPassed: true,
    integrityHash: computeDeterministicChecksum({ tpId, nowIso }).slice(0, 16),
  };

  return {
    ...dataset,
    tujuanPembelajaran: nextTps,
    grades: nextGrades,
    auditLogs: [auditEntry, ...dataset.auditLogs].slice(0, 40),
  };
}

export function parseImportedSubjectGradesRows(
  rows: unknown[][],
  context: {
    students: DapodikStudent[];
    subject: DapodikSubject;
    rombelId: string;
    semesterId: string;
    tpList: TujuanPembelajaran[];
    existingGrades: StudentGradeRecord[];
  }
): {
  records: StudentGradeRecord[];
  matchedCount: number;
  skippedCount: number;
} {
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new Error('File nilai Excel kosong.');
  }

  // Locate header row containing NISN / Nama / LM / SAS
  let headerIdx = -1;
  let nisnCol = -1;
  let nipdCol = -1;
  let namaCol = -1;
  let lm1Col = -1;
  let lm2Col = -1;
  let lm3Col = -1;
  let sasCol = -1;

  for (let i = 0; i < Math.min(rows.length, 20); i++) {
    const row = rows[i] || [];
    const normalized = row.map((cell) => String(cell ?? '').trim().toLowerCase());
    const hasName = normalized.findIndex((c) => c === 'nama' || c.includes('nama peserta') || c === 'nama siswa');
    const hasScore = normalized.findIndex((c) => c === 'lm 1' || c === 'lm1' || c === 's1' || c === 'sas' || c === 'uas');
    if (hasName >= 0 || hasScore >= 0) {
      headerIdx = i;
      nisnCol = normalized.findIndex((c) => c.includes('nisn'));
      nipdCol = normalized.findIndex((c) => c.includes('nipd') || c === 'nis');
      namaCol = hasName;
      lm1Col = normalized.findIndex((c) => c === 'lm 1' || c === 'lm1' || c === 's1' || c === 'sumatif 1');
      lm2Col = normalized.findIndex((c) => c === 'lm 2' || c === 'lm2' || c === 's2' || c === 'sumatif 2');
      lm3Col = normalized.findIndex((c) => c === 'lm 3' || c === 'lm3' || c === 's3' || c === 'sumatif 3');
      sasCol = normalized.findIndex((c) => c === 'sas' || c === 'uas' || c.includes('akhir semester'));
      break;
    }
  }

  if (headerIdx < 0 || (lm1Col < 0 && lm2Col < 0 && lm3Col < 0 && sasCol < 0)) {
    throw new Error(
      'Header kolom nilai tidak dikenali. Gunakan "Unduh Format Excel Nilai" agar kolom NISN, Nama, LM 1, LM 2, LM 3, dan SAS sesuai.'
    );
  }

  const byNisn = new Map(
    context.students
      .filter((s) => s.rombelId === context.rombelId && s.nisn.trim())
      .map((s) => [s.nisn.trim(), s])
  );
  const byNipd = new Map(
    context.students
      .filter((s) => s.rombelId === context.rombelId && s.nipd.trim())
      .map((s) => [s.nipd.trim(), s])
  );
  const byName = new Map(
    context.students
      .filter((s) => s.rombelId === context.rombelId)
      .map((s) => [s.nama.trim().toLowerCase(), s])
  );
  const existingByStudent = new Map(
    context.existingGrades
      .filter((g) => g.mapelId === context.subject.id)
      .map((g) => [g.studentId, g])
  );

  const parseCellScore = (val: unknown): number | null => {
    const str = String(val ?? '').trim();
    if (!str || str === '-' || str === '—') return null;
    const num = Number(str.replace(',', '.'));
    if (!Number.isFinite(num)) return null;
    return clampScore(num);
  };

  const records: StudentGradeRecord[] = [];
  let matchedCount = 0;
  let skippedCount = 0;
  const nowIso = new Date().toISOString();

  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i] || [];
    const nisnVal = nisnCol >= 0 ? String(row[nisnCol] ?? '').trim() : '';
    const nipdVal = nipdCol >= 0 ? String(row[nipdCol] ?? '').trim() : '';
    const namaVal = namaCol >= 0 ? String(row[namaCol] ?? '').trim() : '';
    if (!nisnVal && !nipdVal && !namaVal) continue;

    const student =
      (nisnVal ? byNisn.get(nisnVal) : undefined) ||
      (nipdVal ? byNipd.get(nipdVal) : undefined) ||
      (namaVal ? byName.get(namaVal.toLowerCase()) : undefined);

    if (!student) {
      skippedCount++;
      continue;
    }

    const prev = existingByStudent.get(student.id);
    const s1 = lm1Col >= 0 ? parseCellScore(row[lm1Col]) : (prev?.sumatifLingkup[0] ?? null);
    const s2 = lm2Col >= 0 ? parseCellScore(row[lm2Col]) : (prev?.sumatifLingkup[1] ?? null);
    const s3 = lm3Col >= 0 ? parseCellScore(row[lm3Col]) : (prev?.sumatifLingkup[2] ?? null);
    const sas = sasCol >= 0 ? parseCellScore(row[sasCol]) : (prev?.sumatifAkhirSemester ?? null);

    if (s1 === null && s2 === null && s3 === null && sas === null) {
      skippedCount++;
      continue;
    }

    const nextLingkup = [s1 ?? 0, s2 ?? 0, s3 ?? 0];
    const activeLingkup = nextLingkup.filter((v) => v > 0);
    const nilaiAkhir = calculateNilaiAkhir(
      activeLingkup.length > 0 ? activeLingkup : [0],
      sas
    );
    const { predikat } = computePredikat(nilaiAkhir, context.subject.kkm);
    const tpTercapaiIds =
      prev?.tpTercapaiIds && prev.tpTercapaiIds.length > 0
        ? prev.tpTercapaiIds
        : context.tpList.length > 0
          ? [context.tpList[0].id]
          : [];
    const tpPerluBimbinganIds = prev?.tpPerluBimbinganIds ?? [];

    const deskripsiCapaian =
      prev?.customDeskripsi
        ? prev.deskripsiCapaian
        : generateAutoDeskripsi({
            studentName: student.nama,
            subjectName: context.subject.nama,
            nilaiAkhir,
            kkm: context.subject.kkm,
            tpList: context.tpList,
            tpTercapaiIds,
            tpPerluBimbinganIds,
          });

    records.push({
      id: prev?.id || `grd-${student.id}-${context.subject.id}`,
      studentId: student.id,
      mapelId: context.subject.id,
      rombelId: context.rombelId,
      semesterId: context.semesterId,
      sumatifLingkup: nextLingkup,
      sumatifAkhirSemester: sas,
      tpTercapaiIds,
      tpPerluBimbinganIds,
      nilaiAkhir,
      predikat,
      deskripsiCapaian,
      customDeskripsi: prev?.customDeskripsi ?? false,
      updatedAt: nowIso,
      updatedBy: context.subject.guruPengampu,
      syncStatus: 'synced',
    });
    matchedCount++;
  }

  if (matchedCount === 0) {
    throw new Error(
      'Tidak ada siswa rombel ini yang cocok dengan NISN/Nama pada file Excel nilai.'
    );
  }

  return { records, matchedCount, skippedCount };
}

export function formatKokurikulerCapaianLabel(capaian: P5CapaianType): string {
  switch (capaian) {
    case 'Mahir':
    case 'SB':
      return 'Mahir (Sangat Baik)';
    case 'Cakap':
    case 'BSH':
      return 'Cakap (Sesuai Harapan)';
    case 'Berkembang':
    case 'MB':
      return 'Berkembang';
    case 'BB':
      return 'Berkembang (Awal)';
    default:
      return String(capaian);
  }
}

export function generateKokurikulerNarasi(params: {
  studentName: string;
  tema: string;
  bentukKegiatan?: KokurikulerBentukType;
  dimensiList: string[];
  capaian: P5CapaianType;
  prinsipDeepLearning?: string[];
}): string {
  const firstName = params.studentName.trim().split(/\s+/)[0] || params.studentName || 'Peserta didik';
  const bentuk = params.bentukKegiatan || 'Lintas Disiplin Ilmu';
  const dimensiText =
    params.dimensiList.length > 0
      ? params.dimensiList.join(', ')
      : 'Penalaran Kritis dan Kolaborasi';
  const temaClean = params.tema.trim() || 'kegiatan kokurikuler satuan pendidikan';
  const prinsipText =
    params.prinsipDeepLearning && params.prinsipDeepLearning.length > 0
      ? ` secara ${params.prinsipDeepLearning.map((p) => p.toLowerCase()).join(', ')}`
      : '';

  if (params.capaian === 'Mahir' || params.capaian === 'SB') {
    return `Ananda ${firstName} telah mencapai tahap Mahir dalam kegiatan kokurikuler (${bentuk}) bertema "${temaClean}"${prinsipText}. Ananda secara konsisten menunjukkan penguatan dimensi ${dimensiText} serta mampu menginspirasi teman sebaya dalam refleksi dan aksi nyata.`;
  }
  if (params.capaian === 'Cakap' || params.capaian === 'BSH') {
    return `Ananda ${firstName} berada pada tahap Cakap dalam kegiatan kokurikuler (${bentuk}) bertema "${temaClean}"${prinsipText}. Ananda mampu menerapkan dimensi ${dimensiText} secara mandiri dan berkontribusi aktif bersama kelompok.`;
  }
  return `Ananda ${firstName} sedang berada pada tahap Berkembang dalam kegiatan kokurikuler (${bentuk}) bertema "${temaClean}"${prinsipText}. Ananda terus didampingi secara positif dan bertahap untuk menguatkan dimensi ${dimensiText}.`;
}

export function getKkaElectiveTemplate(jenjang: SchoolJenjang): {
  subject: DapodikSubject;
  tujuanPembelajaran: TujuanPembelajaran[];
} {
  const tingkatList =
    jenjang === 'SD'
      ? [5, 6]
      : jenjang === 'SMP'
        ? [7, 8, 9]
        : [10, 11, 12];
  const baseTingkat = tingkatList[0];

  const subject: DapodikSubject = {
    id: 'mapel-kka',
    kode: 'KKA',
    nama: 'Koding dan Kecerdasan Artifisial',
    kelompok: 'Pilihan',
    kkm: 75,
    tingkatList,
    guruPengampu: 'Guru Pilihan KKA',
    nipGuru: '-',
  };

  const tujuanPembelajaran: TujuanPembelajaran[] = [
    {
      id: `tp-kka-${jenjang.toLowerCase()}-1`,
      mapelId: 'mapel-kka',
      tingkat: baseTingkat,
      kode: `TP.KKA.${baseTingkat}.1`,
      deskripsi:
        'Memahami prinsip berpikir komputasional (dekomposisi, pengenalan pola, abstraksi, algoritma) melalui aktivitas unplugged maupun plugged',
      levelMendalam: 'Memahami',
      dimensiProfil: ['Penalaran Kritis', 'Kemandirian'],
    },
    {
      id: `tp-kka-${jenjang.toLowerCase()}-2`,
      mapelId: 'mapel-kka',
      tingkat: baseTingkat,
      kode: `TP.KKA.${baseTingkat}.2`,
      deskripsi:
        'Mengaplikasikan pemrograman terstruktur berbasis blok/teks dan pemanfaatan sistem kecerdasan artifisial untuk memecahkan masalah kontekstual',
      levelMendalam: 'Mengaplikasi',
      dimensiProfil: ['Kreativitas', 'Kolaborasi', 'Penalaran Kritis'],
    },
    {
      id: `tp-kka-${jenjang.toLowerCase()}-3`,
      mapelId: 'mapel-kka',
      tingkat: baseTingkat,
      kode: `TP.KKA.${baseTingkat}.3`,
      deskripsi:
        'Merefleksikan etika penggunaan kecerdasan artifisial, privasi data, serta dampak sosial teknologi digital secara bertanggung jawab',
      levelMendalam: 'Merefleksi',
      dimensiProfil: ['Kewargaan', 'Komunikasi', 'Keimanan dan Ketakwaan terhadap Tuhan YME'],
    },
  ];

  return { subject, tujuanPembelajaran };
}

export function activateKkaElective(
  dataset: EraporDataset,
  actor: string = 'Operator / Kurikulum Sekolah'
): {
  nextDataset: EraporDataset;
  alreadyActive: boolean;
  addedTpCount: number;
} {
  const template = getKkaElectiveTemplate(dataset.school.jenjang);
  const existingSubject = dataset.subjects.find(
    (s) => s.id === 'mapel-kka' || s.kode.toUpperCase() === 'KKA'
  );

  const nextSubjects = existingSubject
    ? dataset.subjects
    : [...dataset.subjects, template.subject];

  const targetMapelId = existingSubject?.id || template.subject.id;
  const existingTpCodes = new Set(
    dataset.tujuanPembelajaran
      .filter((t) => t.mapelId === targetMapelId)
      .map((t) => t.kode.toUpperCase())
  );

  const tpsToAdd = template.tujuanPembelajaran
    .map((t) => ({ ...t, mapelId: targetMapelId }))
    .filter((t) => !existingTpCodes.has(t.kode.toUpperCase()));

  if (existingSubject && tpsToAdd.length === 0) {
    return {
      nextDataset: dataset,
      alreadyActive: true,
      addedTpCount: 0,
    };
  }

  const nowIso = new Date().toISOString();
  const auditEntry: AuditLogEntry = {
    id: `aud-kka-${Date.now()}`,
    timestamp: nowIso,
    actor,
    action: 'AKTIFKAN_MAPEL_PILIHAN_KKA_2026',
    target: `Koding dan Kecerdasan Artifisial (${dataset.school.jenjang}) · +${tpsToAdd.length} TP Pembelajaran Mendalam`,
    readOnlyGuardPassed: true,
    integrityHash: computeDeterministicChecksum({
      npsn: dataset.school.npsn,
      targetMapelId,
      addedTp: tpsToAdd.length,
      nowIso,
    }).slice(0, 16),
  };

  return {
    nextDataset: {
      ...dataset,
      subjects: nextSubjects,
      tujuanPembelajaran: [...dataset.tujuanPembelajaran, ...tpsToAdd],
      auditLogs: [auditEntry, ...dataset.auditLogs].slice(0, 40),
    },
    alreadyActive: Boolean(existingSubject),
    addedTpCount: tpsToAdd.length,
  };
}

export interface DeepLearningReadinessMetrics {
  totalTp: number;
  deepTpCount: number;
  tpCoveragePct: number;
  byLevel: Record<DeepLearningLevel, number>;
  kkaActive: boolean;
  kokurikuler2026Students: number;
  totalWaliStudents: number;
}

export function computeDeepLearningReadiness(
  dataset: EraporDataset
): DeepLearningReadinessMetrics {
  const byLevel: Record<DeepLearningLevel, number> = {
    Memahami: 0,
    Mengaplikasi: 0,
    Merefleksi: 0,
  };

  let deepTpCount = 0;
  for (const tp of dataset.tujuanPembelajaran) {
    if (tp.levelMendalam && tp.levelMendalam in byLevel) {
      byLevel[tp.levelMendalam] += 1;
      deepTpCount += 1;
    }
  }

  const totalTp = dataset.tujuanPembelajaran.length;
  const tpCoveragePct = totalTp > 0 ? Math.round((deepTpCount / totalTp) * 100) : 0;
  const kkaActive = dataset.subjects.some(
    (s) => s.id === 'mapel-kka' || s.kode.toUpperCase() === 'KKA'
  );

  let kokurikuler2026Students = 0;
  for (const w of dataset.waliRecords) {
    const has2026Entry = w.kokurikulerP5.some(
      (p) =>
        Boolean(p.bentukKegiatan) ||
        (Array.isArray(p.dimensiList) && p.dimensiList.length > 0) ||
        p.capaian === 'Berkembang' ||
        p.capaian === 'Cakap' ||
        p.capaian === 'Mahir'
    );
    if (has2026Entry) kokurikuler2026Students += 1;
  }

  return {
    totalTp,
    deepTpCount,
    tpCoveragePct,
    byLevel,
    kkaActive,
    kokurikuler2026Students,
    totalWaliStudents: dataset.waliRecords.length,
  };
}

export interface GradeDistributionBucket {
  key: '0_60' | '61_70' | '71_80' | '81_90' | '91_100';
  label: string;
  rangeLabel: string;
  count: number;
  pct: number;
  color: string;
}

export interface RombelGradeDistribution {
  rombelId: string;
  rombelNama: string;
  mapelId: string;
  mapelNama: string;
  kktpThreshold: number;
  totalStudents: number;
  gradedStudents: number;
  average: number;
  median: number;
  highest: number;
  lowest: number;
  stdDev: number;
  tuntasCount: number;
  tuntasPct: number;
  buckets: GradeDistributionBucket[];
}

export function computeRombelGradeDistribution(
  dataset: EraporDataset,
  rombelId: string,
  mapelId: string = 'ALL'
): RombelGradeDistribution {
  const isAllRombels = rombelId === 'ALL' || !rombelId;
  const targetRombel = isAllRombels
    ? undefined
    : dataset.rombels.find((r) => r.id === rombelId);
  const filterMapelId = mapelId && mapelId !== 'ALL' ? mapelId : undefined;
  const targetSubject = filterMapelId
    ? dataset.subjects.find((s) => s.id === filterMapelId)
    : undefined;

  const activeStudents = dataset.students.filter(
    (s) =>
      s.statusAktif === 'Aktif' &&
      (isAllRombels || s.rombelId === rombelId)
  );

  let totalSubjectKkm = 0;
  for (const s of dataset.subjects) {
    totalSubjectKkm += s.kkm;
  }
  const defaultKktp = targetSubject
    ? targetSubject.kkm
    : dataset.subjects.length > 0
      ? Math.round(totalSubjectKkm / dataset.subjects.length)
      : 75;

  const studentScores: number[] = [];
  let tuntasCount = 0;

  for (const student of activeStudents) {
    const studentGrades = dataset.grades.filter(
      (g) =>
        g.studentId === student.id &&
        g.nilaiAkhir > 0 &&
        (!filterMapelId || g.mapelId === filterMapelId)
    );
    if (studentGrades.length === 0) continue;

    if (filterMapelId) {
      const score = studentGrades[0].nilaiAkhir;
      studentScores.push(score);
      if (score >= defaultKktp) {
        tuntasCount += 1;
      }
    } else {
      const avg =
        studentGrades.reduce((acc, g) => acc + g.nilaiAkhir, 0) /
        studentGrades.length;
      studentScores.push(avg);
      if (Math.round(avg) >= defaultKktp) {
        tuntasCount += 1;
      }
    }
  }

  const buckets: GradeDistributionBucket[] = [
    {
      key: '0_60',
      label: '≤ 60',
      rangeLabel: '0–60 (Perlu Bimbingan Intensif)',
      count: 0,
      pct: 0,
      color: '#dc2626',
    },
    {
      key: '61_70',
      label: '61–70',
      rangeLabel: '61–70 (Perlu Penguatan KKTP)',
      count: 0,
      pct: 0,
      color: '#d97706',
    },
    {
      key: '71_80',
      label: '71–80',
      rangeLabel: '71–80 (Cukup / Cakap)',
      count: 0,
      pct: 0,
      color: '#2563eb',
    },
    {
      key: '81_90',
      label: '81–90',
      rangeLabel: '81–90 (Baik)',
      count: 0,
      pct: 0,
      color: '#0284c7',
    },
    {
      key: '91_100',
      label: '91–100',
      rangeLabel: '91–100 (Sangat Baik)',
      count: 0,
      pct: 0,
      color: '#16a34a',
    },
  ];

  for (const rawScore of studentScores) {
    const rounded = Math.round(rawScore);
    if (rounded <= 60) {
      buckets[0].count += 1;
    } else if (rounded <= 70) {
      buckets[1].count += 1;
    } else if (rounded <= 80) {
      buckets[2].count += 1;
    } else if (rounded <= 90) {
      buckets[3].count += 1;
    } else {
      buckets[4].count += 1;
    }
  }

  const gradedStudents = studentScores.length;
  for (const b of buckets) {
    b.pct = gradedStudents > 0 ? Math.round((b.count / gradedStudents) * 100) : 0;
  }

  let average = 0;
  let median = 0;
  let highest = 0;
  let lowest = 0;
  let stdDev = 0;

  if (gradedStudents > 0) {
    const sorted = [...studentScores].sort((a, b) => a - b);
    const sum = sorted.reduce((acc, v) => acc + v, 0);
    const meanRaw = sum / gradedStudents;
    average = Number(meanRaw.toFixed(1));
    const mid = Math.floor(gradedStudents / 2);
    const medianRaw =
      gradedStudents % 2 === 0
        ? (sorted[mid - 1] + sorted[mid]) / 2
        : sorted[mid];
    median = Number(medianRaw.toFixed(1));
    highest = Number(sorted[sorted.length - 1].toFixed(1));
    lowest = Number(sorted[0].toFixed(1));
    const variance =
      sorted.reduce((acc, v) => acc + Math.pow(v - meanRaw, 2), 0) /
      gradedStudents;
    stdDev = Number(Math.sqrt(variance).toFixed(1));
  }

  const tuntasPct =
    gradedStudents > 0 ? Math.round((tuntasCount / gradedStudents) * 100) : 0;

  return {
    rombelId: isAllRombels ? 'ALL' : rombelId,
    rombelNama: isAllRombels
      ? 'Semua Rombel'
      : targetRombel?.nama || 'Rombel Tidak Ditemukan',
    mapelId: targetSubject?.id || 'ALL',
    mapelNama: targetSubject?.nama || 'Semua Mata Pelajaran (Rata-Rata)',
    kktpThreshold: defaultKktp,
    totalStudents: activeStudents.length,
    gradedStudents,
    average,
    median,
    highest,
    lowest,
    stdDev,
    tuntasCount,
    tuntasPct,
    buckets,
  };
}




