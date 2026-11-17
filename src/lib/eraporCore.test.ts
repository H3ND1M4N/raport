import test from 'node:test';
import assert from 'node:assert/strict';
import {
  assertDapodikReadOnlyMethod,
  calculateNilaiAkhir,
  computeLegerRombel,
  computePredikat,
  computePrincipalMetrics,
  createCleanSchoolDataset,
  generateAutoDeskripsi,
  getDefaultSubjectsForJenjang,
  hasDapodikSyncChanges,
  isLocalOrPrivateUrl,
  normalizeDapodikWebServiceUrl,
  parseDapodikCsvToPayload,
  parseDapodikImportText,
  parseDapodikTabularRows,
  parseDapodikWebServiceResponses,
  reconcileDapodikSync,
  safeParseJsonResponse,
  summarizeSchoolProfile,
  validateSchoolProfileInput,
} from './eraporCore';
import {
  buildSampleDapodikXlsxBytes,
  parseDapodikSpreadsheetBuffer,
} from './dapodikExcel';
import { createInitialDataset } from './seedData';

test('assertDapodikReadOnlyMethod permits GET and blocks mutating methods', () => {
  assert.doesNotThrow(() => {
    assertDapodikReadOnlyMethod('GET', 'http://localhost:5774/WebService/getPesertaDidik');
  });
  assert.throws(() => {
    assertDapodikReadOnlyMethod('POST', 'http://localhost:5774/WebService/getPesertaDidik');
  }, /READ_ONLY_VIOLATION/);
  assert.throws(() => {
    assertDapodikReadOnlyMethod('PUT', 'http://localhost:5774/WebService/getSekolah');
  }, /READ_ONLY_VIOLATION/);
  assert.throws(() => {
    assertDapodikReadOnlyMethod('DELETE', 'http://localhost:5774/WebService/getRombonganBelajar');
  }, /READ_ONLY_VIOLATION/);
});

test('calculateNilaiAkhir computes Kurikulum Merdeka 60/40 weighting accurately', () => {
  assert.equal(calculateNilaiAkhir([80, 90], 85), 85); // 85*0.6 + 85*0.4 = 85
  assert.equal(calculateNilaiAkhir([90, 90, 90], 70), 82); // 90*0.6 + 70*0.4 = 54 + 28 = 82
  assert.equal(calculateNilaiAkhir([78, 82], null), 80);
  assert.equal(calculateNilaiAkhir([], 88), 88);
  assert.equal(calculateNilaiAkhir([], null), 0);
});

test('computePredikat maps numeric scores against KKTP threshold', () => {
  assert.equal(computePredikat(95, 75).predikat, 'A');
  assert.equal(computePredikat(86, 75).predikat, 'B');
  assert.equal(computePredikat(76, 75).predikat, 'C');
  assert.equal(computePredikat(68, 75).predikat, 'D');
  assert.equal(computePredikat(68, 75).label, 'Perlu Bimbingan');
});

test('generateAutoDeskripsi produces natural Indonesian competence narrative', () => {
  const dataset = createInitialDataset();
  const tpMath = dataset.tujuanPembelajaran.filter((t) => t.mapelId === 'mapel-mtk');
  const desc = generateAutoDeskripsi({
    studentName: 'Ni Putu Ayu Lestari',
    subjectName: 'Matematika',
    nilaiAkhir: 89,
    kkm: 75,
    tpList: tpMath,
    tpTercapaiIds: [tpMath[0].id],
    tpPerluBimbinganIds: [tpMath[1].id],
  });

  assert.match(desc, /Ananda Ni/);
  assert.match(desc, /Matematika/);
  assert.match(desc, /Perlu bimbingan dan penguatan lebih lanjut/);
});

test('reconcileDapodikSync preserves existing grades when student moves rombel or changes name in Dapodik', () => {
  const dataset = createInitialDataset();
  const firstStudent = dataset.students[0];
  const updatedStudents = dataset.students.map((s) =>
    s.id === firstStudent.id
      ? { ...s, nama: `${s.nama} (Sync Dapodik)`, rombelId: 'rombel-6b' }
      : s
  );

  const { nextDataset, diff } = reconcileDapodikSync(dataset, {
    students: updatedStudents,
  });

  assert.equal(diff.readOnlyVerified, true);
  assert.equal(diff.updatedStudents, 1);
  assert.equal(diff.movedRombelStudents, 1);

  const preservedGrades = nextDataset.grades.filter((g) => g.studentId === firstStudent.id);
  assert.ok(preservedGrades.length > 0);
  for (const g of preservedGrades) {
    assert.equal(g.rombelId, 'rombel-6b');
  }
});

