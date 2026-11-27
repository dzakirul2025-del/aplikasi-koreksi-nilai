import {
  ExamConfig,
  GradePredicate,
  ItemAnalysisRow,
  LegerStudentRow,
  LegerSubjectCell,
  MultiSubjectStore,
  OptionLetter,
  PackageCode,
  QuestionRule,
  RoundingMode,
  StudentGradeResult,
  StudentSheet,
  SubjectId,
  SubjectMeta,
} from '../types/grading';

export const ALL_OPTIONS: OptionLetter[] = ['A', 'B', 'C', 'D', 'E'];
export const PACKAGE_CODES: PackageCode[] = ['A', 'B', 'C'];

export const SUBJECT_LIST: SubjectMeta[] = [
  {
    id: 'matematika',
    name: 'Matematika',
    shortName: 'Matematika',
    sheetName: 'Matematika',
  },
  {
    id: 'ipas',
    name: 'IPAS',
    shortName: 'IPAS',
    sheetName: 'IPAS',
  },
  {
    id: 'pancasila',
    name: 'Pendidikan Pancasila',
    shortName: 'P. Pancasila',
    sheetName: 'Pend_Pancasila',
  },
  {
    id: 'bindo',
    name: 'Bahasa Indonesia',
    shortName: 'B. Indonesia',
    sheetName: 'B_Indonesia',
  },
  {
    id: 'sbdp',
    name: 'SBDP',
    shortName: 'SBDP',
    sheetName: 'SBDP',
  },
];

export const DEFAULT_QUESTION_RULE: QuestionRule = {
  weight: 1,
  status: 'normal',
};

export function getSubjectMeta(id: SubjectId): SubjectMeta {
  return SUBJECT_LIST.find((s) => s.id === id) ?? SUBJECT_LIST[0];
}

export function getAvailableOptions(optionCount: 4 | 5): OptionLetter[] {
  return optionCount === 4 ? ['A', 'B', 'C', 'D'] : ['A', 'B', 'C', 'D', 'E'];
}

export function getQuestionRule(
  config: ExamConfig,
  questionNumber: number
): QuestionRule {
  return config.questionRules?.[questionNumber] ?? DEFAULT_QUESTION_RULE;
}

export function getPackageKeyMap(
  config: ExamConfig,
  packageCode: PackageCode
): Record<number, OptionLetter> {
  if (!config.enableMultiPackage) {
    return config.packageKeys?.A ?? config.answerKey;
  }
  return config.packageKeys?.[packageCode] ?? config.answerKey;
}

export function applyRounding(value: number, mode: RoundingMode): number {
  const clamped = Math.max(0, Math.min(100, value));
  if (mode === 'round') return Math.round(clamped);
  if (mode === 'ceil') return Math.ceil(clamped);
  return Math.round(clamped * 10) / 10;
}

export function getGradePredicate(
  score: number,
  kkm: number
): { predicate: GradePredicate; label: string } {
  const interval = Math.max(1, (100 - kkm) / 3);
  if (score >= 100 - interval) {
    return { predicate: 'A', label: 'Sangat Baik' };
  }
  if (score >= 100 - interval * 2) {
    return { predicate: 'B', label: 'Baik' };
  }
  if (score >= kkm) {
    return { predicate: 'C', label: 'Cukup' };
  }
  return { predicate: 'D', label: 'Perlu Bimbingan' };
}

export function gradeStudentSheet(
  sheet: Pick<StudentSheet, 'answers' | 'essayScores' | 'packageCode'>,
  config: ExamConfig
): StudentGradeResult {
  const activeKeyMap = getPackageKeyMap(config, sheet.packageCode || 'A');

  let correctCount = 0;
  let wrongCount = 0;
  let blankCount = 0;
  let bonusCount = 0;
  let annulledCount = 0;

  let mcRawScore = 0;
  let mcMaxRaw = 0;

  for (let i = 1; i <= config.mcCount; i++) {
    const rule = getQuestionRule(config, i);
    const weight = rule.weight;

    if (rule.status === 'annulled') {
      annulledCount++;
      continue;
    }

    const chosen = sheet.answers[i] ?? null;
    const key = activeKeyMap[i];

    if (config.scoringMode === 'standard') {
      mcMaxRaw += weight;
      if (rule.status === 'bonus') {
        bonusCount++;
        correctCount++;
        mcRawScore += weight;
      } else if (!chosen) {
        blankCount++;
      } else if (key && chosen === key) {
        correctCount++;
        mcRawScore += weight;
      } else {
        wrongCount++;
      }
    } else {
      mcMaxRaw += 4 * weight;
      if (rule.status === 'bonus') {
        bonusCount++;
        correctCount++;
        mcRawScore += 4 * weight;
      } else if (!chosen) {
        blankCount++;
      } else if (key && chosen === key) {
        correctCount++;
        mcRawScore += 4 * weight;
      } else {
        wrongCount++;
        mcRawScore -= 1 * weight;
      }
    }
  }

  mcRawScore = Math.max(0, mcRawScore);
  const mcPercent = mcMaxRaw > 0 ? (mcRawScore / mcMaxRaw) * 100 : 0;

  const essayMax = config.includeEssay
    ? config.essays.reduce((sum, q) => sum + q.maxScore, 0)
    : 0;
  const essayTotal = config.includeEssay
    ? config.essays.reduce((sum, q) => {
        const val = sheet.essayScores[q.id] ?? 0;
        return sum + Math.min(q.maxScore, Math.max(0, val));
      }, 0)
    : 0;
  const essayPercent = essayMax > 0 ? (essayTotal / essayMax) * 100 : 0;

  let rawFinal = mcPercent;
  if (config.includeEssay && essayMax > 0) {
    const mcW = config.mcWeight / 100;
    const essayW = (100 - config.mcWeight) / 100;
    rawFinal = mcPercent * mcW + essayPercent * essayW;
  }

  const adjustedFinal = Math.min(100, rawFinal + (config.curveAdjustment || 0));
  const finalScore = applyRounding(adjustedFinal, config.roundingMode || 'decimal1');
  const rawFinalScore = Math.round(rawFinal * 10) / 10;
  const { predicate, label: predicateLabel } = getGradePredicate(finalScore, config.kkm);

  return {
    correctCount,
    wrongCount,
    blankCount,
    bonusCount,
    annulledCount,
    mcRawScore,
    mcMaxRaw,
    mcPercent: Math.round(mcPercent * 10) / 10,
    essayTotal,
    essayMax,
    essayPercent: Math.round(essayPercent * 10) / 10,
    rawFinalScore,
    finalScore,
    passed: finalScore >= config.kkm,
    predicate,
    predicateLabel,
  };
}

