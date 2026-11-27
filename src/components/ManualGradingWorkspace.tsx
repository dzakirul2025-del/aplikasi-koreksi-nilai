import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Check,
  CheckCircle2,
  Dice5,
  FileSpreadsheet,
  Keyboard,
  Minus,
  MousePointerClick,
  Plus,
  Redo2,
  RotateCcw,
  Terminal,
  Undo2,
  UserPlus,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import {
  ExamConfig,
  OptionLetter,
  PackageCode,
  StudentSheet,
} from '../types/grading';
import {
  PACKAGE_CODES,
  answersToString,
  buildAnswersFromString,
  generateSampleAnswers,
  getAvailableOptions,
  getPackageKeyMap,
  getQuestionRule,
  gradeStudentSheet,
  playGradingBeep,
} from '../utils/scoring';

interface ManualGradingWorkspaceProps {
  config: ExamConfig;
  sheets: StudentSheet[];
  activeSheetId: string | null;
  onSelectSheet: (id: string) => void;
  onCreateNewSheet: () => void;
  onSaveSheet: (sheet: StudentSheet, advanceToNext: boolean) => void;
  onOpenImportExcel: () => void;
}

interface DraftSnapshot {
  answers: Record<number, OptionLetter | null>;
  essayScores: Record<string, number>;
}

type InputMode = 'click' | 'keyboard' | 'string';