test('computeLegerRombel and computePrincipalMetrics aggregate accurately', () => {
  const dataset = createInitialDataset();
  const leger = computeLegerRombel(dataset, 'rombel-6a');
  assert.ok(leger.rows.length > 0);
  assert.ok(leger.subjects.length > 0);
  assert.ok(leger.completionRate > 0 && leger.completionRate <= 100);

  const metrics = computePrincipalMetrics(dataset);
  assert.equal(metrics.totalRombels, dataset.rombels.length);
  assert.ok(metrics.totalStudents > 0);
  assert.ok(metrics.schoolAverageScore > 0);
});

test('validateSchoolProfileInput validates 8-digit NPSN, school name, and http/https WebService URL', () => {
  const badNpsn = validateSchoolProfileInput({
    npsn: '1234',
    namaSekolah: 'SMP Negeri 2 Denpasar',
    sourceHost: 'http://localhost:5774/WebService',
  });
  assert.equal(badNpsn.valid, false);
  assert.match(badNpsn.error || '', /8 digit/);

  const badUrl = validateSchoolProfileInput({
    npsn: '50103122',
    namaSekolah: 'SMP Negeri 2 Denpasar',
    sourceHost: 'ftp://192.168.1.5:5774',
  });
  assert.equal(badUrl.valid, false);

  const valid = validateSchoolProfileInput({
    npsn: ' 50103122 ',
    namaSekolah: ' SMP Negeri 2 Denpasar ',
    sourceHost: 'http://192.168.1.10:5774/WebService///',
  });
  assert.equal(valid.valid, true);
  assert.equal(valid.normalized.npsn, '50103122');
  assert.equal(valid.normalized.sourceHost, 'http://192.168.1.10:5774/WebService');
});

test('getDefaultSubjectsForJenjang and createCleanSchoolDataset isolate each school cleanly', () => {
  const smpDefaults = getDefaultSubjectsForJenjang('SMP');
  assert.ok(smpDefaults.subjects.some((s) => s.nama.includes('IPA')));
  assert.ok(smpDefaults.subjects.every((s) => s.tingkatList.includes(7)));

  const smkDefaults = getDefaultSubjectsForJenjang('SMK');
  assert.ok(smkDefaults.subjects.some((s) => s.nama.includes('Konsentrasi Keahlian')));

  const cleanSmp = createCleanSchoolDataset({
    npsn: '50103122',
    namaSekolah: 'SMP Negeri 2 Denpasar',
    jenjang: 'SMP',
    sourceHost: 'http://192.168.1.25:5774/WebService',
    kabupaten: 'Kota Denpasar',
    provinsi: 'Bali',
  });

  assert.equal(cleanSmp.school.npsn, '50103122');
  assert.equal(cleanSmp.school.jenjang, 'SMP');
  assert.equal(cleanSmp.students.length, 0);
  assert.equal(cleanSmp.grades.length, 0);
  assert.equal(cleanSmp.waliRecords.length, 0);
  assert.equal(cleanSmp.rombels.length, 1);
  assert.equal(cleanSmp.rombels[0].tingkat, 7);

  const summary = summarizeSchoolProfile(cleanSmp);
  assert.equal(summary.npsn, '50103122');
  assert.equal(summary.studentCount, 0);
  assert.equal(summary.rombelCount, 1);
});

test('parseDapodikWebServiceResponses handles real Kemdikdasmen Dapodik JSON shapes', () => {
  const parsed = parseDapodikWebServiceResponses({
    sourceHost: 'http://localhost:5774/WebService/',
    npsn: '50103122',
    sekolahRaw: {
      rows: {
        nama: 'SMP Negeri 2 Denpasar',
        npsn: '50103122',
        alamat_jalan: 'Jl. Gunung Agung No. 112',
        kabupaten_kota: 'Kota Denpasar',
        provinsi: 'Bali',
      },
    },
    gtkRaw: {
      rows: [{ ptk_id: 'ptk-77', nama: 'Ni Made Dwi Lestari, S.Pd.', nip: '198801012014022001' }],
    },
    rombelRaw: {
      rows: [
        {
          rombongan_belajar_id: 'rb-7a',
          nama: 'VII A',
          tingkat_pendidikan_id_str: 'Kelas 7',
          ptk_id: 'ptk-77',
          kurikulum_id_str: 'Kurikulum Merdeka',
        },
      ],
    },
    pesertaDidikRaw: {
      rows: [
        {
          peserta_didik_id: 'pd-1001',
          nisn: '0129988776',
          nipd: '24001',
          nama: 'I Kadek Arya Putra',
          jenis_kelamin: 'L',
          tempat_lahir: 'Denpasar',
          tanggal_lahir: '2012-05-11',
          agama_id_str: 'Hindu',
          nama_rombel: 'VII A',
          nama_ibu_kandung: 'Ni Ketut Sari',
          alamat_jalan: 'Jl. Gatot Subroto',
        },
      ],
    },
  });

  assert.equal(parsed.detectedSchoolName, 'SMP Negeri 2 Denpasar');
  assert.equal(parsed.rombelCount, 1);
  assert.equal(parsed.studentCount, 1);
  assert.equal(parsed.payload.rombels?.[0].tingkat, 7);
  assert.equal(parsed.payload.rombels?.[0].fase, 'Fase D');
  assert.equal(parsed.payload.rombels?.[0].waliKelasNama, 'Ni Made Dwi Lestari, S.Pd.');
  assert.equal(parsed.payload.students?.[0].rombelId, 'rb-7a');
  assert.equal(parsed.payload.students?.[0].namaOrangTua, 'Ni Ketut Sari');
});