export function computeStudentRanks(
  sheets: StudentSheet[],
  config: ExamConfig
): Record<string, number> {
  const graded = sheets
    .filter((s) => s.gradedAt !== null)
    .map((s) => ({
      id: s.id,
      score: gradeStudentSheet(s, config).finalScore,
    }))
    .sort((a, b) => b.score - a.score);

  const ranks: Record<string, number> = {};
  let currentRank = 1;
  for (let i = 0; i < graded.length; i++) {
    if (i > 0 && graded[i].score < graded[i - 1].score) {
      currentRank = i + 1;
    }
    ranks[graded[i].id] = currentRank;
  }
  return ranks;
}

export function computeItemAnalysis(
  sheets: StudentSheet[],
  config: ExamConfig,
  filterPackage: PackageCode | 'ALL' = 'ALL'
): ItemAnalysisRow[] {
  const gradedSheets = sheets.filter((s) => {
    if (s.gradedAt === null) return false;
    if (config.enableMultiPackage && filterPackage !== 'ALL') {
      return (s.packageCode || 'A') === filterPackage;
    }
    return true;
  });

  const totalGraded = gradedSheets.length;
  const sortedByScore = [...gradedSheets].sort(
    (a, b) =>
      gradeStudentSheet(b, config).finalScore -
      gradeStudentSheet(a, config).finalScore
  );

  const groupSize =
    totalGraded >= 4
      ? Math.max(1, Math.round(totalGraded * 0.27))
      : Math.floor(totalGraded / 2);
  const upperGroup = sortedByScore.slice(0, groupSize);
  const lowerGroup = groupSize > 0 ? sortedByScore.slice(totalGraded - groupSize) : [];

  const rows: ItemAnalysisRow[] = [];
  const displayKeyMap = getPackageKeyMap(
    config,
    filterPackage === 'ALL' ? 'A' : filterPackage
  );

  for (let q = 1; q <= config.mcCount; q++) {
    const rule = getQuestionRule(config, q);
    const displayKey = displayKeyMap[q] ?? 'A';
    const distribution: Record<OptionLetter, number> = {
      A: 0,
      B: 0,
      C: 0,
      D: 0,
      E: 0,
    };

    let correctCount = 0;
    let wrongCount = 0;
    let blankCount = 0;

    for (const sheet of gradedSheets) {
      const sheetKey = getPackageKeyMap(config, sheet.packageCode || 'A')[q] ?? 'A';
      const ans = sheet.answers[q];
      if (!ans) {
        blankCount++;
        if (rule.status === 'bonus') correctCount++;
      } else {
        distribution[ans] = (distribution[ans] ?? 0) + 1;
        if (rule.status === 'bonus' || ans === sheetKey) {
          correctCount++;
        } else {
          wrongCount++;
        }
      }
    }

    const accuracyPercent =
      totalGraded > 0 ? Math.round((correctCount / totalGraded) * 100) : 0;

    let difficulty: 'Mudah' | 'Sedang' | 'Sulit' = 'Sedang';
    if (accuracyPercent >= 75) {
      difficulty = 'Mudah';
    } else if (accuracyPercent < 45) {
      difficulty = 'Sulit';
    }

    let discriminationIndex = 0;
    if (groupSize > 0 && rule.status === 'normal') {
      const upperCorrect = upperGroup.filter((s) => {
        const k = getPackageKeyMap(config, s.packageCode || 'A')[q];
        return s.answers[q] && s.answers[q] === k;
      }).length;
      const lowerCorrect = lowerGroup.filter((s) => {
        const k = getPackageKeyMap(config, s.packageCode || 'A')[q];
        return s.answers[q] && s.answers[q] === k;
      }).length;
      discriminationIndex =
        Math.round(((upperCorrect - lowerCorrect) / groupSize) * 100) / 100;
    }

    let discriminationLabel: 'Sangat Baik' | 'Baik' | 'Cukup' | 'Revisi' = 'Cukup';
    if (discriminationIndex >= 0.4) {
      discriminationLabel = 'Sangat Baik';
    } else if (discriminationIndex >= 0.3) {
      discriminationLabel = 'Baik';
    } else if (discriminationIndex >= 0.2) {
      discriminationLabel = 'Cukup';
    } else {
      discriminationLabel = 'Revisi';
    }

    rows.push({
      questionNumber: q,
      keyAnswer: displayKey,
      questionStatus: rule.status,
      questionWeight: rule.weight,
      correctCount,
      wrongCount,
      blankCount,
      totalGraded,
      accuracyPercent,
      difficulty,
      discriminationIndex,
      discriminationLabel,
      distribution,
    });
  }

  return rows;
}