export const ManualGradingWorkspace: React.FC<ManualGradingWorkspaceProps> = ({
  config,
  sheets,
  activeSheetId,
  onSelectSheet,
  onCreateNewSheet,
  onSaveSheet,
  onOpenImportExcel,
}) => {
  const activeSheet = useMemo(
    () => sheets.find((s) => s.id === activeSheetId) ?? null,
    [sheets, activeSheetId]
  );

  const [nis, setNis] = useState('');
  const [name, setName] = useState('');
  const [studentClass, setStudentClass] = useState(config.className);
  const [packageCode, setPackageCode] = useState<PackageCode>('A');
  const [answers, setAnswers] = useState<Record<number, OptionLetter | null>>({});
  const [essayScores, setEssayScores] = useState<Record<string, number>>({});
  const [notes, setNotes] = useState('');

  const [inputMode, setInputMode] = useState<InputMode>('click');
  const [rapidString, setRapidString] = useState('');
  const [cursorQuestion, setCursorQuestion] = useState<number>(1);
  const [showKeyComparison, setShowKeyComparison] = useState<boolean>(true);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Undo / Redo stacks for current sheet edits
  const [undoStack, setUndoStack] = useState<DraftSnapshot[]>([]);
  const [redoStack, setRedoStack] = useState<DraftSnapshot[]>([]);

  const options = useMemo(
    () => getAvailableOptions(config.optionCount),
    [config.optionCount]
  );

  const activeKeyMap = useMemo(
    () => getPackageKeyMap(config, packageCode),
    [config, packageCode]
  );

  const pushHistory = useCallback(
    (nextAnswers: Record<number, OptionLetter | null>, nextEssays: Record<string, number>) => {
      setUndoStack((prev) => [
        ...prev.slice(-29),
        { answers: { ...answers }, essayScores: { ...essayScores } },
      ]);
      setRedoStack([]);
      setAnswers(nextAnswers);
      setEssayScores(nextEssays);
    },
    [answers, essayScores]
  );

  const handleUndo = useCallback(() => {
    setUndoStack((prev) => {
      if (prev.length === 0) return prev;
      const last = prev[prev.length - 1];
      setRedoStack((r) => [
        ...r,
        { answers: { ...answers }, essayScores: { ...essayScores } },
      ]);
      setAnswers(last.answers);
      setEssayScores(last.essayScores);
      return prev.slice(0, -1);
    });
  }, [answers, essayScores]);

  const handleRedo = useCallback(() => {
    setRedoStack((prev) => {
      if (prev.length === 0) return prev;
      const next = prev[prev.length - 1];
      setUndoStack((u) => [
        ...u,
        { answers: { ...answers }, essayScores: { ...essayScores } },
      ]);
      setAnswers(next.answers);
      setEssayScores(next.essayScores);
      return prev.slice(0, -1);
    });
  }, [answers, essayScores]);

  // Sync local draft whenever activeSheetId changes
  useEffect(() => {
    if (activeSheet) {
      setNis(activeSheet.nis);
      setName(activeSheet.name);
      setStudentClass(activeSheet.className || config.className);
      setPackageCode(activeSheet.packageCode || 'A');
      setAnswers({ ...activeSheet.answers });
      setEssayScores({ ...activeSheet.essayScores });
      setNotes(activeSheet.notes);
      setRapidString(answersToString(activeSheet.answers, config.mcCount));
    } else {
      const nextNum = sheets.length + 1;
      setNis(`2425${String(100 + nextNum).padStart(3, '0')}`);
      setName('');
      setStudentClass(config.className);
      setPackageCode('A');
      setAnswers({});
      setEssayScores({});
      setNotes('');
      setRapidString('');
    }
    setUndoStack([]);
    setRedoStack([]);
    setCursorQuestion(1);
    setValidationError(null);
  }, [activeSheetId, activeSheet, sheets.length, config.className, config.mcCount]);

  // Keep rapidString synced when switching into 'string' mode
  useEffect(() => {
    if (inputMode === 'string') {
      setRapidString(answersToString(answers, config.mcCount).replace(/-+$/, ''));
    }
  }, [inputMode, answers, config.mcCount]);

  // Global keyboard handler (Ctrl+Z / Ctrl+Y + Ketik Cepat auto-advance)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Undo / Redo shortcuts outside text fields
      const target = e.target as HTMLElement | null;
      const isEditingText =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable);

      if ((e.ctrlKey || e.metaKey) && !isEditingText) {
        if (e.key.toLowerCase() === 'z' && !e.shiftKey) {
          e.preventDefault();
          handleUndo();
          return;
        }
        if (e.key.toLowerCase() === 'y' || (e.key.toLowerCase() === 'z' && e.shiftKey)) {
          e.preventDefault();
          handleRedo();
          return;
        }
      }

      if (inputMode !== 'keyboard' || isEditingText) return;

      const key = e.key.toUpperCase();

      if (options.includes(key as OptionLetter)) {
        e.preventDefault();
        const nextAnswers = { ...answers, [cursorQuestion]: key as OptionLetter };
        pushHistory(nextAnswers, essayScores);
        if (soundEnabled) {
          playGradingBeep(cursorQuestion === config.mcCount ? 'complete' : 'tick');
        }
        setCursorQuestion((q) => (q < config.mcCount ? q + 1 : q));
        return;
      }

      if (e.key === '0' || e.key === ' ' || e.key === '-') {
        e.preventDefault();
        const nextAnswers = { ...answers, [cursorQuestion]: null };
        pushHistory(nextAnswers, essayScores);
        if (soundEnabled) playGradingBeep('tick');
        setCursorQuestion((q) => (q < config.mcCount ? q + 1 : q));
        return;
      }

      if (e.key === 'Backspace' || e.key === 'ArrowUp') {
        e.preventDefault();
        setCursorQuestion((q) => Math.max(1, q - 1));
        return;
      }

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setCursorQuestion((q) => Math.min(config.mcCount, q + 1));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    inputMode,
    options,
    cursorQuestion,
    config.mcCount,
    answers,
    essayScores,
    soundEnabled,
    pushHistory,
    handleUndo,
    handleRedo,
  ]);

  const gradeResult = useMemo(
    () => gradeStudentSheet({ answers, essayScores, packageCode }, config),
    [answers, essayScores, packageCode, config]
  );

  const answeredCount = useMemo(() => {
    let count = 0;
    for (let i = 1; i <= config.mcCount; i++) {
      if (answers[i]) count++;
    }
    return count;
  }, [answers, config.mcCount]);

  const handleToggleOption = (qNum: number, opt: OptionLetter) => {
    const nextAnswers = {
      ...answers,
      [qNum]: answers[qNum] === opt ? null : opt,
    };
    pushHistory(nextAnswers, essayScores);
    if (soundEnabled) {
      playGradingBeep(qNum === config.mcCount ? 'complete' : 'tick');
    }
    setCursorQuestion(qNum < config.mcCount ? qNum + 1 : qNum);
  };

  const handleRapidStringChange = (val: string) => {
    const sanitized = val.toUpperCase().replace(/[^A-E0\-_. ]/g, '');
    setRapidString(sanitized);
    const parsed = buildAnswersFromString(
      sanitized.replace(/ /g, '-'),
      config.mcCount,
      config.optionCount
    );
    setAnswers(parsed);
  };

  const handleEssayChange = (essayId: string, maxScore: number, nextVal: number) => {
    const clamped = Math.max(
      0,
      Math.min(maxScore, Number.isNaN(nextVal) ? 0 : nextVal)
    );
    const nextEssays = {
      ...essayScores,
      [essayId]: clamped,
    };
    pushHistory(answers, nextEssays);
  };

  const handleClearSheet = () => {
    pushHistory({}, {});
    setNotes('');
    setRapidString('');
    setCursorQuestion(1);
    setValidationError(null);
  };

  const handleFillSample = () => {
    const sample = generateSampleAnswers(config, packageCode, 0.78);
    pushHistory(sample.answers, sample.essayScores);
    setRapidString(answersToString(sample.answers, config.mcCount));
    if (!name.trim()) {
      setName('Rizky Aditya Saputra');
    }
    setValidationError(null);
  };

  const handleSubmit = (advanceToNext: boolean) => {
    if (!name.trim()) {
      setValidationError('Nama siswa wajib diisi sebelum menyimpan hasil koreksi.');
      return;
    }
    setValidationError(null);

    const payload: StudentSheet = {
      id: activeSheet?.id ?? `stu-${Date.now()}`,
      nis: nis.trim() || '-',
      name: name.trim(),
      className: studentClass.trim() || config.className,
      packageCode: config.enableMultiPackage ? packageCode : 'A',
      answers,
      essayScores,
      notes: notes.trim(),
      gradedAt: new Date().toISOString(),
    };

    onSaveSheet(payload, advanceToNext);
  };

  const splitIndex = Math.ceil(config.mcCount / 2);
  const leftQuestions = Array.from({ length: splitIndex }, (_, i) => i + 1);
  const rightQuestions = Array.from(
    { length: config.mcCount - splitIndex },
    (_, i) => splitIndex + i + 1
  );

  const ungradedCount = sheets.filter((s) => s.gradedAt === null).length;

  const renderQuestionRow = (qNum: number) => {
    const chosen = answers[qNum] ?? null;
    const key = activeKeyMap[qNum];
    const rule = getQuestionRule(config, qNum);
    const isAnnulled = rule.status === 'annulled';
    const isBonus = rule.status === 'bonus';
    const isCorrect = isBonus || (chosen !== null && chosen === key);
    const isCursor = inputMode === 'keyboard' && cursorQuestion === qNum;

    return (
      <div
        key={qNum}
        onClick={() => setCursorQuestion(qNum)}
        className={`flex items-center justify-between gap-2 px-3 py-2 transition-colors duration-150 ${
          isAnnulled
            ? 'bg-slate-50/90 opacity-65'
            : isCursor
            ? 'bg-[#1D4ED8]/8'
            : 'hover:bg-slate-50'
        }`}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-11 text-right shrink-0">
            <span
              className={`font-mono text-xs font-semibold tabular-nums ${
                isCursor ? 'text-[#1D4ED8]' : 'text-slate-500'
              }`}
            >
              {String(qNum).padStart(2, '0')}.
            </span>
            {rule.weight > 1 && !isAnnulled && (
              <span className="ml-0.5 font-mono text-[10px] font-semibold text-[#1D4ED8]">
                {rule.weight}x
              </span>
            )}
          </div>

          <div
            className="flex items-center gap-1.5"
            role="group"
            aria-label={`Soal nomor ${qNum}`}
          >
            {options.map((opt) => {
              const isSelected = chosen === opt;
              let btnClasses =
                'border-slate-300 bg-white text-slate-700 hover:border-slate-500 hover:bg-slate-50';

              if (isSelected) {
                if (!showKeyComparison || isAnnulled) {
                  btnClasses = 'border-[#1D4ED8] bg-[#1D4ED8] text-white';
                } else if (isCorrect) {
                  btnClasses = 'border-[#059669] bg-[#059669] text-white';
                } else {
                  btnClasses = 'border-[#DC2626] bg-[#DC2626] text-white';
                }
              }

              return (
                <button
                  key={opt}
                  type="button"
                  disabled={isAnnulled}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleToggleOption(qNum, opt);
                  }}
                  aria-pressed={isSelected}
                  className={`h-9 w-9 rounded-full border text-xs font-mono font-semibold transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1D4ED8] disabled:cursor-not-allowed cursor-pointer ${btnClasses}`}
                >
                  {opt}
                </button>
              );
            })}
          </div>
        </div>

        {/* Dual-coded comparison feedback */}
        <div className="w-24 text-right shrink-0">
          {isAnnulled ? (
            <span className="text-xs font-mono text-slate-500">Anulir</span>
          ) : isBonus ? (
            <span className="inline-flex items-center justify-end gap-1 text-xs font-medium text-[#059669]">
              <Check className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span>Bonus</span>
            </span>
          ) : showKeyComparison ? (
            chosen === null ? (
              <span className="text-xs text-slate-400 font-mono">Kosong</span>
            ) : isCorrect ? (
              <span className="inline-flex items-center justify-end gap-1 text-xs font-medium text-[#059669]">
                <Check className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span>Benar</span>
              </span>
            ) : (
              <span className="inline-flex items-center justify-end gap-1 text-xs font-medium text-[#DC2626]">
                <X className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span className="font-mono">Kunci {key}</span>
              </span>
            )
          ) : (
            <span className="text-xs font-mono text-slate-500">
              {chosen ? `Isi ${chosen}` : 'Kosong'}
            </span>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Contextual Exam Header Strip */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Meja Koreksi Lembar Manual
          </h1>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-slate-500">
            <span className="font-medium text-slate-700">{config.subject}</span>
            <span aria-hidden="true">·</span>
            <span>Kelas {config.className}</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono tabular-nums">
              {config.mcCount} PG ({config.optionCount === 4 ? 'A–D' : 'A–E'})
              {config.includeEssay ? ` + ${config.essays.length} Uraian` : ''}
            </span>
            <span aria-hidden="true">·</span>
            <span className="font-mono tabular-nums">KKM {config.kkm}</span>
            {config.enableMultiPackage && (
              <>
                <span aria-hidden="true">·</span>
                <span className="font-mono text-[#1D4ED8] font-medium">
                  Multi-Paket A/B/C
                </span>
              </>
            )}
          </div>
        </div>

        {/* 3-Mode Input Switcher + Audio Toggle */}
        <div className="flex flex-wrap items-center gap-2.5 self-start lg:self-auto">
          <div
            className="inline-flex items-center rounded-lg bg-slate-100 p-1"
            role="tablist"
            aria-label="Mode input jawaban"
          >
            <button
              type="button"
              role="tab"
              aria-selected={inputMode === 'click'}
              onClick={() => setInputMode('click')}
              className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                inputMode === 'click'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <MousePointerClick className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Klik Lembar</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={inputMode === 'keyboard'}
              onClick={() => setInputMode('keyboard')}
              className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                inputMode === 'keyboard'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Keyboard className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Ketik Cepat</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={inputMode === 'string'}
              onClick={() => setInputMode('string')}
              className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                inputMode === 'string'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Terminal className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Input Rangkaian</span>
            </button>
          </div>

          <button
            type="button"
            onClick={() => setSoundEnabled((v) => !v)}
            aria-pressed={soundEnabled}
            title="Aktifkan/matikan bunyi konfirmasi tiap ketikan jawaban"
            className={`inline-flex items-center gap-1.5 h-9 rounded-lg border px-3 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              soundEnabled
                ? 'border-[#1D4ED8] bg-[#1D4ED8]/8 text-[#1D4ED8]'
                : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
            }`}
          >
            {soundEnabled ? (
              <Volume2 className="h-3.5 w-3.5" aria-hidden="true" />
            ) : (
              <VolumeX className="h-3.5 w-3.5" aria-hidden="true" />
            )}
            <span>Suara</span>
          </button>
        </div>
      </div>

      {/* Main Two-Zone Grading Stage */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 items-start">
        {/* LEFT ZONE: Digital Manual Answer Sheet (8 cols) */}
        <section className="lg:col-span-8 bg-white border border-slate-200 rounded-xl">
          {/* Student Identity Header */}
          <div className="p-5 sm:p-6 border-b border-slate-200">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <div className="text-sm font-semibold text-slate-900">
                Identitas Lembar Jawaban
              </div>
              <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500">
                <label className="inline-flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={showKeyComparison}
                    onChange={(e) => setShowKeyComparison(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-[#1D4ED8] focus:ring-[#1D4ED8]"
                  />
                  <span>Koreksi langsung</span>
                </label>
                <span className="font-mono tabular-nums">
                  Terisi {answeredCount}/{config.mcCount}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-12">
              <div className="sm:col-span-3">
                <label
                  htmlFor="student-nis"
                  className="block text-xs font-medium text-slate-600 mb-1.5"
                >
                  NIS / No. Peserta
                </label>
                <input
                  id="student-nis"
                  type="text"
                  value={nis}
                  onChange={(e) => setNis(e.target.value)}
                  placeholder="2425110"
                  className="w-full h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm font-mono tabular-nums text-slate-900 placeholder:text-slate-400 focus:border-[#1D4ED8] focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]/20"
                />
              </div>

              <div className={config.enableMultiPackage ? 'sm:col-span-5' : 'sm:col-span-6'}>
                <label
                  htmlFor="student-name"
                  className="block text-xs font-medium text-slate-600 mb-1.5"
                >
                  Nama Lengkap Siswa
                </label>
                <input
                  id="student-name"
                  type="text"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    if (validationError) setValidationError(null);
                  }}
                  placeholder="Ketik nama siswa dari lembar jawaban..."
                  className="w-full h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#1D4ED8] focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]/20"
                />
              </div>

              <div className={config.enableMultiPackage ? 'sm:col-span-2' : 'sm:col-span-3'}>
                <label
                  htmlFor="student-class"
                  className="block text-xs font-medium text-slate-600 mb-1.5"
                >
                  Kelas
                </label>
                <input
                  id="student-class"
                  type="text"
                  value={studentClass}
                  onChange={(e) => setStudentClass(e.target.value)}
                  placeholder={config.className}
                  className="w-full h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#1D4ED8] focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]/20"
                />
              </div>

              {config.enableMultiPackage && (
                <div className="sm:col-span-2">
                  <span className="block text-xs font-medium text-slate-600 mb-1.5">
                    Paket Soal
                  </span>
                  <div className="inline-flex w-full h-10 rounded-lg bg-slate-100 p-1">
                    {PACKAGE_CODES.map((pkg) => (
                      <button
                        key={pkg}
                        type="button"
                        onClick={() => setPackageCode(pkg)}
                        className={`flex-1 rounded-md font-mono text-xs font-semibold transition-colors cursor-pointer ${
                          packageCode === pkg
                            ? 'bg-white text-[#1D4ED8] shadow-xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        {pkg}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {validationError && (
              <p className="mt-3 flex items-center gap-1.5 text-xs font-medium text-[#DC2626]">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span>{validationError}</span>
              </p>
            )}

            {/* Keyboard Mode Contextual Bar */}
            {inputMode === 'keyboard' && (
              <div className="mt-4 rounded-lg bg-slate-50 border border-slate-200 px-3.5 py-2.5 text-xs text-slate-600">
                Mode Ketik Cepat aktif pada nomor{' '}
                <span className="font-mono font-semibold text-[#1D4ED8] tabular-nums">
                  {String(cursorQuestion).padStart(2, '0')}
                </span>
                . Tekan{' '}
                <span className="font-mono font-semibold text-slate-900">
                  {options.join(' / ')}
                </span>{' '}
                untuk lanjut otomatis,{' '}
                <span className="font-mono font-semibold text-slate-900">0</span> /{' '}
                <span className="font-mono font-semibold text-slate-900">Spasi</span>{' '}
                untuk kosong,{' '}
                <span className="font-mono font-semibold text-slate-900">Backspace</span>{' '}
                untuk mundur.
              </div>
            )}

            {/* Rapid Batch String Input Panel */}
            {inputMode === 'string' && (
              <div className="mt-4 rounded-lg bg-slate-50 border border-slate-200 p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label
                    htmlFor="rapid-string-input"
                    className="text-xs font-semibold text-slate-800"
                  >
                    Ketik Rangkaian Jawaban PG (Gunakan tanda <span className="font-mono">-</span> atau <span className="font-mono">0</span> untuk nomor kosong)
                  </label>
                  <span className="font-mono text-xs text-slate-500 tabular-nums">
                    {rapidString.length} / {config.mcCount} karakter
                  </span>
                </div>
                <input
                  id="rapid-string-input"
                  type="text"
                  maxLength={config.mcCount}
                  value={rapidString}
                  onChange={(e) => handleRapidStringChange(e.target.value)}
                  placeholder={`Ketik langsung ${config.mcCount} huruf, misal: BCDAEBADCE...`}
                  className="w-full h-11 rounded-lg border border-slate-300 bg-white px-3.5 font-mono text-base tracking-[0.22em] uppercase text-slate-900 placeholder:tracking-normal placeholder:normal-case placeholder:text-xs placeholder:text-slate-400 focus:border-[#1D4ED8] focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]/20"
                />
                {/* Live numbered character ruler */}
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {Array.from({ length: config.mcCount }, (_, idx) => {
                    const qNum = idx + 1;
                    const ans = answers[qNum];
                    const key = activeKeyMap[qNum];
                    const rule = getQuestionRule(config, qNum);
                    const ok = rule.status === 'bonus' || (ans && ans === key);
                    const stateClass =
                      rule.status === 'annulled'
                        ? 'text-slate-400 border-slate-200 bg-slate-100'
                        : !ans
                        ? 'text-slate-400 border-slate-200 bg-white'
                        : ok
                        ? 'text-[#059669] border-emerald-200 bg-emerald-50/70 font-semibold'
                        : 'text-[#DC2626] border-red-200 bg-red-50/70 font-semibold';
                    return (
                      <span
                        key={qNum}
                        className={`inline-flex flex-col items-center justify-center w-8 py-1 rounded border font-mono text-[11px] tabular-nums ${stateClass}`}
                      >
                        <span className="text-[9px] text-slate-400 leading-none">
                          {String(qNum).padStart(2, '0')}
                        </span>
                        <span className="mt-0.5 leading-none">{ans ?? '·'}</span>
                      </span>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Part A: Multiple Choice Bubble Sheet */}
          <div className="p-5 sm:p-6 border-b border-slate-200">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
              <div>
                <h2 className="text-base font-semibold text-slate-900">
                  Bagian A. Pilihan Ganda
                  {config.enableMultiPackage ? ` (Kunci Paket ${packageCode})` : ''}
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Klik lingkaran opsi sesuai lembar fisik, atau klik ulang untuk mengosongkan.
                </p>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleUndo}
                  disabled={undoStack.length === 0}
                  title="Batalkan perubahan terakhir (Ctrl+Z)"
                  aria-label="Urungkan perubahan"
                  className="h-9 w-9 inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-35 disabled:pointer-events-none cursor-pointer"
                >
                  <Undo2 className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={handleRedo}
                  disabled={redoStack.length === 0}
                  title="Ulangi perubahan (Ctrl+Y)"
                  aria-label="Ulangi perubahan"
                  className="h-9 w-9 inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-35 disabled:pointer-events-none cursor-pointer"
                >
                  <Redo2 className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={handleFillSample}
                  className="inline-flex items-center gap-1.5 h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Dice5 className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Isi Contoh</span>
                </button>
                <button
                  type="button"
                  onClick={handleClearSheet}
                  className="inline-flex items-center gap-1.5 h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Bersihkan</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 border border-slate-200 rounded-lg divide-y md:divide-y-0 md:divide-x divide-slate-200 overflow-hidden">
              <div className="divide-y divide-slate-100">
                {leftQuestions.map(renderQuestionRow)}
              </div>
              <div className="divide-y divide-slate-100">
                {rightQuestions.map(renderQuestionRow)}
              </div>
            </div>
          </div>

          {/* Part B: Manual Essay Grading */}
          {config.includeEssay && config.essays.length > 0 && (
            <div className="p-5 sm:p-6">
              <div className="flex items-baseline justify-between gap-2 mb-4">
                <div>
                  <h2 className="text-base font-semibold text-slate-900">
                    Bagian B. Penilaian Uraian Manual
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Masukkan skor per nomor uraian sesuai rubrik koreksi kertas siswa.
                  </p>
                </div>
                <div className="text-xs font-mono font-medium text-slate-600 tabular-nums shrink-0">
                  Total {gradeResult.essayTotal} / {gradeResult.essayMax} poin
                </div>
              </div>

              <div className="divide-y divide-slate-200 border border-slate-200 rounded-lg overflow-hidden">
                {config.essays.map((eq) => {
                  const val = essayScores[eq.id] ?? 0;
                  return (
                    <div
                      key={eq.id}
                      className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between px-4 py-3.5 bg-white"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 text-sm font-medium text-slate-900">
                          <span>{eq.label}</span>
                          <span aria-hidden="true" className="text-slate-300">
                            ·
                          </span>
                          <span className="font-mono text-xs text-slate-500 tabular-nums">
                            Maks {eq.maxScore} poin
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">{eq.topic}</p>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleEssayChange(eq.id, eq.maxScore, val - 1)}
                          aria-label={`Kurangi skor ${eq.label}`}
                          className="h-9 w-9 inline-flex items-center justify-center rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 cursor-pointer"
                        >
                          <Minus className="h-3.5 w-3.5" aria-hidden="true" />
                        </button>
                        <input
                          type="number"
                          min={0}
                          max={eq.maxScore}
                          step={0.5}
                          value={val}
                          onChange={(e) =>
                            handleEssayChange(
                              eq.id,
                              eq.maxScore,
                              parseFloat(e.target.value)
                            )
                          }
                          aria-label={`Skor ${eq.label}`}
                          className="w-16 h-9 rounded-lg border border-slate-300 text-center font-mono text-sm font-semibold tabular-nums text-slate-900 focus:border-[#1D4ED8] focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]/20"
                        />
                        <button
                          type="button"
                          onClick={() => handleEssayChange(eq.id, eq.maxScore, val + 1)}
                          aria-label={`Tambah skor ${eq.label}`}
                          className="h-9 w-9 inline-flex items-center justify-center rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 cursor-pointer"
                        >
                          <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleEssayChange(eq.id, eq.maxScore, eq.maxScore)}
                          className="ml-1 text-xs font-medium text-[#1D4ED8] hover:underline whitespace-nowrap cursor-pointer"
                        >
                          Penuh
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </section>

        {/* RIGHT ZONE: Live Score Breakdown & Student Queue (4 cols) */}
        <aside className="lg:col-span-4 space-y-6 lg:sticky lg:top-20">
          {/* Focal Score Panel */}
          <div className="bg-white border border-slate-200 rounded-xl p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-xs font-medium text-slate-500">
                  Nilai Akhir Terhitung
                </div>
                <div className="mt-1 flex items-baseline gap-2">
                  <span className="font-mono text-5xl font-semibold tracking-tight text-slate-900 tabular-nums">
                    {config.roundingMode === 'decimal1'
                      ? gradeResult.finalScore.toFixed(1)
                      : gradeResult.finalScore.toFixed(0)}
                  </span>
                  <span className="font-mono text-sm text-slate-400 tabular-nums">
                    / 100
                  </span>
                </div>
                <div className="mt-1.5 text-xs text-slate-600">
                  Predikat{' '}
                  <span className="font-mono font-bold text-slate-900">
                    {gradeResult.predicate}
                  </span>{' '}
                  · {gradeResult.predicateLabel}
                </div>
              </div>

              <div className="text-right">
                {gradeResult.passed ? (
                  <div className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#059669]">
                    <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
                    <span>Tuntas</span>
                  </div>
                ) : (
                  <div className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#DC2626]">
                    <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
                    <span>Remedial</span>
                  </div>
                )}
                <div className="mt-1 font-mono text-xs text-slate-500 tabular-nums">
                  KKM {config.kkm}
                </div>
              </div>
            </div>

            {/* Score Breakdown Rows */}
            <div className="mt-5 pt-5 border-t border-slate-200 space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-slate-600">
                  Pilihan Ganda ({config.includeEssay ? `${config.mcWeight}%` : '100%'})
                </span>
                <span className="font-mono font-semibold text-slate-900 tabular-nums">
                  {gradeResult.mcPercent.toFixed(1)}
                </span>
              </div>

              <div className="flex items-center justify-between text-xs text-slate-500 font-mono tabular-nums">
                <span className="text-[#059669]">Benar: {gradeResult.correctCount}</span>
                <span className="text-[#DC2626]">Salah: {gradeResult.wrongCount}</span>
                <span>Kosong: {gradeResult.blankCount}</span>
              </div>

              {(gradeResult.bonusCount > 0 || gradeResult.annulledCount > 0) && (
                <div className="text-xs text-slate-500 font-mono tabular-nums">
                  {gradeResult.bonusCount > 0 && `Bonus: ${gradeResult.bonusCount} soal`}
                  {gradeResult.bonusCount > 0 && gradeResult.annulledCount > 0 && ' · '}
                  {gradeResult.annulledCount > 0 &&
                    `Anulir: ${gradeResult.annulledCount} soal`}
                </div>
              )}

              {config.includeEssay && (
                <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                  <span className="text-slate-600">
                    Uraian ({100 - config.mcWeight}%)
                  </span>
                  <span className="font-mono font-semibold text-slate-900 tabular-nums">
                    {gradeResult.essayTotal}/{gradeResult.essayMax} (
                    {gradeResult.essayPercent.toFixed(1)})
                  </span>
                </div>
              )}

              {config.curveAdjustment > 0 && (
                <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
                  <span className="text-slate-600">
                    Katrol Nilai (+{config.curveAdjustment} poin)
                  </span>
                  <span className="font-mono text-slate-700 tabular-nums">
                    Asli {gradeResult.rawFinalScore.toFixed(1)} → {gradeResult.finalScore}
                  </span>
                </div>
              )}
            </div>

            {/* Teacher Notes */}
            <div className="mt-5 pt-5 border-t border-slate-200">
              <label
                htmlFor="teacher-notes"
                className="block text-xs font-medium text-slate-600 mb-1.5"
              >
                Catatan Koreksi (Opsional)
              </label>
              <textarea
                id="teacher-notes"
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Misal: Perlu latihan soal matriks invers..."
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-[#1D4ED8] focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]/20 resize-none"
              />
            </div>

            {/* Primary Save CTA */}
            <div className="mt-5 flex flex-col gap-2.5">
              <button
                type="button"
                onClick={() => handleSubmit(true)}
                className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-[#1D4ED8] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#1E40AF] transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1D4ED8] cursor-pointer"
              >
                <span>Simpan &amp; Lanjut Siswa Berikutnya</span>
                <ArrowRight className="h-4 w-4 shrink-0" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => handleSubmit(false)}
                className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
              >
                Simpan Perubahan Lembar Ini
              </button>
            </div>
          </div>

          {/* Student Queue Roster */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="flex items-center justify-between gap-2 px-5 py-3.5 border-b border-slate-200">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">
                  Daftar Lembar Siswa
                </h3>
                <p className="text-xs text-slate-500 font-mono tabular-nums">
                  {sheets.length - ungradedCount}/{sheets.length} terkoreksi
                </p>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <button
                  type="button"
                  onClick={onOpenImportExcel}
                  className="inline-flex items-center gap-1 text-xs font-medium text-slate-600 hover:text-slate-900 whitespace-nowrap cursor-pointer"
                >
                  <FileSpreadsheet className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Impor Excel</span>
                </button>
                <button
                  type="button"
                  onClick={onCreateNewSheet}
                  className="inline-flex items-center gap-1 text-xs font-medium text-[#1D4ED8] hover:underline whitespace-nowrap cursor-pointer"
                >
                  <UserPlus className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Tambah</span>
                </button>
              </div>
            </div>

            <div className="max-h-72 overflow-y-auto divide-y divide-slate-100">
              {sheets.map((stu) => {
                const isSelected = stu.id === activeSheetId;
                const isGraded = stu.gradedAt !== null;
                const res = isGraded ? gradeStudentSheet(stu, config) : null;

                return (
                  <button
                    key={stu.id}
                    type="button"
                    onClick={() => onSelectSheet(stu.id)}
                    className={`w-full flex items-center justify-between gap-3 px-5 py-2.5 text-left transition-colors cursor-pointer ${
                      isSelected ? 'bg-[#1D4ED8]/8' : 'hover:bg-slate-50'
                    }`}
                  >
                    <div className="min-w-0">
                      <div
                        className={`text-sm truncate ${
                          isSelected
                            ? 'font-semibold text-[#1D4ED8]'
                            : 'font-medium text-slate-800'
                        }`}
                      >
                        {stu.name}
                      </div>
                      <div className="text-xs font-mono text-slate-400 tabular-nums">
                        {stu.nis}
                        {config.enableMultiPackage && ` · Paket ${stu.packageCode || 'A'}`}
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      {res ? (
                        <>
                          <div className="font-mono text-sm font-semibold text-slate-900 tabular-nums">
                            {config.roundingMode === 'decimal1'
                              ? res.finalScore.toFixed(1)
                              : res.finalScore.toFixed(0)}
                          </div>
                          <div
                            className={`text-xs font-medium ${
                              res.passed ? 'text-[#059669]' : 'text-[#DC2626]'
                            }`}
                          >
                            {res.predicate} · {res.passed ? 'Tuntas' : 'Remedial'}
                          </div>
                        </>
                      ) : (
                        <span className="text-xs text-slate-400">Menunggu</span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
};