test('isLocalOrPrivateUrl and hasDapodikSyncChanges detect local hosts and deltas', () => {
  assert.equal(isLocalOrPrivateUrl('http://localhost:5774/WebService'), true);
  assert.equal(isLocalOrPrivateUrl('http://192.168.1.10:5774/WebService'), true);
  assert.equal(isLocalOrPrivateUrl('https://dapodik-sekolah.trycloudflare.com/WebService'), false);

  const ds = createInitialDataset();
  const noChange = reconcileDapodikSync(ds, { students: ds.students, rombels: ds.rombels });
  assert.equal(hasDapodikSyncChanges(noChange.diff), false);

  const withAdded = reconcileDapodikSync(ds, {
    students: [
      ...ds.students,
      { ...ds.students[0], id: 'std-extra', pesertaDidikId: 'PD-EXTRA', nama: 'Siswa Baru' },
    ],
  });
  assert.equal(hasDapodikSyncChanges(withAdded.diff), true);
});

test('normalizeDapodikWebServiceUrl cleans user-entered host URLs automatically', () => {
  assert.equal(
    normalizeDapodikWebServiceUrl('localhost:5774'),
    'http://localhost:5774/WebService'
  );
  assert.equal(
    normalizeDapodikWebServiceUrl('http://192.168.1.25:5774/'),
    'http://192.168.1.25:5774/WebService'
  );
  assert.equal(
    normalizeDapodikWebServiceUrl('http://localhost:5774/WebService/getPesertaDidik'),
    'http://localhost:5774/WebService'
  );
  assert.equal(
    normalizeDapodikWebServiceUrl('https://dapodik.sman1.sch.id'),
    'https://dapodik.sman1.sch.id/WebService'
  );
});

test('parseDapodikCsvToPayload imports semicolon/comma CSV from Excel Dapodik exports', () => {
  const csv = [
    'NISN;NIPD;Nama Peserta Didik;L/P;Rombel;Nama Orang Tua',
    '0139988001;25001;I Wayan Agus Saputra;L;Kelas 6A;I Made Saputra',
    '0139988002;25002;Ni Putu Sintya Dewi;P;Kelas 6B;Ni Ketut Rani',
  ].join('\n');

  const payload = parseDapodikCsvToPayload(csv, {
    npsn: '50102031',
    namaSekolah: 'SD Negeri 1 Ubud',
    kurikulum: 'Kurikulum Merdeka',
  });

  assert.equal(payload.rombels?.length, 2);
  assert.equal(payload.students?.length, 2);
  assert.equal(payload.students?.[0].nama, 'I Wayan Agus Saputra');
  assert.equal(payload.students?.[1].jenisKelamin, 'P');
  assert.equal(payload.rombels?.[1].nama, 'Kelas 6B');
});