export function computeClassSummary(
  sheets: StudentSheet[],
  config: ExamConfig
) {
  const graded = sheets.filter((s) => s.gradedAt !== null);
  if (graded.length === 0) {
    return {
      gradedCount: 0,
      totalCount: sheets.length,
      average: 0,
      median: 0,
      stdDev: 0,
      highest: 0,
      lowest: 0,
      passedCount: 0,
      remedialCount: 0,
      passRate: 0,
    };
  }

  const results = graded.map((s) => gradeStudentSheet(s, config));
  const values = results.map((r) => r.finalScore).sort((a, b) => a - b);
  const sum = values.reduce((acc, v) => acc + v, 0);
  const mean = sum / values.length;

  const mid = Math.floor(values.length / 2);
  const median =
    values.length % 2 === 0
      ? (values[mid - 1] + values[mid]) / 2
      : values[mid];

  const variance =
    values.reduce((acc, v) => acc + Math.pow(v - mean, 2), 0) / values.length;
  const stdDev = Math.sqrt(variance);

  const highest = values[values.length - 1];
  const lowest = values[0];
  const passedCount = results.filter((s) => s.passed).length;

  return {
    gradedCount: graded.length,
    totalCount: sheets.length,
    average: Math.round(mean * 10) / 10,
    median: Math.round(median * 10) / 10,
    stdDev: Math.round(stdDev * 10) / 10,
    highest,
    lowest,
    passedCount,
    remedialCount: graded.length - passedCount,
    passRate: Math.round((passedCount / graded.length) * 100),
  };
}

/**
 * Computes the combined Leger across all 5 subjects for every student in the class.
 */
export function computeAllSubjectsLeger(store: MultiSubjectStore): {
  rows: LegerStudentRow[];
  subjectSummaries: Record<
    SubjectId,
    ReturnType<typeof computeClassSummary> & { kkm: number }
  >;
  overallAverage: number;
  allPassedStudents: number;
  fullyGradedStudents: number;
  totalGradedSheets: number;
  totalExpectedSheets: number;
} {
  // Collect unified student list preserving order from Matematika (and any extras from other subjects)
  const studentMap = new Map<
    string,
    { id: string; nis: string; name: string; className: string }
  >();

  SUBJECT_LIST.forEach((subj) => {
    const state = store[subj.id];
    state.sheets.forEach((s) => {
      if (!studentMap.has(s.id)) {
        studentMap.set(s.id, {
          id: s.id,
          nis: s.nis,
          name: s.name,
          className: s.className || state.config.className,
        });
      }
    });
  });

  const subjectSummaries = {} as Record<
    SubjectId,
    ReturnType<typeof computeClassSummary> & { kkm: number }
  >;

  let totalGradedSheets = 0;
  let totalExpectedSheets = 0;

  SUBJECT_LIST.forEach((subj) => {
    const st = store[subj.id];
    const summary = computeClassSummary(st.sheets, st.config);
    subjectSummaries[subj.id] = { ...summary, kkm: st.config.kkm };
    totalGradedSheets += summary.gradedCount;
    totalExpectedSheets += summary.totalCount;
  });

  const rows: LegerStudentRow[] = Array.from(studentMap.values()).map((stu) => {
    const subjects = {} as Record<SubjectId, LegerSubjectCell>;
    let gradedSubjectCount = 0;
    let passedSubjectCount = 0;
    let remedialSubjectCount = 0;
    let totalScore = 0;

    SUBJECT_LIST.forEach((subj) => {
      const st = store[subj.id];
      const sheet = st.sheets.find((s) => s.id === stu.id);
      if (sheet && sheet.gradedAt !== null) {
        const res = gradeStudentSheet(sheet, st.config);
        gradedSubjectCount++;
        totalScore += res.finalScore;
        if (res.passed) passedSubjectCount++;
        else remedialSubjectCount++;

        subjects[subj.id] = {
          subjectId: subj.id,
          isGraded: true,
          score: res.finalScore,
          passed: res.passed,
          predicate: res.predicate,
          kkm: st.config.kkm,
        };
      } else {
        subjects[subj.id] = {
          subjectId: subj.id,
          isGraded: false,
          score: null,
          passed: false,
          predicate: null,
          kkm: st.config.kkm,
        };
      }
    });

    const averageScore =
      gradedSubjectCount > 0
        ? Math.round((totalScore / gradedSubjectCount) * 10) / 10
        : null;

    let overallStatus: LegerStudentRow['overallStatus'] = 'belum-lengkap';
    if (gradedSubjectCount === SUBJECT_LIST.length) {
      overallStatus = remedialSubjectCount === 0 ? 'tuntas-semua' : 'remedial';
    } else if (remedialSubjectCount > 0) {
      overallStatus = 'remedial';
    }

    return {
      studentId: stu.id,
      nis: stu.nis,
      name: stu.name,
      className: stu.className,
      subjects,
      gradedSubjectCount,
      passedSubjectCount,
      remedialSubjectCount,
      totalScore: Math.round(totalScore * 10) / 10,
      averageScore,
      rank: null,
      overallStatus,
    };
  });

  // Compute overall class ranking based on averageScore (with ties)
  const rankedPool = rows
    .filter((r) => r.averageScore !== null)
    .sort((a, b) => (b.averageScore ?? 0) - (a.averageScore ?? 0));

  let currentRank = 1;
  rankedPool.forEach((row, idx) => {
    if (idx > 0 && (row.averageScore ?? 0) < (rankedPool[idx - 1].averageScore ?? 0)) {
      currentRank = idx + 1;
    }
    row.rank = currentRank;
  });

  const avgValues = rows
    .map((r) => r.averageScore)
    .filter((v): v is number => v !== null);
  const overallAverage =
    avgValues.length > 0
      ? Math.round(
          (avgValues.reduce((acc, v) => acc + v, 0) / avgValues.length) * 10
        ) / 10
      : 0;

  const fullyGradedStudents = rows.filter(
    (r) => r.gradedSubjectCount === SUBJECT_LIST.length
  ).length;
  const allPassedStudents = rows.filter(
    (r) => r.overallStatus === 'tuntas-semua'
  ).length;

  return {
    rows,
    subjectSummaries,
    overallAverage,
    allPassedStudents,
    fullyGradedStudents,
    totalGradedSheets,
    totalExpectedSheets,
  };
}

