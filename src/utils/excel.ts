import * as XLSX from 'xlsx';
import {
  ExamConfig,
  MultiSubjectStore,
  PackageCode,
  ParsedExcelStudentRow,
  StudentSheet,
} from '../types/grading';
import {
  SUBJECT_LIST,
  computeAllSubjectsLeger,
  computeClassSummary,
  computeItemAnalysis,
  computeStudentRanks,
  getAvailableOptions,
  gradeStudentSheet,
} from './scoring';

/**
 * Generates and downloads an official .xlsx Excel template with sample rows
 * and an instructions worksheet so teachers can prepare student rosters easily.
 */
export function downloadStudentTemplateXlsx(config: ExamConfig) {
  const sampleRows = [
    {
      NIS: '2425201',
      'Nama Siswa': 'Ananda Putri Maharani',
      Kelas: config.className || 'V-A',
      'Kode Paket': 'A',
    },
    {
      NIS: '2425202',
      'Nama Siswa': 'Bima Sakti Wijaya',
      Kelas: config.className || 'V-A',
      'Kode Paket': config.enableMultiPackage ? 'B' : 'A',
    },
    {
      NIS: '2425203',
      'Nama Siswa': 'Cahya Ramadhan',
      Kelas: config.className || 'V-A',
      'Kode Paket': config.enableMultiPackage ? 'C' : 'A',
    },
    {
      NIS: '2425204',
      'Nama Siswa': 'Dinda Aulia Safitri',
      Kelas: config.className || 'V-A',
      'Kode Paket': 'A',
    },
  ];

  const wsStudents = XLSX.utils.json_to_sheet(sampleRows);
  wsStudents['!cols'] = [
    { wch: 16 },
    { wch: 30 },
    { wch: 16 },
    { wch: 14 },
  ];

  const guideRows = [
    ['PETUNJUK PENGISIAN TEMPLATE DATA SISWA — KOREKSILEMBAR'],
    [''],
    ['Kolom', 'Wajib / Opsional', 'Keterangan'],
    ['NIS', 'Opsional (Disarankan)', 'Nomor Induk Siswa atau Nomor Peserta Ujian. Digunakan untuk mendeteksi data duplikat.'],
    ['Nama Siswa', 'Wajib', 'Nama lengkap siswa sesuai daftar hadir ujian. Baris tanpa nama akan ditandai tidak valid.'],
    ['Kelas', 'Opsional', `Nama kelas/rombel siswa. Jika dikosongkan otomatis mengikuti kelas aktif (${config.className}).`],
    ['Kode Paket', 'Opsional', 'Isi A, B, atau C jika ujian menggunakan fitur Multi-Paket Soal. Default otomatis: A.'],
    [''],
    ['Catatan: Daftar siswa yang diimpor otomatis tersedia di seluruh 5 mata pelajaran (Matematika, IPAS, Pendidikan Pancasila, Bahasa Indonesia, dan SBDP).'],
  ];

  const wsGuide = XLSX.utils.aoa_to_sheet(guideRows);
  wsGuide['!cols'] = [{ wch: 22 }, { wch: 22 }, { wch: 76 }];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, wsStudents, 'Data_Siswa');
  XLSX.utils.book_append_sheet(workbook, wsGuide, 'Petunjuk_Pengisian');

  const safeClass = (config.className || 'kelas')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_');
  XLSX.writeFile(workbook, `template_data_siswa_${safeClass}.xlsx`);
}

