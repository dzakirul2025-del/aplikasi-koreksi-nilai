export type OptionLetter = 'A' | 'B' | 'C' | 'D' | 'E';

export type PackageCode = 'A' | 'B' | 'C';

export type ScoringMode = 'standard' | 'penalty';

export type QuestionStatus = 'normal' | 'bonus' | 'annulled';

export type RoundingMode = 'decimal1' | 'round' | 'ceil';

export type GradePredicate = 'A' | 'B' | 'C' | 'D';

export type ActiveTab = 'koreksi' | 'kunci' | 'rekap' | 'analisis';

export type SubjectId =
  | 'matematika'
  | 'ipas'
  | 'pancasila'
  | 'bindo'
  | 'sbdp';

export interface SubjectMeta {
  id: SubjectId;
  name: string;
  shortName: string;
  sheetName: string;
}

export interface QuestionRule {
  weight: 1 | 2 | 3;
  status: QuestionStatus;
}

export interface EssayQuestion {
  id: string;
  label: string;
  topic: string;
  maxScore: number;
}

export interface ExamConfig {
  title: string;
  subject: string;
  className: string;
  examDate: string;
  kkm: number;
  mcCount: number;
  optionCount: 4 | 5;
  scoringMode: ScoringMode;
  mcWeight: number;
  includeEssay: boolean;
  enableMultiPackage: boolean;
  roundingMode: RoundingMode;
  curveAdjustment: number;
  answerKey: Record<number, OptionLetter>;
  packageKeys: Record<PackageCode, Record<number, OptionLetter>>;
  questionRules: Record<number, QuestionRule>;
  essays: EssayQuestion[];
}

export interface StudentSheet {
  id: string;
  nis: string;
  name: string;
  className: string;
  packageCode: PackageCode;
  answers: Record<number, OptionLetter | null>;
  essayScores: Record<string, number>;
  notes: string;
  gradedAt: string | null;
}

export interface SubjectState {
  config: ExamConfig;
  sheets: StudentSheet[];
}

export type MultiSubjectStore = Record<SubjectId, SubjectState>;

export interface StudentGradeResult {
  correctCount: number;
  wrongCount: number;
  blankCount: number;
  bonusCount: number;
  annulledCount: number;
  mcRawScore: number;
  mcMaxRaw: number;
  mcPercent: number;
  essayTotal: number;
  essayMax: number;
  essayPercent: number;
  rawFinalScore: number;
  finalScore: number;
  passed: boolean;
  predicate: GradePredicate;
  predicateLabel: string;
}

export interface ItemAnalysisRow {
  questionNumber: number;
  keyAnswer: OptionLetter;
  questionStatus: QuestionStatus;
  questionWeight: 1 | 2 | 3;
  correctCount: number;
  wrongCount: number;
  blankCount: number;
  totalGraded: number;
  accuracyPercent: number;
  difficulty: 'Mudah' | 'Sedang' | 'Sulit';
  discriminationIndex: number;
  discriminationLabel: 'Sangat Baik' | 'Baik' | 'Cukup' | 'Revisi';
  distribution: Record<OptionLetter, number>;
}

export interface ParsedExcelStudentRow {
  rowIndex: number;
  nis: string;
  name: string;
  className: string;
  packageCode: PackageCode;
  status: 'valid' | 'duplicate' | 'invalid';
  reason?: string;
}

export interface LegerSubjectCell {
  subjectId: SubjectId;
  isGraded: boolean;
  score: number | null;
  passed: boolean;
  predicate: GradePredicate | null;
  kkm: number;
}

export interface LegerStudentRow {
  studentId: string;
  nis: string;
  name: string;
  className: string;
  subjects: Record<SubjectId, LegerSubjectCell>;
  gradedSubjectCount: number;
  passedSubjectCount: number;
  remedialSubjectCount: number;
  totalScore: number;
  averageScore: number | null;
  rank: number | null;
  overallStatus: 'tuntas-semua' | 'remedial' | 'belum-lengkap';
}