export function buildAnswersFromString(
  raw: string,
  maxQuestions: number,
  optionCount: 4 | 5
): Record<number, OptionLetter | null> {
  const validSet = new Set(getAvailableOptions(optionCount));
  const cleaned = raw.toUpperCase().replace(/[^A-E0\-_.]/g, '');
  const result: Record<number, OptionLetter | null> = {};
  for (let i = 1; i <= maxQuestions; i++) {
    const ch = cleaned[i - 1];
    if (ch && validSet.has(ch as OptionLetter)) {
      result[i] = ch as OptionLetter;
    } else {
      result[i] = null;
    }
  }
  return result;
}

export function answersToString(
  answers: Record<number, OptionLetter | null>,
  mcCount: number
): string {
  let out = '';
  for (let i = 1; i <= mcCount; i++) {
    out += answers[i] ?? '-';
  }
  return out;
}

export function generateSampleAnswers(
  config: ExamConfig,
  packageCode: PackageCode = 'A',
  accuracyTarget = 0.78
): {
  answers: Record<number, OptionLetter | null>;
  essayScores: Record<string, number>;
} {
  const options = getAvailableOptions(config.optionCount);
  const keyMap = getPackageKeyMap(config, packageCode);
  const answers: Record<number, OptionLetter | null> = {};

  for (let i = 1; i <= config.mcCount; i++) {
    const key = keyMap[i] ?? 'A';
    const roll = Math.random();
    if (roll < accuracyTarget) {
      answers[i] = key;
    } else if (roll < accuracyTarget + 0.05) {
      answers[i] = null;
    } else {
      const distractors = options.filter((o) => o !== key);
      answers[i] = distractors[Math.floor(Math.random() * distractors.length)];
    }
  }

  const essayScores: Record<string, number> = {};
  for (const eq of config.essays) {
    const ratio = Math.min(
      1,
      Math.max(0.35, accuracyTarget + (Math.random() * 0.24 - 0.12))
    );
    essayScores[eq.id] = Math.round(eq.maxScore * ratio);
  }

  return { answers, essayScores };
}