function normalizeHeaderKey(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

function pickColumnValue(
  row: Record<string, unknown>,
  candidates: string[]
): string {
  const entries = Object.entries(row);
  for (const [key, val] of entries) {
    const norm = normalizeHeaderKey(key);
    if (candidates.includes(norm)) {
      return String(val ?? '').trim();
    }
  }
  return '';
}

function parsePackageCode(raw: string): PackageCode {
  const upper = raw.toUpperCase().replace(/[^ABC]/g, '');
  if (upper === 'B' || upper === 'C') return upper;
  return 'A';
}

export async function parseStudentExcelFile(
  file: File,
  existingSheets: StudentSheet[],
  defaultClassName: string
): Promise<ParsedExcelStudentRow[]> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array' });

  const targetSheetName =
    workbook.SheetNames.find(
      (n) => normalizeHeaderKey(n) === 'datasiswa'
    ) ?? workbook.SheetNames[0];

  if (!targetSheetName) {
    return [];
  }

  const sheet = workbook.Sheets[targetSheetName];
  const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: '',
  });

  const existingNisSet = new Set(
    existingSheets
      .map((s) => s.nis.trim().toLowerCase())
      .filter((n) => n && n !== '-')
  );
  const seenInFile = new Set<string>();

  const parsed: ParsedExcelStudentRow[] = [];

  rawRows.forEach((rawRow, idx) => {
    const nis = pickColumnValue(rawRow, [
      'nis',
      'nisn',
      'nopeserta',
      'nomorpeserta',
      'nomorinduk',
      'noinduk',
      'id',
    ]);
    const name = pickColumnValue(rawRow, [
      'namasiswa',
      'nama',
      'namalengkap',
      'namapeserta',
      'peserta',
      'siswa',
    ]);
    const className =
      pickColumnValue(rawRow, ['kelas', 'rombel', 'kelasrombel', 'kelompok']) ||
      defaultClassName;
    const rawPkg = pickColumnValue(rawRow, [
      'kodepaket',
      'paket',
      'paketsoal',
      'tipe',
    ]);
    const packageCode = parsePackageCode(rawPkg);

    if (!nis && !name && !rawPkg) {
      return;
    }

    const normNis = nis.toLowerCase();
    let status: 'valid' | 'duplicate' | 'invalid' = 'valid';
    let reason: string | undefined;

    if (!name) {
      status = 'invalid';
      reason = 'Nama siswa kosong';
    } else if (normNis && (existingNisSet.has(normNis) || seenInFile.has(normNis))) {
      status = 'duplicate';
      reason = existingNisSet.has(normNis)
        ? 'NIS sudah ada di daftar kelas'
        : 'NIS ganda di dalam file';
    }

    if (normNis) {
      seenInFile.add(normNis);
    }

    parsed.push({
      rowIndex: idx + 2,
      nis: nis || `TMP-${String(idx + 1).padStart(3, '0')}`,
      name,
      className,
      packageCode,
      status,
      reason,
    });
  });

  return parsed;
}

function buildSubjectLedgerRows(sheets: StudentSheet[], config: ExamConfig) {
  const ranks = computeStudentRanks(sheets, config);
  return sheets.map((sheet, idx) => {
    const res = gradeStudentSheet(sheet, config);
    const isGraded = sheet.gradedAt !== null;
    const row: Record<string, string | number> = {
      No: idx + 1,
      Peringkat: isGraded && ranks[sheet.id] ? ranks[sheet.id] : '-',
      NIS: sheet.nis,
      'Nama Siswa': sheet.name,
      Kelas: sheet.className || config.className,
    };

    if (config.enableMultiPackage) {
      row['Paket'] = sheet.packageCode || 'A';
    }

    row['Status Koreksi'] = isGraded ? 'Terkoreksi' : 'Menunggu';
    row['PG Benar'] = isGraded ? res.correctCount : '-';
    row['PG Salah'] = isGraded ? res.wrongCount : '-';
    row['PG Kosong'] = isGraded ? res.blankCount : '-';
    row['Skor PG (%)'] = isGraded ? res.mcPercent : '-';

    if (config.includeEssay) {
      row['Skor Uraian'] = isGraded ? `${res.essayTotal}/${res.essayMax}` : '-';
      row['Uraian (%)'] = isGraded ? res.essayPercent : '-';
    }

    row['Nilai Asli'] = isGraded ? res.rawFinalScore : '-';
    row['Nilai Akhir'] = isGraded ? res.finalScore : '-';
    row['Predikat'] = isGraded ? `${res.predicate} (${res.predicateLabel})` : '-';
    row['Ketuntasan'] = isGraded ? (res.passed ? 'Tuntas' : 'Remedial') : 'Menunggu';
    row['Catatan Guru'] = sheet.notes || '';

    return row;
  });
}