test('safeParseJsonResponse and parseDapodikImportText guard against <!doctype html> responses', async () => {
  const htmlRes = new Response('<!doctype html><html><body>Login</body></html>', {
    status: 200,
    headers: { 'Content-Type': 'text/html' },
  });

  await assert.rejects(
    () => safeParseJsonResponse(htmlRes, 'dapodik'),
    /halaman web \(HTML/
  );

  assert.throws(
    () =>
      parseDapodikImportText('<!doctype html><html><body>Error</body></html>', {
        npsn: '50102031',
        namaSekolah: 'SD Negeri 1 Ubud',
      }),
    /halaman web \(HTML\)/
  );

  const rawRowsPayload = parseDapodikImportText(
    JSON.stringify({
      rows: [
        {
          peserta_didik_id: 'pd-1',
          nisn: '0135550001',
          nipd: '25001',
          nama: 'I Komang Export Raw',
          jenis_kelamin: 'L',
        },
      ],
    }),
    { npsn: '50102031', namaSekolah: 'SD Negeri 1 Ubud' }
  );
  assert.equal(rawRowsPayload.students?.length, 1);
  assert.equal(rawRowsPayload.students?.[0].nama, 'I Komang Export Raw');
});

test('parseDapodikSpreadsheetBuffer parses real .xlsx workbooks with Dapodik title rows', () => {
  const bytes = buildSampleDapodikXlsxBytes();
  const parsed = parseDapodikSpreadsheetBuffer(bytes, {
    npsn: '50102031',
    namaSekolah: 'SD Negeri 1 Ubud',
    kurikulum: 'Kurikulum Merdeka',
  });

  assert.equal(parsed.students?.length, 3);
  assert.equal(parsed.rombels?.length, 2);
  assert.equal(parsed.students?.[0].nama, 'I Putu Gede Pratama');
  assert.equal(parsed.students?.[0].nisn, '0134567801');
  assert.equal(parsed.students?.[1].jenisKelamin, 'P');

  // Verify numeric subheader row ("1", "2", "3"...) is skipped and Nama Ayah is not confused with Nama Siswa
  const tricky = parseDapodikTabularRows(
    [
      ['DAFTAR PESERTA DIDIK SD NEGERI 1 UBUD'],
      ['Kecamatan Ubud, Kabupaten Gianyar'],
      [],
      ['No', 'Nama', 'NIPD', 'JK', 'NISN', 'Nama Ayah', 'Rombel Saat Ini'],
      ['1', '2', '3', '4', '5', '6', '7'],
      ['1', 'Ni Wayan Lestari', '25010', 'P', '0134567890', 'I Ketut Suta', 'Kelas 5A'],
    ],
    { npsn: '50102031', namaSekolah: 'SD Negeri 1 Ubud' }
  );
  assert.equal(tricky.students?.length, 1);
  assert.equal(tricky.students?.[0].nama, 'Ni Wayan Lestari');
  assert.equal(tricky.students?.[0].namaOrangTua, 'I Ketut Suta');
  assert.equal(tricky.rombels?.[0].nama, 'Kelas 5A');
});

import {
  applyOperatorSubmissionAction,
  buildDapodikNilaiCsvExport,
  createGuruSubmission,
  validateLoginInput,
} from './eraporCore';

test('validateLoginInput validates username, password length, and optional 8-digit NPSN', () => {
  assert.equal(validateLoginInput({ username: '', password: 'guru123' }).valid, false);
  assert.equal(validateLoginInput({ username: 'guru', password: '12' }).valid, false);
  assert.equal(
    validateLoginInput({ username: 'guru', password: 'guru123', npsn: '123' }).valid,
    false
  );
  const ok = validateLoginInput({
    username: ' operator ',
    password: 'operator123',
    npsn: '50102031',
  });
  assert.equal(ok.valid, true);
  assert.equal(ok.normalized.username, 'operator');
});

test('createGuruSubmission and applyOperatorSubmissionAction handle Guru -> Operator -> Sync Dapodik or Print Rapor workflow', () => {
  const dataset = createInitialDataset();
  const { nextDataset: afterGuru, submission } = createGuruSubmission(dataset, {
    rombelId: 'rombel-6a',
    submittedBy: 'Anak Agung Gde Mahendra, S.Pd.',
    submittedByNip: '198111052008011009',
    notes: 'Semua nilai Matematika & P5 VI-A telah diperiksa.',
  });

  assert.equal(submission.status, 'menunggu_operator');
  assert.equal(submission.rombelNama, 'Kelas VI-A');
  assert.ok(submission.gradesCount > 0);
  assert.equal(afterGuru.submissions?.length, 1);
  assert.equal(afterGuru.auditLogs[0].action, 'GURU_KIRIM_DATA_KE_OPERATOR');

  // Pilihan 1: Operator sinkronkan ke Dapodik
  const { nextDataset: afterSync, updatedSubmission: syncedSub } =
    applyOperatorSubmissionAction(afterGuru, {
      submissionId: submission.id,
      action: 'sync_dapodik',
      operatorName: 'Operator Dapodik Sekolah',
    });

  assert.equal(syncedSub.status, 'tersinkron_dapodik');
  assert.equal(syncedSub.dapodikSyncVerified, true);
  assert.equal(afterSync.auditLogs[0].action, 'OPERATOR_SINKRON_KE_DAPODIK');
  assert.equal(afterSync.auditLogs[0].readOnlyGuardPassed, true);

  // Pilihan 2: Operator langsung print rapor
  const { nextDataset: afterPrint, updatedSubmission: printedSub } =
    applyOperatorSubmissionAction(afterGuru, {
      submissionId: submission.id,
      action: 'print_rapor',
      operatorName: 'Operator Dapodik Sekolah',
    });

  assert.equal(printedSub.status, 'dicetak_rapor');
  assert.equal(afterPrint.auditLogs[0].action, 'OPERATOR_LANGSUNG_CETAK_RAPOR');

  // Paket CSV nilai Dapodik
  const pkg = buildDapodikNilaiCsvExport(afterSync, 'rombel-6a');
  assert.ok(pkg.rowCount > 0);
  assert.match(pkg.filename, /Paket-Kirim-Nilai-Dapodik-50102031/);
  assert.match(pkg.csvContent, /NPSN;Semester;Rombel;NISN/);
});

import {
  inferJenjangFromSchoolName,
  normalizeNpsnInput,
  parseKemdikbudNpsnHtml,
  validateNpsnFormat,
} from './eraporCore';

test('normalizeNpsnInput, validateNpsnFormat, and parseKemdikbudNpsnHtml resolve NPSN cleanly', () => {
  assert.equal(normalizeNpsnInput(' 5010-2031abc '), '50102031');
  assert.equal(normalizeNpsnInput('1234567890'), '12345678');

  assert.equal(validateNpsnFormat('5010').valid, false);
  assert.match(validateNpsnFormat('5010').error || '', /4\/8 digit/);
  assert.equal(validateNpsnFormat('50103122').valid, true);

  assert.equal(inferJenjangFromSchoolName('SMK Negeri 1 Denpasar'), 'SMK');
  assert.equal(inferJenjangFromSchoolName('SMA Negeri 1 Ubud'), 'SMA');
  assert.equal(inferJenjangFromSchoolName('SMP Negeri 2 Denpasar'), 'SMP');
  assert.equal(inferJenjangFromSchoolName('SD Negeri 1 Ubud'), 'SD');

  const sampleHtml = `
    <html><body>
      <table>
        <tr><td>Nama</td><td>:</td><td>SMA Negeri 1 Denpasar</td></tr>
        <tr><td>Bentuk Pendidikan</td><td>:</td><td>SMA</td></tr>
        <tr><td>Alamat</td><td>:</td><td>Jl. Kamboja No. 4</td></tr>
        <tr><td>Kecamatan</td><td>:</td><td>Kec. Denpasar Utara</td></tr>
        <tr><td>Kab.-Kota/Negara (LN)</td><td>:</td><td>Kota Denpasar</td></tr>
        <tr><td>Propinsi/Luar Negeri (LN)</td><td>:</td><td>Prov. Bali</td></tr>
      </table>
    </body></html>
  `;
  const parsed = parseKemdikbudNpsnHtml(sampleHtml, '50103125');
  assert.ok(parsed);
  assert.equal(parsed?.namaSekolah, 'SMA Negeri 1 Denpasar');
  assert.equal(parsed?.jenjang, 'SMA');
  assert.equal(parsed?.kabupaten, 'Kota Denpasar');
  assert.equal(parsed?.provinsi, 'Prov. Bali');
});

import {
  buildWindowsBridgeBatScript,
  buildWindowsPowerShellBridgeScript,
} from './dapodikClient';

test('buildWindowsBridgeBatScript generates cmd-safe CRLF launcher without oversized base64 lines', () => {
  const params = {
    appOrigin: 'https://erapor.example.sch.id',
    npsn: '20536900',
    namaSekolah: 'SMP "Harapan" $Nusantara',
    dapodikHost: 'http://localhost:5774/WebService',
    dapodikToken: 'tok-abc-123',
    bridgeKey: 'brk-xyz-789',
    intervalSec: 20,
  };

  const bat = buildWindowsBridgeBatScript(params);
  const ps1 = buildWindowsPowerShellBridgeScript(params);

  assert.ok(bat.includes('\r\n'), 'Batch file must use Windows CRLF line endings');
  assert.ok(!bat.includes('FromBase64String'), 'Must not rely on oversized base64 cmd line');
  assert.ok(!bat.includes('Invoke-Expression'), 'Must not invoke expression from base64 string');

  const marker = '#__ERAPOR_PS_START__';
  const markerPos = bat.indexOf(marker);
  assert.ok(markerPos > 0, 'Must include polyglot PS start marker');

  const batLauncherLines = bat.slice(0, markerPos).split('\r\n');
  for (const line of batLauncherLines) {
    assert.ok(
      line.length < 500,
      `CMD launcher line must remain under 500 chars (got ${line.length}): ${line}`
    );
  }

  assert.ok(bat.includes('$env:BAT_SELF'), 'Batch script must pass self path via BAT_SELF');
  assert.ok(bat.includes('$env:PS_FILE'), 'Batch script must write extracted PS1 via PS_FILE');
  assert.ok(bat.includes('pause >nul'), 'Batch script must pause CMD so error output stays visible');
  assert.ok(ps1.includes("$Npsn = '20536900'"), 'PowerShell script must bind exact NPSN');
  assert.ok(ps1.includes('$RelayPort = 5775'), 'PowerShell script must listen on port 5775');
  assert.ok(
    ps1.includes('$SchoolName = \'SMP "Harapan" $Nusantara\''),
    'School name must be single-quote safe in PowerShell'
  );
});

import { updateSubjectsKktp, validateKktpValue } from './eraporCore';

test('validateKktpValue enforces integer bounds 50..95', () => {
  assert.equal(validateKktpValue('').valid, false);
  assert.equal(validateKktpValue(49).valid, false);
  assert.equal(validateKktpValue(96).valid, false);
  assert.equal(validateKktpValue(75.5).valid, false);
  assert.equal(validateKktpValue('50').valid, true);
  assert.equal(validateKktpValue(82).kktp, 82);
  assert.equal(validateKktpValue(95).valid, true);
});

test('updateSubjectsKktp updates subject KKTP, recalculates grade predikat & auto-narrative, and preserves custom descriptions', () => {
  const ds = createInitialDataset();
  const targetSub = ds.subjects.find((s) => s.id === 'mapel-mtk')!;
  assert.ok(targetSub);

  // Ensure deterministic grades: one auto-described grade at 80 (tuntas at 75 -> below at 85)
  // and one custom-described grade whose custom text must not be overwritten.
  const studentA = ds.students[0];
  const studentB = ds.students[1];
  const seedGrades = [
    ...ds.grades.filter((g) => !(g.mapelId === 'mapel-mtk' && (g.studentId === studentA.id || g.studentId === studentB.id))),
    {
      id: `grd-${studentA.id}-mapel-mtk`,
      studentId: studentA.id,
      mapelId: 'mapel-mtk',
      rombelId: studentA.rombelId,
      semesterId: ds.school.semesterId,
      sumatifLingkup: [80, 80, 80],
      sumatifAkhirSemester: 80,
      tpTercapaiIds: [],
      tpPerluBimbinganIds: [],
      nilaiAkhir: 80,
      predikat: 'C' as const,
      deskripsiCapaian: 'Awal',
      customDeskripsi: false,
      updatedAt: new Date().toISOString(),
      updatedBy: 'Guru Test',
      syncStatus: 'synced' as const,
    },
    {
      id: `grd-${studentB.id}-mapel-mtk`,
      studentId: studentB.id,
      mapelId: 'mapel-mtk',
      rombelId: studentB.rombelId,
      semesterId: ds.school.semesterId,
      sumatifLingkup: [80, 80, 80],
      sumatifAkhirSemester: 80,
      tpTercapaiIds: [],
      tpPerluBimbinganIds: [],
      nilaiAkhir: 80,
      predikat: 'C' as const,
      deskripsiCapaian: 'Catatan Khusus Wali/Guru',
      customDeskripsi: true,
      updatedAt: new Date().toISOString(),
      updatedBy: 'Guru Test',
      syncStatus: 'synced' as const,
    },
  ];

  const modifiedDs = { ...ds, grades: seedGrades };
  const result = updateSubjectsKktp(modifiedDs, {
    updates: [
      { mapelId: 'mapel-mtk', kktp: 85 },
      { mapelId: 'mapel-bind', kktp: 80 },
    ],
    actor: 'Guru Matematika',
  });

  const updatedMtk = result.nextDataset.subjects.find((s) => s.id === 'mapel-mtk')!;
  const updatedBind = result.nextDataset.subjects.find((s) => s.id === 'mapel-bind')!;
  assert.equal(updatedMtk.kkm, 85);
  assert.equal(updatedBind.kkm, 80);
  assert.ok(result.recalculatedGradesCount >= 2);

  const gradeA = result.nextDataset.grades.find((g) => g.id === `grd-${studentA.id}-mapel-mtk`)!;
  const gradeB = result.nextDataset.grades.find((g) => g.id === `grd-${studentB.id}-mapel-mtk`)!;
  assert.equal(gradeA.predikat, 'D');
  assert.match(gradeA.deskripsiCapaian, /Disarankan latihan terstruktur/);
  assert.equal(gradeB.predikat, 'D');
  assert.equal(gradeB.deskripsiCapaian, 'Catatan Khusus Wali/Guru');
  assert.equal(result.nextDataset.auditLogs[0].action, 'UBAH_KKTP_MAPEL');
});

import * as XLSX from 'xlsx';
import {
  deleteTujuanPembelajaran,
  upsertSubjectMapping,
  upsertTujuanPembelajaran,
} from './eraporCore';
import {
  buildEraporExportPackageXlsxBytes,
  buildSubjectGradeTemplateXlsxBytes,
  parseSubjectGradeSpreadsheetBuffer,
} from './dapodikExcel';

test('upsertSubjectMapping, upsertTujuanPembelajaran, and deleteTujuanPembelajaran manage curriculum cleanly', () => {
  const ds = createInitialDataset();
  const initialSubjectCount = ds.subjects.length;

  const addedSub = upsertSubjectMapping(ds, {
    kode: 'BALI',
    nama: 'Bahasa Bali (Mulok)',
    kelompok: 'Muatan Lokal',
    kkm: 76,
    guruPengampu: 'Ni Wayan Sari, S.Pd.',
    nipGuru: '198902022015022001',
    actor: 'Operator Test',
  });
  assert.equal(addedSub.created, true);
  assert.equal(addedSub.nextDataset.subjects.length, initialSubjectCount + 1);
  assert.equal(addedSub.subject.kelompok, 'Muatan Lokal');

  const addedTp = upsertTujuanPembelajaran(addedSub.nextDataset, {
    mapelId: addedSub.subject.id,
    tingkat: 6,
    kode: 'TP-BALI-01',
    deskripsi: 'Membaca dan menulis aksara Bali dasar dengan tepat',
    actor: 'Ni Wayan Sari, S.Pd.',
  });
  assert.equal(addedTp.created, true);
  assert.ok(
    addedTp.nextDataset.tujuanPembelajaran.some(
      (t) => t.id === addedTp.tp.id && t.kode === 'TP-BALI-01'
    )
  );

  // Attach TP to a grade and ensure deleteTujuanPembelajaran cleans reference
  const withGradeRef = {
    ...addedTp.nextDataset,
    grades: addedTp.nextDataset.grades.map((g, i) =>
      i === 0 ? { ...g, tpTercapaiIds: [...g.tpTercapaiIds, addedTp.tp.id] } : g
    ),
  };
  const afterDelete = deleteTujuanPembelajaran(withGradeRef, addedTp.tp.id, 'Operator Test');
  assert.equal(
    afterDelete.tujuanPembelajaran.some((t) => t.id === addedTp.tp.id),
    false
  );
  assert.equal(afterDelete.grades[0].tpTercapaiIds.includes(addedTp.tp.id), false);
});

test('buildSubjectGradeTemplateXlsxBytes round-trips through parseSubjectGradeSpreadsheetBuffer and buildEraporExportPackageXlsxBytes generates multi-sheet workbook', () => {
  const ds = createInitialDataset();
  const rombel = ds.rombels[2] || ds.rombels[0];
  const subject = ds.subjects[3] || ds.subjects[0];
  const tpList = ds.tujuanPembelajaran.filter((t) => t.mapelId === subject.id);

  const templateBytes = buildSubjectGradeTemplateXlsxBytes({
    school: ds.school,
    rombel,
    subject,
    students: ds.students,
    existingGrades: ds.grades,
  });

  // Modify scores inside template workbook and import back
  const wb = XLSX.read(templateBytes, { type: 'array' });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const aoa = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, raw: false, defval: '' });
  // Row index 4 is first student (after 2 title lines, 1 blank, 1 header)
  aoa[4][4] = '94'; // LM 1
  aoa[4][5] = '96'; // LM 2
  aoa[4][6] = '95'; // LM 3
  aoa[4][7] = '95'; // SAS
  wb.Sheets[wb.SheetNames[0]] = XLSX.utils.aoa_to_sheet(aoa);
  const modifiedBytes = new Uint8Array(XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer);

  const imported = parseSubjectGradeSpreadsheetBuffer(modifiedBytes, {
    students: ds.students,
    subject,
    rombelId: rombel.id,
    semesterId: ds.school.semesterId,
    tpList,
    existingGrades: ds.grades,
  });

  assert.ok(imported.matchedCount >= 1);
  // 94,96,95 avg = 95; 95*0.6 + 95*0.4 = 95 -> Predikat A
  assert.equal(imported.records[0].nilaiAkhir, 95);
  assert.equal(imported.records[0].predikat, 'A');

  const pkg = buildEraporExportPackageXlsxBytes(ds, rombel.id);
  assert.match(pkg.filename, /Paket-Nilai-eRapor-Dapodik-50102031/);
  const exportWb = XLSX.read(pkg.bytes, { type: 'array' });
  assert.deepEqual(exportWb.SheetNames, [
    'Rekap Nilai e-Rapor',
    'Leger Rombel',
    'Kokurikuler & 8 Dimensi',
  ]);
});