export function exportGradesToCsv(sheets: StudentSheet[], config: ExamConfig) {
  const ranks = computeStudentRanks(sheets, config);

  const headers = [
    'No',
    'Peringkat',
    'NIS',
    'Nama Siswa',
    'Kelas',
    ...(config.enableMultiPackage ? ['Kode Paket'] : []),
    'Status Koreksi',
    'PG Benar',
    'PG Salah',
    'PG Kosong',
    'Skor PG (%)',
    ...(config.includeEssay
      ? ['Total Uraian', 'Maks Uraian', 'Skor Uraian (%)']
      : []),
    'Nilai Asli',
    'Nilai Akhir',
    'Predikat',
    'Keterangan',
    'Catatan Guru',
  ];

  const rows = sheets.map((sheet, idx) => {
    const res = gradeStudentSheet(sheet, config);
    const isGraded = sheet.gradedAt !== null;
    const base = [
      String(idx + 1),
      isGraded && ranks[sheet.id] ? String(ranks[sheet.id]) : '-',
      sheet.nis,
      `"${sheet.name.replace(/"/g, '""')}"`,
      `"${(sheet.className || config.className).replace(/"/g, '""')}"`,
    ];

    if (config.enableMultiPackage) {
      base.push(sheet.packageCode || 'A');
    }

    base.push(
      isGraded ? 'Terkoreksi' : 'Belum Dikoreksi',
      isGraded ? String(res.correctCount) : '-',
      isGraded ? String(res.wrongCount) : '-',
      isGraded ? String(res.blankCount) : '-',
      isGraded ? String(res.mcPercent) : '-'
    );

    if (config.includeEssay) {
      base.push(
        isGraded ? String(res.essayTotal) : '-',
        String(res.essayMax),
        isGraded ? String(res.essayPercent) : '-'
      );
    }

    base.push(
      isGraded ? String(res.rawFinalScore) : '-',
      isGraded ? String(res.finalScore) : '-',
      isGraded ? `${res.predicate} (${res.predicateLabel})` : '-',
      isGraded ? (res.passed ? 'Tuntas' : 'Remedial') : 'Menunggu',
      `"${(sheet.notes || '').replace(/"/g, '""')}"`
    );

    return base.join(',');
  });

  const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const safeName = `${config.subject}_${config.className}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_');
  link.href = url;
  link.download = `rekap_nilai_${safeName}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function exportLegerToCsv(store: MultiSubjectStore) {
  const { rows } = computeAllSubjectsLeger(store);
  const className = store.matematika.config.className || 'kelas';

  const headers = [
    'Peringkat',
    'NIS',
    'Nama Siswa',
    'Kelas',
    ...SUBJECT_LIST.map((s) => s.name),
    'Jumlah Nilai',
    'Rata-rata',
    'Mapel Tuntas',
    'Status Keseluruhan',
  ];

  const sorted = [...rows].sort(
    (a, b) => (b.averageScore ?? -1) - (a.averageScore ?? -1)
  );

  const lines = sorted.map((row) => {
    const subjVals = SUBJECT_LIST.map((s) => {
      const cell = row.subjects[s.id];
      return cell.isGraded && cell.score !== null ? String(cell.score) : '-';
    });
    const statusText =
      row.overallStatus === 'tuntas-semua'
        ? 'Tuntas Semua Mapel'
        : row.overallStatus === 'remedial'
        ? `${row.remedialSubjectCount} Mapel Remedial`
        : 'Belum Lengkap';

    return [
      row.rank ? String(row.rank) : '-',
      row.nis,
      `"${row.name.replace(/"/g, '""')}"`,
      `"${row.className.replace(/"/g, '""')}"`,
      ...subjVals,
      row.gradedSubjectCount > 0 ? String(row.totalScore) : '-',
      row.averageScore !== null ? String(row.averageScore) : '-',
      `${row.passedSubjectCount}/${SUBJECT_LIST.length}`,
      statusText,
    ].join(',');
  });

  const csvContent = '\uFEFF' + [headers.join(','), ...lines].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const safeClass = className.toLowerCase().replace(/[^a-z0-9]+/g, '_');
  link.href = url;
  link.download = `leger_semua_mapel_${safeClass}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function playGradingBeep(kind: 'tick' | 'complete' = 'tick') {
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = kind === 'complete' ? 880 : 540;
    gain.gain.setValueAtTime(0.05, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(
      0.001,
      ctx.currentTime + (kind === 'complete' ? 0.16 : 0.055)
    );
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + (kind === 'complete' ? 0.17 : 0.06));
  } catch {
    // Ignore audio restriction errors
  }
}

function parseKey(str: string): Record<number, OptionLetter> {
  const map: Record<number, OptionLetter> = {};
  for (let i = 0; i < str.length; i++) {
    map[i + 1] = str[i] as OptionLetter;
  }
  return map;
}

function makeSeedAnswers(
  pattern: string,
  count = 20,
  optCount: 4 | 5 = 4
): Record<number, OptionLetter | null> {
  return buildAnswersFromString(pattern, count, optCount);
}

interface BaseStudent {
  id: string;
  nis: string;
  name: string;
  className: string;
}

const SEED_ROSTER: BaseStudent[] = [
  { id: 'stu-01', nis: '2425101', name: 'Alya Rahmawati', className: 'V-A' },
  { id: 'stu-02', nis: '2425102', name: 'Bagas Pratama Putra', className: 'V-A' },
  { id: 'stu-03', nis: '2425103', name: 'Citra Dewi Lestari', className: 'V-A' },
  { id: 'stu-04', nis: '2425104', name: 'Dimas Arya Nugroho', className: 'V-A' },
  { id: 'stu-05', nis: '2425105', name: 'Farah Nabila Azzahra', className: 'V-A' },
  { id: 'stu-06', nis: '2425106', name: 'Gilang Ramadhan', className: 'V-A' },
  { id: 'stu-07', nis: '2425107', name: 'Hana Salsabila', className: 'V-A' },
  { id: 'stu-08', nis: '2425108', name: 'Ilham Mahendra', className: 'V-A' },
  { id: 'stu-09', nis: '2425109', name: 'Nadia Kusuma Putri', className: 'V-A' },
];

function buildSeedSheetsForSubject(
  patterns: (string | null)[],
  essaysList: (Record<string, number> | null)[],
  notesList: string[]
): StudentSheet[] {
  return SEED_ROSTER.map((stu, idx) => {
    const pat = patterns[idx];
    const ess = essaysList[idx];
    return {
      id: stu.id,
      nis: stu.nis,
      name: stu.name,
      className: stu.className,
      packageCode: 'A',
      answers: pat ? makeSeedAnswers(pat, 20, 4) : {},
      essayScores: ess ?? {},
      notes: notesList[idx] ?? '',
      gradedAt: pat ? '2026-10-14T09:15:00' : null,
    };
  });
}

// Subject keys (20 MC, options A-D suited for SD/MI Kurikulum Merdeka, easily switchable to A-E)
const MTK_KEY_A = 'BCDAABDCABCDABDCBACD';
const IPAS_KEY_A = 'ADCBBCADDCBAABCDCDAB';
const PKN_KEY_A = 'CABDABCDDCBABACDACBD';
const BINDO_KEY_A = 'DBCAACBDABDCBACDABDC';
const SBDP_KEY_A = 'ABCDDCBAABCDCBADBCDA';

export const INITIAL_MULTI_SUBJECT_STORE: MultiSubjectStore = {
  matematika: {
    config: {
      title: 'Penilaian Tengah Semester Ganjil',
      subject: 'Matematika',
      className: 'V-A',
      examDate: '2026-10-14',
      kkm: 75,
      mcCount: 20,
      optionCount: 4,
      scoringMode: 'standard',
      mcWeight: 70,
      includeEssay: true,
      enableMultiPackage: false,
      roundingMode: 'decimal1',
      curveAdjustment: 0,
      answerKey: parseKey(MTK_KEY_A),
      packageKeys: {
        A: parseKey(MTK_KEY_A),
        B: parseKey('CDABBCADBCDAABCDCBAD'),
        C: parseKey('DABCCBDACDABBCDADBAC'),
      },
      questionRules: {
        15: { weight: 2, status: 'normal' },
        20: { weight: 2, status: 'normal' },
      },
      essays: [
        {
          id: 'mtk-e1',
          label: 'Uraian 1',
          topic: 'Operasi hitung campuran pecahan dan desimal',
          maxScore: 10,
        },
        {
          id: 'mtk-e2',
          label: 'Uraian 2',
          topic: 'Menghitung keliling dan luas bangun datar gabungan',
          maxScore: 15,
        },
        {
          id: 'mtk-e3',
          label: 'Uraian 3',
          topic: 'Menyelesaikan soal cerita perbandingan dan skala',
          maxScore: 15,
        },
      ],
    },
    sheets: buildSeedSheetsForSubject(
      [
        'BCDAABDCABCDABDCBACB',
        'BCDBABDCACCDABDCBAAD',
        'BCDAABDCABCDABDCBACD',
        'BADAABDDABBDABCC-ACD',
        'BCDAABDCABCDABDCBABD',
        'BCDCABDCAACAABDC-ABD',
        'BCDAABDCABDDABDCBACD',
        null,
        null,
      ],
      [
        { 'mtk-e1': 10, 'mtk-e2': 14, 'mtk-e3': 13 },
        { 'mtk-e1': 8, 'mtk-e2': 11, 'mtk-e3': 10 },
        { 'mtk-e1': 10, 'mtk-e2': 15, 'mtk-e3': 14 },
        { 'mtk-e1': 7, 'mtk-e2': 9, 'mtk-e3': 8 },
        { 'mtk-e1': 9, 'mtk-e2': 13, 'mtk-e3': 12 },
        { 'mtk-e1': 6, 'mtk-e2': 8, 'mtk-e3': 7 },
        { 'mtk-e1': 9, 'mtk-e2': 12, 'mtk-e3': 13 },
        null,
        null,
      ],
      [
        'Langkah pengerjaan pecahan sangat rapi.',
        'Perlu latihan soal skala.',
        'Sangat baik, seluruh PG benar.',
        'Perlu pendampingan luas gabungan.',
        '',
        'Masuk program remedial Matematika.',
        'Konsisten dan teliti.',
        '',
        '',
      ]
    ),
  },
  ipas: {
    config: {
      title: 'Penilaian Tengah Semester Ganjil',
      subject: 'IPAS',
      className: 'V-A',
      examDate: '2026-10-15',
      kkm: 75,
      mcCount: 20,
      optionCount: 4,
      scoringMode: 'standard',
      mcWeight: 70,
      includeEssay: true,
      enableMultiPackage: false,
      roundingMode: 'decimal1',
      curveAdjustment: 0,
      answerKey: parseKey(IPAS_KEY_A),
      packageKeys: {
        A: parseKey(IPAS_KEY_A),
        B: parseKey('DCBAABCDADCBBCADBCDA'),
        C: parseKey('BCADDCBAADCBCDABABCD'),
      },
      questionRules: {
        18: { weight: 2, status: 'normal' },
      },
      essays: [
        {
          id: 'ipas-e1',
          label: 'Uraian 1',
          topic: 'Menjelaskan rantai makanan dan keseimbangan ekosistem',
          maxScore: 15,
        },
        {
          id: 'ipas-e2',
          label: 'Uraian 2',
          topic: 'Sifat cahaya dan penerapannya dalam kehidupan sehari-hari',
          maxScore: 15,
        },
      ],
    },
    sheets: buildSeedSheetsForSubject(
      [
        'ADCBBCADDCBAABCDCDAB',
        'ADCBBCADDCBAABCDCDAC',
        'ADCBBCADDCBAABCDCDAB',
        'ADCBBCADDCAAABDDCDAB',
        'ADCBBCADDCBAABDDCDAB',
        'ADCBBAADDCBAABCCCDAA',
        'ADCBBCADDCBAABCDCDAB',
        'ADCBBCADDCBAABDDCDAB',
        null,
      ],
      [
        { 'ipas-e1': 14, 'ipas-e2': 14 },
        { 'ipas-e1': 12, 'ipas-e2': 11 },
        { 'ipas-e1': 15, 'ipas-e2': 14 },
        { 'ipas-e1': 11, 'ipas-e2': 10 },
        { 'ipas-e1': 13, 'ipas-e2': 13 },
        { 'ipas-e1': 10, 'ipas-e2': 9 },
        { 'ipas-e1': 14, 'ipas-e2': 13 },
        { 'ipas-e1': 12, 'ipas-e2': 12 },
        null,
      ],
      [
        'Pemahaman ekosistem sangat baik.',
        '',
        'Sempurna di pilihan ganda.',
        '',
        '',
        'Perlu pendalaman materi sifat cahaya.',
        '',
        '',
        '',
      ]
    ),
  },
  pancasila: {
    config: {
      title: 'Penilaian Tengah Semester Ganjil',
      subject: 'Pendidikan Pancasila',
      className: 'V-A',
      examDate: '2026-10-16',
      kkm: 75,
      mcCount: 20,
      optionCount: 4,
      scoringMode: 'standard',
      mcWeight: 70,
      includeEssay: true,
      enableMultiPackage: false,
      roundingMode: 'decimal1',
      curveAdjustment: 0,
      answerKey: parseKey(PKN_KEY_A),
      packageKeys: {
        A: parseKey(PKN_KEY_A),
        B: parseKey('ABCDCABDBACDDCCBACBD'),
        C: parseKey('DCBACABDDABCBACDACBD'),
      },
      questionRules: {},
      essays: [
        {
          id: 'pkn-e1',
          label: 'Uraian 1',
          topic: 'Contoh penerapan nilai Pancasila di lingkungan sekolah',
          maxScore: 15,
        },
        {
          id: 'pkn-e2',
          label: 'Uraian 2',
          topic: 'Perbedaan hak, kewajiban, dan tanggung jawab warga',
          maxScore: 15,
        },
      ],
    },
    sheets: buildSeedSheetsForSubject(
      [
        'CABDABCDDCBABACDACBD',
        'CABDABCDDCBABACDACBA',
        'CABDABCDDCBABACDACBD',
        'CABDABDDDCBABACDACBC',
        'CABDABCDDCBABACDACBD',
        'CABDABCCDCBABADDACBA',
        'CABDABCDDCBABACDACBD',
        'CABDABCDDCBABACDACBA',
        null,
      ],
      [
        { 'pkn-e1': 14, 'pkn-e2': 15 },
        { 'pkn-e1': 13, 'pkn-e2': 12 },
        { 'pkn-e1': 15, 'pkn-e2': 15 },
        { 'pkn-e1': 12, 'pkn-e2': 11 },
        { 'pkn-e1': 14, 'pkn-e2': 14 },
        { 'pkn-e1': 11, 'pkn-e2': 10 },
        { 'pkn-e1': 14, 'pkn-e2': 13 },
        { 'pkn-e1': 13, 'pkn-e2': 12 },
        null,
      ],
      ['', '', '', '', '', '', '', '', '']
    ),
  },
  bindo: {
    config: {
      title: 'Penilaian Tengah Semester Ganjil',
      subject: 'Bahasa Indonesia',
      className: 'V-A',
      examDate: '2026-10-17',
      kkm: 75,
      mcCount: 20,
      optionCount: 4,
      scoringMode: 'standard',
      mcWeight: 70,
      includeEssay: true,
      enableMultiPackage: false,
      roundingMode: 'decimal1',
      curveAdjustment: 0,
      answerKey: parseKey(BINDO_KEY_A),
      packageKeys: {
        A: parseKey(BINDO_KEY_A),
        B: parseKey('ACBDDBCAABDCBACDCBAD'),
        C: parseKey('BACDDBCAACBDABDCABDC'),
      },
      questionRules: {
        19: { weight: 2, status: 'normal' },
      },
      essays: [
        {
          id: 'bi-e1',
          label: 'Uraian 1',
          topic: 'Menentukan ide pokok dan kalimat utama paragraf teks bacaan',
          maxScore: 15,
        },
        {
          id: 'bi-e2',
          label: 'Uraian 2',
          topic: 'Menulis paragraf deskripsi dengan ejaan PUEBI yang tepat',
          maxScore: 15,
        },
      ],
    },
    sheets: buildSeedSheetsForSubject(
      [
        'DBCAACBDABDCBACDABDC',
        'DBCAACBDABDCBACDABDA',
        'DBCAACBDABDCBACDABDC',
        'DBCAABBDABDCBACBABDC',
        'DBCAACBDABDCBACDABDC',
        'DBCBACBDABDCBADDAADC',
        'DBCAACBDABDCBACDABDB',
        null,
        null,
      ],
      [
        { 'bi-e1': 14, 'bi-e2': 14 },
        { 'bi-e1': 12, 'bi-e2': 11 },
        { 'bi-e1': 15, 'bi-e2': 14 },
        { 'bi-e1': 10, 'bi-e2': 11 },
        { 'bi-e1': 14, 'bi-e2': 13 },
        { 'bi-e1': 10, 'bi-e2': 10 },
        { 'bi-e1': 13, 'bi-e2': 14 },
        null,
        null,
      ],
      [
        'Penggunaan ejaan sangat baik.',
        '',
        'Kaya kosakata pada uraian.',
        'Perlu latihan menentukan ide pokok.',
        '',
        '',
        '',
        '',
        '',
      ]
    ),
  },
  sbdp: {
    config: {
      title: 'Penilaian Tengah Semester Ganjil',
      subject: 'SBDP',
      className: 'V-A',
      examDate: '2026-10-18',
      kkm: 75,
      mcCount: 20,
      optionCount: 4,
      scoringMode: 'standard',
      mcWeight: 70,
      includeEssay: true,
      enableMultiPackage: false,
      roundingMode: 'decimal1',
      curveAdjustment: 0,
      answerKey: parseKey(SBDP_KEY_A),
      packageKeys: {
        A: parseKey(SBDP_KEY_A),
        B: parseKey('DCBAABCDCBADBCDAABCD'),
        C: parseKey('CBADABCDDCBABCDABCDA'),
      },
      questionRules: {},
      essays: [
        {
          id: 'sbdp-e1',
          label: 'Uraian 1',
          topic: 'Unsur seni rupa (garis, warna, tekstur) dan prinsip komposisi',
          maxScore: 15,
        },
        {
          id: 'sbdp-e2',
          label: 'Uraian 2',
          topic: 'Mengidentifikasi tangga nada diatonis mayor dan minor',
          maxScore: 15,
        },
      ],
    },
    sheets: buildSeedSheetsForSubject(
      [
        'ABCDDCBAABCDCBADBCDA',
        'ABCDDCBAABCDCBADBCDB',
        'ABCDDCBAABCDCBADBCDA',
        'ABCDDCBAABCCCBADBCDA',
        'ABCDDCBAABCDCBADBCDA',
        'ABCDDCBAABCDCBADBCDB',
        'ABCDDCBAABCDCBADBCDA',
        'ABCDDCBAABCDCBADBCDA',
        null,
      ],
      [
        { 'sbdp-e1': 15, 'sbdp-e2': 14 },
        { 'sbdp-e1': 13, 'sbdp-e2': 13 },
        { 'sbdp-e1': 15, 'sbdp-e2': 15 },
        { 'sbdp-e1': 12, 'sbdp-e2': 13 },
        { 'sbdp-e1': 14, 'sbdp-e2': 14 },
        { 'sbdp-e1': 13, 'sbdp-e2': 12 },
        { 'sbdp-e1': 14, 'sbdp-e2': 14 },
        { 'sbdp-e1': 14, 'sbdp-e2': 13 },
        null,
      ],
      ['', '', '', '', '', '', '', '', '']
    ),
  },
};

export function normalizeStoredConfig(
  raw: Partial<ExamConfig>,
  fallback: ExamConfig
): ExamConfig {
  const baseKey = raw.answerKey ?? fallback.answerKey;
  return {
    ...fallback,
    ...raw,
    answerKey: baseKey,
    packageKeys: {
      A: raw.packageKeys?.A ?? baseKey,
      B: raw.packageKeys?.B ?? fallback.packageKeys.B,
      C: raw.packageKeys?.C ?? fallback.packageKeys.C,
    },
    questionRules: raw.questionRules ?? fallback.questionRules,
    enableMultiPackage: raw.enableMultiPackage ?? false,
    roundingMode: raw.roundingMode ?? 'decimal1',
    curveAdjustment: raw.curveAdjustment ?? 0,
  };
}

export function normalizeStoredSheets(
  raw: Partial<StudentSheet>[],
  defaultClassName: string
): StudentSheet[] {
  return raw.map((item, idx) => ({
    id: item.id ?? `stu-${Date.now()}-${idx}`,
    nis: item.nis ?? '-',
    name: item.name ?? 'Tanpa Nama',
    className: item.className ?? defaultClassName,
    packageCode: item.packageCode ?? 'A',
    answers: item.answers ?? {},
    essayScores: item.essayScores ?? {},
    notes: item.notes ?? '',
    gradedAt: item.gradedAt ?? null,
  }));
}

export function normalizeMultiSubjectStore(
  raw: Partial<MultiSubjectStore> | null | undefined
): MultiSubjectStore {
  const result = {} as MultiSubjectStore;
  SUBJECT_LIST.forEach((subj) => {
    const fallbackState = INITIAL_MULTI_SUBJECT_STORE[subj.id];
    const incoming = raw?.[subj.id];
    if (!incoming) {
      result[subj.id] = fallbackState;
    } else {
      const cfg = normalizeStoredConfig(incoming.config ?? {}, fallbackState.config);
      const sheets = Array.isArray(incoming.sheets)
        ? normalizeStoredSheets(incoming.sheets, cfg.className)
        : fallbackState.sheets;
      result[subj.id] = { config: cfg, sheets };
    }
  });
  return result;
}
