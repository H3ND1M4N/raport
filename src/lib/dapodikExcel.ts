import * as XLSX from 'xlsx';
import {
  computeLegerRombel,
  formatKokurikulerCapaianLabel,
  parseDapodikTabularRows,
  parseImportedSubjectGradesRows,
  type DapodikIncomingPayload,
  type DapodikRombel,
  type DapodikSchool,
  type DapodikStudent,
  type DapodikSubject,
  type EraporDataset,
  type KurikulumType,
  type StudentGradeRecord,
  type TujuanPembelajaran,
} from './eraporCore';

export function parseDapodikSpreadsheetBuffer(
  buffer: ArrayBuffer | Uint8Array,
  schoolContext: { npsn: string; namaSekolah: string; kurikulum?: KurikulumType }
): DapodikIncomingPayload {
  const workbook = XLSX.read(buffer, { type: 'array' });
  if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
    throw new Error('File Excel tidak memiliki sheet data.');
  }

  // Prefer official Dapodik sheet names such as "Daftar Peserta Didik" or "PD"
  const preferredSheetName =
    workbook.SheetNames.find((name) => /peserta|siswa|pd|daftar/i.test(name)) ||
    workbook.SheetNames[0];

  const sheet = workbook.Sheets[preferredSheetName];
  if (!sheet) {
    throw new Error('Sheet data siswa pada file Excel tidak dapat dibaca.');
  }

  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    raw: false,
    defval: '',
  });

  return parseDapodikTabularRows(rows, {
    ...schoolContext,
    sourceLabel: `excel-xlsx://${schoolContext.npsn}`,
  });
}

export function buildSampleDapodikXlsxBytes(): Uint8Array<ArrayBuffer> {
  const sheetData = [
    ['Daftar Peserta Didik — Contoh Format Resmi Dapodik'],
    [''],
    ['No', 'Nama', 'NIPD', 'JK', 'NISN', 'Tempat Lahir', 'Tanggal Lahir', 'Agama', 'Alamat', 'Nama Ayah', 'Nama Ibu', 'Rombel Saat Ini'],
    [1, 'I Putu Gede Pratama', '25001', 'L', '0134567801', 'Gianyar', '2014-05-12', 'Hindu', 'Jl. Raya Ubud', 'I Made Pratama', 'Ni Wayan Sinta', 'Kelas 6A'],
    [2, 'Ni Luh Ayu Permata', '25002', 'P', '0134567802', 'Denpasar', '2014-08-21', 'Hindu', 'Jl. Monkey Forest', 'I Nyoman Putra', 'Ni Wayan Sari', 'Kelas 6A'],
    [3, 'Kadek Bagus Mahendra', '25003', 'L', '0134567803', 'Badung', '2014-03-04', 'Islam', 'Br. Pengosekan', 'Komang Wijaya', 'Siti Aminah', 'Kelas 6B'],
  ];

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(sheetData);
  XLSX.utils.book_append_sheet(wb, ws, 'Daftar Peserta Didik');
  const out = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
  return new Uint8Array(out);
}

export function buildSubjectGradeTemplateXlsxBytes(params: {
  school: DapodikSchool;
  rombel: DapodikRombel;
  subject: DapodikSubject;
  students: DapodikStudent[];
  existingGrades: StudentGradeRecord[];
}): Uint8Array<ArrayBuffer> {
  const rombelStudents = params.students
    .filter((s) => s.rombelId === params.rombel.id && s.statusAktif === 'Aktif')
    .sort((a, b) => a.nama.localeCompare(b.nama, 'id'));

  const gradeByStudent = new Map(
    params.existingGrades
      .filter((g) => g.mapelId === params.subject.id)
      .map((g) => [g.studentId, g])
  );

  const rows: unknown[][] = [
    [`TEMPLATE INPUT NILAI e-RAPOR — ${params.school.namaSekolah} (NPSN ${params.school.npsn})`],
    [`Rombel: ${params.rombel.nama} | Mapel: ${params.subject.nama} (${params.subject.kode}) | KKTP: ${params.subject.kkm} | Semester: ${params.school.semesterLabel}`],
    [],
    ['No', 'NISN', 'NIPD', 'Nama Peserta Didik', 'LM 1', 'LM 2', 'LM 3', 'SAS'],
  ];

  rombelStudents.forEach((st, idx) => {
    const rec = gradeByStudent.get(st.id);
    rows.push([
      idx + 1,
      st.nisn,
      st.nipd,
      st.nama,
      rec?.sumatifLingkup[0] || '',
      rec?.sumatifLingkup[1] || '',
      rec?.sumatifLingkup[2] || '',
      rec?.sumatifAkhirSemester ?? '',
    ]);
  });

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, ws, `Nilai ${params.subject.kode}`.slice(0, 31));
  const out = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
  return new Uint8Array(out);
}