import {
  DELAPAN_DIMENSI_PROFIL_LULUSAN,
  activateKkaElective,
  computeDeepLearningReadiness,
  formatKokurikulerCapaianLabel,
  generateKokurikulerNarasi,
} from './eraporCore';

test('Kurikulum Pembelajaran Mendalam 2026: 8 Dimensi, Kokurikuler narrative, KKA elective, and TP taxonomy', () => {
  assert.equal(DELAPAN_DIMENSI_PROFIL_LULUSAN.length, 8);
  assert.ok(DELAPAN_DIMENSI_PROFIL_LULUSAN.includes('Kewargaan'));
  assert.ok(DELAPAN_DIMENSI_PROFIL_LULUSAN.includes('Komunikasi'));

  assert.equal(formatKokurikulerCapaianLabel('Mahir'), 'Mahir (Sangat Baik)');
  assert.equal(formatKokurikulerCapaianLabel('SB'), 'Mahir (Sangat Baik)');
  assert.equal(formatKokurikulerCapaianLabel('Cakap'), 'Cakap (Sesuai Harapan)');
  assert.equal(formatKokurikulerCapaianLabel('BSH'), 'Cakap (Sesuai Harapan)');
  assert.equal(formatKokurikulerCapaianLabel('Berkembang'), 'Berkembang');
  assert.equal(formatKokurikulerCapaianLabel('BB'), 'Berkembang (Awal)');

  const narasiMahir = generateKokurikulerNarasi({
    studentName: 'I Putu Gede Pratama',
    tema: 'Gaya Hidup Berkelanjutan & Eco-Enzyme',
    bentukKegiatan: 'Lintas Disiplin Ilmu',
    dimensiList: ['Penalaran Kritis', 'Kolaborasi'],
    capaian: 'Mahir',
    prinsipDeepLearning: ['Berkesadaran', 'Bermakna', 'Menggembirakan'],
  });
  assert.match(narasiMahir, /Ananda I/);
  assert.match(narasiMahir, /Mahir/);
  assert.match(narasiMahir, /Penalaran Kritis, Kolaborasi/);

  const ds = createInitialDataset();
  const initialReadiness = computeDeepLearningReadiness(ds);
  assert.equal(initialReadiness.kkaActive, false);
  assert.equal(initialReadiness.deepTpCount, initialReadiness.totalTp);
  assert.equal(initialReadiness.tpCoveragePct, 100);
  assert.ok(initialReadiness.byLevel.Memahami > 0);
  assert.ok(initialReadiness.byLevel.Mengaplikasi > 0);
  assert.ok(initialReadiness.byLevel.Merefleksi > 0);

  // 1-click KKA elective activation + idempotency check
  const firstKka = activateKkaElective(ds, 'Operator Sekolah');
  assert.equal(firstKka.alreadyActive, false);
  assert.equal(firstKka.addedTpCount, 3);
  assert.equal(firstKka.nextDataset.auditLogs[0].action, 'AKTIFKAN_MAPEL_PILIHAN_KKA_2026');
  const kkaReadiness = computeDeepLearningReadiness(firstKka.nextDataset);
  assert.equal(kkaReadiness.kkaActive, true);

  const secondKka = activateKkaElective(firstKka.nextDataset, 'Operator Sekolah');
  assert.equal(secondKka.alreadyActive, true);
  assert.equal(secondKka.addedTpCount, 0);

  // TP persistence & Deep Learning narrative weaving
  const tpRes = upsertTujuanPembelajaran(firstKka.nextDataset, {
    mapelId: 'mapel-kka',
    tingkat: 6,
    kode: 'TP.KKA.6.4',
    deskripsi: 'Merancang prototipe klasifikasi sampah berbasis kecerdasan artifisial sederhana',
    levelMendalam: 'Mengaplikasi',
    dimensiProfil: ['Kreativitas', 'Penalaran Kritis'],
    actor: 'Guru KKA',
  });
  assert.equal(tpRes.tp.levelMendalam, 'Mengaplikasi');
  assert.deepEqual(tpRes.tp.dimensiProfil, ['Kreativitas', 'Penalaran Kritis']);

  const autoDesc = generateAutoDeskripsi({
    studentName: 'Ni Luh Sari',
    subjectName: 'Koding dan Kecerdasan Artifisial',
    nilaiAkhir: 91,
    kkm: 75,
    tpList: [tpRes.tp],
    tpTercapaiIds: [tpRes.tp.id],
    tpPerluBimbinganIds: [],
  });
  assert.match(autoDesc, /tahap Mengaplikasi/);
});