/**
 * Exports a single-subject comprehensive multi-sheet Excel report (.xlsx).
 */
export function exportFullReportXlsx(sheets: StudentSheet[], config: ExamConfig) {
  const summary = computeClassSummary(sheets, config);
  const analysis = computeItemAnalysis(sheets, config, 'ALL');
  const options = getAvailableOptions(config.optionCount);

  const ledgerData = buildSubjectLedgerRows(sheets, config);
  const wsLedger = XLSX.utils.json_to_sheet(ledgerData);
  wsLedger['!cols'] = [
    { wch: 5 },
    { wch: 10 },
    { wch: 14 },
    { wch: 28 },
    { wch: 12 },
    ...(config.enableMultiPackage ? [{ wch: 8 }] : []),
    { wch: 14 },
    { wch: 10 },
    { wch: 10 },
    { wch: 10 },
    { wch: 12 },
    ...(config.includeEssay ? [{ wch: 13 }, { wch: 12 }] : []),
    { wch: 11 },
    { wch: 12 },
    { wch: 20 },
    { wch: 12 },
    { wch: 32 },
  ];

  const analysisData = analysis.map((item) => {
    const row: Record<string, string | number> = {
      'No Soal': item.questionNumber,
      'Kunci (Paket A)': item.keyAnswer,
      Status:
        item.questionStatus === 'bonus'
          ? 'Bonus'
          : item.questionStatus === 'annulled'
          ? 'Anulir'
          : 'Normal',
      Bobot: `${item.questionWeight}x`,
      'Benar (%)': item.accuracyPercent,
      'Tingkat Kesukaran': item.difficulty,
      'Daya Beda (D)': item.discriminationIndex,
      'Kualitas Butir': item.discriminationLabel,
    };
    options.forEach((opt) => {
      row[`Pilih ${opt}`] = item.distribution[opt] ?? 0;
    });
    row['Kosong'] = item.blankCount;
    return row;
  });

  const wsAnalysis = XLSX.utils.json_to_sheet(analysisData);
  wsAnalysis['!cols'] = [
    { wch: 10 },
    { wch: 15 },
    { wch: 10 },
    { wch: 8 },
    { wch: 11 },
    { wch: 18 },
    { wch: 14 },
    { wch: 15 },
    ...options.map(() => ({ wch: 9 })),
    { wch: 9 },
  ];

  const summaryRows = [
    ['LAPORAN RINGKASAN EVALUASI'],
    ['Judul Ujian', config.title],
    ['Mata Pelajaran', config.subject],
    ['Kelas', config.className],
    ['Tanggal', config.examDate],
    ['KKM', config.kkm],
    ['Jumlah Soal PG', `${config.mcCount} soal (${config.optionCount} opsi)`],
    ['Skema PG', config.scoringMode === 'standard' ? 'Standar (+1 / 0)' : 'Minus (+4 / -1 / 0)'],
    ['Katrol Nilai', `+${config.curveAdjustment} poin`],
    [''],
    ['STATISTIK KELAS', 'NILAI'],
    ['Jumlah Siswa Terkoreksi', `${summary.gradedCount} dari ${summary.totalCount}`],
    ['Rata-rata (Mean)', summary.average],
    ['Nilai Tengah (Median)', summary.median],
    ['Standar Deviasi (SD)', summary.stdDev],
    ['Nilai Tertinggi', summary.highest],
    ['Nilai Terendah', summary.lowest],
    ['Jumlah Tuntas', summary.passedCount],
    ['Jumlah Remedial', summary.remedialCount],
    ['Persentase Ketuntasan', `${summary.passRate}%`],
  ];

  const wsSummary = XLSX.utils.aoa_to_sheet(summaryRows);
  wsSummary['!cols'] = [{ wch: 26 }, { wch: 36 }];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, wsLedger, 'Rekap_Nilai');
  XLSX.utils.book_append_sheet(workbook, wsAnalysis, 'Analisis_Butir');
  XLSX.utils.book_append_sheet(workbook, wsSummary, 'Ringkasan_Kelas');

  const safeName = `${config.subject}_${config.className}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_');
  XLSX.writeFile(workbook, `laporan_koreksi_${safeName}.xlsx`);
}

/**
 * Exports a complete 6-sheet Leger Kelas Excel workbook covering all 5 subjects:
 * Sheet 1: Leger_Semua_Mapel
 * Sheets 2-6: Matematika, IPAS, Pend_Pancasila, B_Indonesia, SBDP
 */
export function exportLegerAllSubjectsXlsx(store: MultiSubjectStore) {
  const { rows } = computeAllSubjectsLeger(store);
  const sorted = [...rows].sort(
    (a, b) => (b.averageScore ?? -1) - (a.averageScore ?? -1)
  );

  const legerSheetData = sorted.map((row, idx) => {
    const record: Record<string, string | number> = {
      No: idx + 1,
      Peringkat: row.rank ?? '-',
      NIS: row.nis,
      'Nama Siswa': row.name,
      Kelas: row.className,
    };

    SUBJECT_LIST.forEach((subj) => {
      const cell = row.subjects[subj.id];
      record[subj.name] =
        cell.isGraded && cell.score !== null ? cell.score : '-';
    });

    record['Jumlah Nilai'] = row.gradedSubjectCount > 0 ? row.totalScore : '-';
    record['Rata-rata'] = row.averageScore !== null ? row.averageScore : '-';
    record['Mapel Tuntas'] = `${row.passedSubjectCount}/${SUBJECT_LIST.length}`;
    record['Status'] =
      row.overallStatus === 'tuntas-semua'
        ? 'Tuntas Semua Mapel'
        : row.overallStatus === 'remedial'
        ? `${row.remedialSubjectCount} Mapel Remedial`
        : 'Belum Lengkap';

    return record;
  });

  const workbook = XLSX.utils.book_new();
  const wsLeger = XLSX.utils.json_to_sheet(legerSheetData);
  wsLeger['!cols'] = [
    { wch: 5 },
    { wch: 10 },
    { wch: 14 },
    { wch: 28 },
    { wch: 10 },
    { wch: 13 },
    { wch: 11 },
    { wch: 21 },
    { wch: 18 },
    { wch: 11 },
    { wch: 13 },
    { wch: 11 },
    { wch: 13 },
    { wch: 20 },
  ];
  XLSX.utils.book_append_sheet(workbook, wsLeger, 'Leger_Semua_Mapel');

  // Append each subject's detailed sheet
  SUBJECT_LIST.forEach((subj) => {
    const st = store[subj.id];
    const subjRows = buildSubjectLedgerRows(st.sheets, st.config);
    const wsSubj = XLSX.utils.json_to_sheet(subjRows);
    wsSubj['!cols'] = [
      { wch: 5 },
      { wch: 10 },
      { wch: 14 },
      { wch: 26 },
      { wch: 10 },
      { wch: 14 },
      { wch: 10 },
      { wch: 10 },
      { wch: 10 },
      { wch: 12 },
      { wch: 13 },
      { wch: 12 },
      { wch: 11 },
      { wch: 12 },
      { wch: 20 },
      { wch: 12 },
      { wch: 28 },
    ];
    XLSX.utils.book_append_sheet(workbook, wsSubj, subj.sheetName);
  });

  const safeClass = (store.matematika.config.className || 'kelas')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_');
  XLSX.writeFile(workbook, `leger_semua_mapel_${safeClass}.xlsx`);
}