export function parseSubjectGradeSpreadsheetBuffer(
  buffer: ArrayBuffer | Uint8Array,
  context: {
    students: DapodikStudent[];
    subject: DapodikSubject;
    rombelId: string;
    semesterId: string;
    tpList: TujuanPembelajaran[];
    existingGrades: StudentGradeRecord[];
  }
) {
  const workbook = XLSX.read(buffer, { type: 'array' });
  if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
    throw new Error('File Excel nilai tidak memiliki sheet.');
  }
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!sheet) {
    throw new Error('Sheet nilai pada file Excel tidak terbaca.');
  }
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    raw: false,
    defval: '',
  });
  return parseImportedSubjectGradesRows(rows, context);
}

export function buildEraporExportPackageXlsxBytes(
  dataset: EraporDataset,
  rombelId?: string
): { filename: string; bytes: Uint8Array<ArrayBuffer> } {
  const targetRombels = rombelId
    ? dataset.rombels.filter((r) => r.id === rombelId)
    : dataset.rombels;

  const rekapRows: unknown[][] = [
    [
      'NPSN',
      'Semester',
      'Rombel',
      'NISN',
      'NIPD',
      'Nama Peserta Didik',
      'Kode Mapel',
      'Mata Pelajaran',
      'KKTP',
      'Nilai Akhir',
      'Predikat',
      'Deskripsi Capaian Kompetensi',
    ],
  ];

  const legerRows: unknown[][] = [
    [
      'Rombel',
      'NISN',
      'NIPD',
      'Nama Peserta Didik',
      ...dataset.subjects.map((s) => `${s.kode} (${s.kkm})`),
      'Total',
      'Rata-rata',
      'Sakit',
      'Izin',
      'Alpa',
      'Keputusan',
    ],
  ];

  const kokurikulerRows: unknown[][] = [
    [
      'Rombel',
      'NISN',
      'Nama Peserta Didik',
      'Bentuk Kokurikuler',
      'Tema Kegiatan',
      'Dimensi Profil Lulusan',
      'Tahap Capaian',
      'Prinsip Pembelajaran Mendalam',
      'Narasi Positif & Membangun',
    ],
  ];

  for (const rb of targetRombels) {
    const leger = computeLegerRombel(dataset, rb.id);
    for (const row of leger.rows) {
      legerRows.push([
        rb.nama,
        row.student.nisn,
        row.student.nipd,
        row.student.nama,
        ...dataset.subjects.map((sub) => row.scoresBySubject[sub.id]?.nilai ?? ''),
        row.totalNilai,
        row.rataRata,
        row.sakit,
        row.izin,
        row.tanpaKeterangan,
        row.keputusan,
      ]);

      for (const sub of dataset.subjects) {
        const grade = dataset.grades.find(
          (g) => g.studentId === row.student.id && g.mapelId === sub.id
        );
        if (grade && grade.nilaiAkhir > 0) {
          rekapRows.push([
            dataset.school.npsn,
            dataset.school.semesterId,
            rb.nama,
            row.student.nisn,
            row.student.nipd,
            row.student.nama,
            sub.kode,
            sub.nama,
            sub.kkm,
            grade.nilaiAkhir,
            grade.predikat,
            grade.deskripsiCapaian,
          ]);
        }
      }

      const wali = dataset.waliRecords.find((w) => w.studentId === row.student.id);
      if (wali && wali.kokurikulerP5.length > 0) {
        for (const p5 of wali.kokurikulerP5) {
          kokurikulerRows.push([
            rb.nama,
            row.student.nisn,
            row.student.nama,
            p5.bentukKegiatan || 'Lintas Disiplin Ilmu',
            p5.tema,
            p5.dimensiList && p5.dimensiList.length > 0
              ? p5.dimensiList.join(', ')
              : p5.dimensi,
            formatKokurikulerCapaianLabel(p5.capaian),
            p5.prinsipDeepLearning && p5.prinsipDeepLearning.length > 0
              ? p5.prinsipDeepLearning.join(', ')
              : 'Berkesadaran, Bermakna, Menggembirakan',
            p5.catatan,
          ]);
        }
      }
    }
  }

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rekapRows), 'Rekap Nilai e-Rapor');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(legerRows), 'Leger Rombel');
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet(kokurikulerRows),
    'Kokurikuler & 8 Dimensi'
  );
  const out = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;

  const label =
    targetRombels.length === 1
      ? targetRombels[0].nama.replace(/[^a-zA-Z0-9]+/g, '-')
      : 'Semua-Rombel';

  return {
    filename: `Paket-Nilai-eRapor-Dapodik-${dataset.school.npsn}-${label}.xlsx`,
    bytes: new Uint8Array(out),
  };
}