import { computeRombelGradeDistribution } from './eraporCore';

test('computeRombelGradeDistribution computes accurate histogram buckets and descriptive stats per rombel and subject', () => {
  const ds = createInitialDataset();
  const rombelDist = computeRombelGradeDistribution(ds, 'rombel-6a', 'ALL');

  assert.equal(rombelDist.rombelId, 'rombel-6a');
  assert.equal(rombelDist.totalStudents, 6);
  assert.equal(rombelDist.gradedStudents, 6);
  assert.equal(rombelDist.buckets.length, 5);
  assert.equal(
    rombelDist.buckets.reduce((acc, b) => acc + b.count, 0),
    rombelDist.gradedStudents
  );
  assert.ok(rombelDist.average > 70 && rombelDist.average <= 100);
  assert.ok(rombelDist.median > 0);
  assert.ok(rombelDist.highest >= rombelDist.lowest);
  assert.ok(rombelDist.stdDev >= 0);

  // Specific subject filter (Matematika)
  const mtkDist = computeRombelGradeDistribution(ds, 'rombel-6a', 'mapel-mtk');
  assert.equal(mtkDist.mapelId, 'mapel-mtk');
  assert.equal(mtkDist.kktpThreshold, 75);
  assert.equal(mtkDist.gradedStudents, 6);
  assert.equal(
    mtkDist.buckets.reduce((acc, b) => acc + b.count, 0),
    6
  );

  // Empty rombel / subject without grades (KKA after activation) returns zeroed metrics gracefully
  const emptyDist = computeRombelGradeDistribution(ds, 'rombel-4a', 'mapel-kka');
  assert.equal(emptyDist.gradedStudents, 0);
  assert.equal(emptyDist.average, 0);
  assert.equal(emptyDist.tuntasPct, 0);
});






