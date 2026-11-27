import React, { useMemo, useState } from 'react';
import { Check, Copy, Plus, Trash2 } from 'lucide-react';
import {
  ExamConfig,
  OptionLetter,
  PackageCode,
  QuestionStatus,
  RoundingMode,
  StudentSheet,
} from '../types/grading';
import {
  PACKAGE_CODES,
  computeClassSummary,
  getAvailableOptions,
  getQuestionRule,
} from '../utils/scoring';

interface AnswerKeyConfigProps {
  config: ExamConfig;
  sheets: StudentSheet[];
  onUpdateConfig: (next: ExamConfig) => void;
}

const MC_COUNT_PRESETS = [10, 15, 20, 25, 30, 40, 50];

export const AnswerKeyConfig: React.FC<AnswerKeyConfigProps> = ({
  config,
  sheets,
  onUpdateConfig,
}) => {
  const [activePackage, setActivePackage] = useState<PackageCode>('A');
  const [quickKeyInput, setQuickKeyInput] = useState('');
  const [pasteNotice, setPasteNotice] = useState<string | null>(null);

  const options = useMemo(
    () => getAvailableOptions(config.optionCount),
    [config.optionCount]
  );

  const classSummary = useMemo(
    () => computeClassSummary(sheets, config),
    [sheets, config]
  );

  const effectivePackage: PackageCode = config.enableMultiPackage
    ? activePackage
    : 'A';

  const currentKeyMap =
    config.packageKeys?.[effectivePackage] ?? config.answerKey;

  const handleField = <K extends keyof ExamConfig>(
    key: K,
    value: ExamConfig[K]
  ) => {
    onUpdateConfig({ ...config, [key]: value });
  };

  const handleMcCountChange = (nextCount: number) => {
    const nextPackages = { ...config.packageKeys };
    PACKAGE_CODES.forEach((pkg) => {
      const map = { ...(nextPackages[pkg] ?? {}) };
      for (let i = 1; i <= nextCount; i++) {
        if (!map[i]) {
          map[i] = options[(i - 1) % options.length];
        }
      }
      nextPackages[pkg] = map;
    });
    onUpdateConfig({
      ...config,
      mcCount: nextCount,
      answerKey: nextPackages.A,
      packageKeys: nextPackages,
    });
  };

  const handleOptionCountChange = (nextOptCount: 4 | 5) => {
    const nextPackages = { ...config.packageKeys };
    if (nextOptCount === 4) {
      PACKAGE_CODES.forEach((pkg) => {
        const map = { ...(nextPackages[pkg] ?? {}) };
        for (let i = 1; i <= config.mcCount; i++) {
          if (map[i] === 'E') map[i] = 'D';
        }
        nextPackages[pkg] = map;
      });
    }
    onUpdateConfig({
      ...config,
      optionCount: nextOptCount,
      answerKey: nextPackages.A,
      packageKeys: nextPackages,
    });
  };

  const handleSetKey = (qNum: number, opt: OptionLetter) => {
    const updatedMap = {
      ...currentKeyMap,
      [qNum]: opt,
    };
    const nextPackages = {
      ...config.packageKeys,
      [effectivePackage]: updatedMap,
    };
    onUpdateConfig({
      ...config,
      answerKey: effectivePackage === 'A' ? updatedMap : config.answerKey,
      packageKeys: nextPackages,
    });
  };

  const handleCopyFromA = () => {
    const copied = { ...config.packageKeys.A };
    const nextPackages = {
      ...config.packageKeys,
      [effectivePackage]: copied,
    };
    onUpdateConfig({
      ...config,
      packageKeys: nextPackages,
    });
    setPasteNotice(`Kunci Paket ${effectivePackage} disalin dari Paket A.`);
  };

  const handleApplyQuickKey = () => {
    const validSet = new Set(options);
    const cleaned = quickKeyInput
      .toUpperCase()
      .split('')
      .filter((ch) => validSet.has(ch as OptionLetter));

    if (cleaned.length === 0) {
      setPasteNotice(
        'Tidak ditemukan huruf kunci yang valid (gunakan huruf A–E).'
      );
      return;
    }

    const updatedMap = { ...currentKeyMap };
    const limit = Math.min(cleaned.length, config.mcCount);
    for (let i = 0; i < limit; i++) {
      updatedMap[i + 1] = cleaned[i] as OptionLetter;
    }

    const nextPackages = {
      ...config.packageKeys,
      [effectivePackage]: updatedMap,
    };

    onUpdateConfig({
      ...config,
      answerKey: effectivePackage === 'A' ? updatedMap : config.answerKey,
      packageKeys: nextPackages,
    });
    setPasteNotice(
      `Kunci Paket ${effectivePackage} nomor 1 sampai ${limit} berhasil diperbarui.`
    );
    setQuickKeyInput('');
  };

  const handleUpdateQuestionRule = (
    qNum: number,
    patch: Partial<{ weight: 1 | 2 | 3; status: QuestionStatus }>
  ) => {
    const existing = getQuestionRule(config, qNum);
    onUpdateConfig({
      ...config,
      questionRules: {
        ...config.questionRules,
        [qNum]: { ...existing, ...patch },
      },
    });
  };

  const handleAddEssay = () => {
    const nextIdx = config.essays.length + 1;
    onUpdateConfig({
      ...config,
      essays: [
        ...config.essays,
        {
          id: `essay-${Date.now()}`,
          label: `Uraian ${nextIdx}`,
          topic: 'Indikator penilaian uraian',
          maxScore: 10,
        },
      ],
    });
  };

  const handleUpdateEssay = (
    id: string,
    patch: Partial<{ label: string; topic: string; maxScore: number }>
  ) => {
    onUpdateConfig({
      ...config,
      essays: config.essays.map((eq) =>
        eq.id === id ? { ...eq, ...patch } : eq
      ),
    });
  };

  const handleRemoveEssay = (id: string) => {
    onUpdateConfig({
      ...config,
      essays: config.essays.filter((eq) => eq.id !== id),
    });
  };

  const totalEssayMax = config.essays.reduce((sum, e) => sum + e.maxScore, 0);

  return (
    <div className="space-y-8">
      <div className="border-b border-slate-200 pb-5">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Kunci Jawaban &amp; Kalibrasi Penilaian
        </h1>
        <p className="mt-1.5 text-sm text-slate-500">
          Atur struktur ujian, multi-paket soal, bobot HOTS/bonus/anulir per nomor, serta pembulatan dan katrol nilai secara instan.
        </p>
      </div>

      {/* Section 1: Exam Identity, Scoring Rules & Calibration */}
      <section className="bg-white border border-slate-200 rounded-xl p-6">
        <h2 className="text-base font-semibold text-slate-900 mb-5">
          01. Identitas Ujian, Skema Skor &amp; Kalibrasi Nilai
        </h2>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <div className="sm:col-span-2">
            <label
              htmlFor="cfg-title"
              className="block text-xs font-medium text-slate-600 mb-1.5"
            >
              Judul Evaluasi
            </label>
            <input
              id="cfg-title"
              type="text"
              value={config.title}
              onChange={(e) => handleField('title', e.target.value)}
              className="w-full h-10 rounded-lg border border-slate-300 px-3 text-sm text-slate-900 focus:border-[#1D4ED8] focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]/20"
            />
          </div>

          <div>
            <label
              htmlFor="cfg-subject"
              className="block text-xs font-medium text-slate-600 mb-1.5"
            >
              Mata Pelajaran
            </label>
            <input
              id="cfg-subject"
              type="text"
              value={config.subject}
              onChange={(e) => handleField('subject', e.target.value)}
              className="w-full h-10 rounded-lg border border-slate-300 px-3 text-sm text-slate-900 focus:border-[#1D4ED8] focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]/20"
            />
          </div>

          <div>
            <label
              htmlFor="cfg-class"
              className="block text-xs font-medium text-slate-600 mb-1.5"
            >
              Kelas / Rombel Utama
            </label>
            <input
              id="cfg-class"
              type="text"
              value={config.className}
              onChange={(e) => handleField('className', e.target.value)}
              className="w-full h-10 rounded-lg border border-slate-300 px-3 text-sm text-slate-900 focus:border-[#1D4ED8] focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]/20"
            />
          </div>
        </div>

        <div className="mt-6 pt-6 border-t border-slate-200 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label
              htmlFor="cfg-mccount"
              className="block text-xs font-medium text-slate-600 mb-1.5"
            >
              Jumlah Soal Pilihan Ganda
            </label>
            <select
              id="cfg-mccount"
              value={config.mcCount}
              onChange={(e) => handleMcCountChange(Number(e.target.value))}
              className="w-full h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm font-mono tabular-nums text-slate-900 focus:border-[#1D4ED8] focus:outline-none"
            >
              {MC_COUNT_PRESETS.map((n) => (
                <option key={n} value={n}>
                  {n} Soal PG
                </option>
              ))}
            </select>
          </div>

          <div>
            <span className="block text-xs font-medium text-slate-600 mb-1.5">
              Jumlah Opsi Jawaban
            </span>
            <div className="inline-flex w-full rounded-lg bg-slate-100 p-1">
              <button
                type="button"
                onClick={() => handleOptionCountChange(4)}
                className={`flex-1 rounded-md py-1.5 text-xs font-medium transition-colors cursor-pointer ${
                  config.optionCount === 4
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                A – D (4 Opsi)
              </button>
              <button
                type="button"
                onClick={() => handleOptionCountChange(5)}
                className={`flex-1 rounded-md py-1.5 text-xs font-medium transition-colors cursor-pointer ${
                  config.optionCount === 5
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                A – E (5 Opsi)
              </button>
            </div>
          </div>

          <div>
            <span className="block text-xs font-medium text-slate-600 mb-1.5">
              Skema Penilaian PG
            </span>
            <div className="inline-flex w-full rounded-lg bg-slate-100 p-1">
              <button
                type="button"
                onClick={() => handleField('scoringMode', 'standard')}
                className={`flex-1 rounded-md py-1.5 text-xs font-medium transition-colors cursor-pointer ${
                  config.scoringMode === 'standard'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Standar (+1 / 0)
              </button>
              <button
                type="button"
                onClick={() => handleField('scoringMode', 'penalty')}
                className={`flex-1 rounded-md py-1.5 text-xs font-medium transition-colors cursor-pointer ${
                  config.scoringMode === 'penalty'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Minus (+4 / -1)
              </button>
            </div>
          </div>

          <div>
            <label
              htmlFor="cfg-kkm"
              className="block text-xs font-medium text-slate-600 mb-1.5"
            >
              Batas Ketuntasan (KKM)
            </label>
            <input
              id="cfg-kkm"
              type="number"
              min={0}
              max={100}
              value={config.kkm}
              onChange={(e) =>
                handleField(
                  'kkm',
                  Math.max(0, Math.min(100, Number(e.target.value) || 0))
                )
              }
              className="w-full h-10 rounded-lg border border-slate-300 px-3 text-sm font-mono tabular-nums text-slate-900 focus:border-[#1D4ED8] focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]/20"
            />
          </div>
        </div>

        {/* Professional Calibration: Rounding, Curve Adjustment (Katrol), Multi-Package */}
        <div className="mt-6 pt-6 border-t border-slate-200 grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div>
            <span className="block text-xs font-medium text-slate-600 mb-1.5">
              Pembulatan Nilai Akhir
            </span>
            <div className="inline-flex w-full rounded-lg bg-slate-100 p-1">
              {(
                [
                  { id: 'decimal1', label: '1 Desimal' },
                  { id: 'round', label: 'Bulat' },
                  { id: 'ceil', label: 'Ke Atas' },
                ] as { id: RoundingMode; label: string }[]
              ).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => handleField('roundingMode', opt.id)}
                  className={`flex-1 rounded-md py-1.5 text-xs font-medium transition-colors cursor-pointer ${
                    config.roundingMode === opt.id
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between text-xs mb-1.5">
              <label htmlFor="cfg-curve" className="font-medium text-slate-600">
                Penyesuaian / Katrol Nilai Kelas
              </label>
              <span className="font-mono font-semibold text-[#1D4ED8] tabular-nums">
                +{config.curveAdjustment} poin
              </span>
            </div>
            <input
              id="cfg-curve"
              type="range"
              min={0}
              max={15}
              step={1}
              value={config.curveAdjustment}
              onChange={(e) =>
                handleField('curveAdjustment', Number(e.target.value))
              }
              className="w-full accent-[#1D4ED8]"
            />
            <div className="mt-1 text-[11px] text-slate-500 font-mono tabular-nums">
              Dampak saat ini: {classSummary.passRate}% tuntas ({classSummary.passedCount}/
              {classSummary.gradedCount} siswa terkoreksi)
            </div>
          </div>

          <div className="flex flex-col justify-center gap-3">
            <label className="inline-flex items-center gap-2.5 text-sm font-medium text-slate-800 cursor-pointer">
              <input
                type="checkbox"
                checked={config.enableMultiPackage}
                onChange={(e) =>
                  handleField('enableMultiPackage', e.target.checked)
                }
                className="h-4 w-4 rounded border-slate-300 text-[#1D4ED8] focus:ring-[#1D4ED8]"
              />
              <span>Aktifkan Multi-Paket Soal (Paket A / B / C)</span>
            </label>
            <p className="text-xs text-slate-500">
              Cocok untuk ujian dengan acakan nomor soal berbeda tiap paket.
            </p>
          </div>
        </div>

        {/* Essay Weight Toggle */}
        <div className="mt-6 pt-6 border-t border-slate-200 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <label className="inline-flex items-center gap-2.5 text-sm font-medium text-slate-800 cursor-pointer">
            <input
              type="checkbox"
              checked={config.includeEssay}
              onChange={(e) => handleField('includeEssay', e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-[#1D4ED8] focus:ring-[#1D4ED8]"
            />
            <span>Sertakan bagian soal uraian / esai manual</span>
          </label>

          {config.includeEssay && (
            <div className="flex items-center gap-4 min-w-[280px]">
              <span className="text-xs font-mono text-slate-600 tabular-nums whitespace-nowrap">
                PG {config.mcWeight}%
              </span>
              <input
                type="range"
                min={20}
                max={90}
                step={5}
                value={config.mcWeight}
                onChange={(e) => handleField('mcWeight', Number(e.target.value))}
                aria-label="Bobot Pilihan Ganda dibanding Uraian"
                className="flex-1 accent-[#1D4ED8]"
              />
              <span className="text-xs font-mono text-slate-600 tabular-nums whitespace-nowrap">
                Uraian {100 - config.mcWeight}%
              </span>
            </div>
          )}
        </div>
      </section>

      {/* Section 2: Interactive Answer Key Grid + Per-Question Weight / Bonus / Annul */}
      <section className="bg-white border border-slate-200 rounded-xl p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between mb-5">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              02. Kunci Jawaban &amp; Aturan Per-Butir Soal
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Tetapkan huruf kunci, bobot HOTS (1x–3x), atau tandai soal Bonus / Anulir jika terdapat kesalahan cetak pada naskah soal.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <input
              type="text"
              value={quickKeyInput}
              onChange={(e) => setQuickKeyInput(e.target.value)}
              placeholder={`Tempel kunci Paket ${effectivePackage}: BCDAEB...`}
              className="h-10 sm:w-64 rounded-lg border border-slate-300 px-3 text-xs font-mono uppercase tracking-wider text-slate-900 placeholder:normal-case placeholder:tracking-normal placeholder:text-slate-400 focus:border-[#1D4ED8] focus:outline-none"
            />
            <button
              type="button"
              onClick={handleApplyQuickKey}
              className="inline-flex items-center justify-center gap-1.5 h-10 rounded-lg bg-slate-900 px-4 text-xs font-medium text-white hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Check className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Terapkan String</span>
            </button>
          </div>
        </div>

        {/* Multi-package selector tabs */}
        {config.enableMultiPackage && (
          <div className="flex flex-wrap items-center justify-between gap-3 mb-5 pb-4 border-b border-slate-200">
            <div className="inline-flex items-center rounded-lg bg-slate-100 p-1">
              {PACKAGE_CODES.map((pkg) => (
                <button
                  key={pkg}
                  type="button"
                  onClick={() => {
                    setActivePackage(pkg);
                    setPasteNotice(null);
                  }}
                  className={`rounded-md px-4 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                    activePackage === pkg
                      ? 'bg-white text-[#1D4ED8] shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Kunci Paket {pkg}
                </button>
              ))}
            </div>

            {activePackage !== 'A' && (
              <button
                type="button"
                onClick={handleCopyFromA}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-[#1D4ED8] hover:underline cursor-pointer"
              >
                <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Salin Kunci dari Paket A</span>
              </button>
            )}
          </div>
        )}

        {pasteNotice && (
          <p className="mb-4 text-xs font-medium text-[#1D4ED8]">{pasteNotice}</p>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-8 gap-y-1 border-t border-slate-200 pt-4">
          {Array.from({ length: config.mcCount }, (_, idx) => {
            const qNum = idx + 1;
            const currentKey = currentKeyMap[qNum] ?? 'A';
            const rule = getQuestionRule(config, qNum);
            return (
              <div
                key={qNum}
                className={`flex flex-wrap items-center justify-between gap-2 py-2 border-b border-slate-100 ${
                  rule.status === 'annulled' ? 'opacity-60' : ''
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <span className="font-mono text-xs font-semibold text-slate-500 tabular-nums w-7">
                    {String(qNum).padStart(2, '0')}.
                  </span>
                  <div className="flex items-center gap-1">
                    {options.map((opt) => {
                      const active = currentKey === opt;
                      return (
                        <button
                          key={opt}
                          type="button"
                          onClick={() => handleSetKey(qNum, opt)}
                          className={`h-8 w-8 rounded-full border text-xs font-mono font-semibold transition-colors cursor-pointer ${
                            active
                              ? 'border-[#1D4ED8] bg-[#1D4ED8] text-white'
                              : 'border-slate-200 bg-white text-slate-600 hover:border-slate-400'
                          }`}
                        >
                          {opt}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Per-question Weight & Status */}
                <div className="flex items-center gap-2">
                  <select
                    aria-label={`Bobot soal nomor ${qNum}`}
                    value={rule.weight}
                    onChange={(e) =>
                      handleUpdateQuestionRule(qNum, {
                        weight: Number(e.target.value) as 1 | 2 | 3,
                      })
                    }
                    className="h-8 rounded-md border border-slate-200 bg-white px-2 font-mono text-xs text-slate-700 focus:border-[#1D4ED8] focus:outline-none"
                  >
                    <option value={1}>1x</option>
                    <option value={2}>2x (HOTS)</option>
                    <option value={3}>3x (HOTS)</option>
                  </select>

                  <select
                    aria-label={`Status soal nomor ${qNum}`}
                    value={rule.status}
                    onChange={(e) =>
                      handleUpdateQuestionRule(qNum, {
                        status: e.target.value as QuestionStatus,
                      })
                    }
                    className={`h-8 rounded-md border px-2 text-xs font-medium focus:border-[#1D4ED8] focus:outline-none ${
                      rule.status === 'bonus'
                        ? 'border-emerald-300 bg-emerald-50 text-[#059669]'
                        : rule.status === 'annulled'
                        ? 'border-red-200 bg-red-50 text-[#DC2626]'
                        : 'border-slate-200 bg-white text-slate-600'
                    }`}
                  >
                    <option value="normal">Normal</option>
                    <option value="bonus">Bonus</option>
                    <option value="annulled">Anulir</option>
                  </select>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Section 3: Essay Rubric Configuration */}
      {config.includeEssay && (
        <section className="bg-white border border-slate-200 rounded-xl p-6">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                03. Daftar Soal &amp; Skor Maksimal Uraian
              </h2>
              <p className="text-xs text-slate-500 mt-0.5 font-mono tabular-nums">
                Total skor maksimal uraian: {totalEssayMax} poin
              </p>
            </div>
            <button
              type="button"
              onClick={handleAddEssay}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-medium text-slate-800 hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Tambah Soal Uraian</span>
            </button>
          </div>

          <div className="divide-y divide-slate-200 border border-slate-200 rounded-lg overflow-hidden">
            {config.essays.map((eq) => (
              <div
                key={eq.id}
                className="grid grid-cols-1 gap-3 sm:grid-cols-12 items-center px-4 py-3.5 bg-white"
              >
                <div className="sm:col-span-3">
                  <input
                    type="text"
                    value={eq.label}
                    onChange={(e) =>
                      handleUpdateEssay(eq.id, { label: e.target.value })
                    }
                    aria-label="Label soal uraian"
                    className="w-full h-9 rounded-lg border border-slate-300 px-3 text-sm font-medium text-slate-900 focus:border-[#1D4ED8] focus:outline-none"
                  />
                </div>
                <div className="sm:col-span-6">
                  <input
                    type="text"
                    value={eq.topic}
                    onChange={(e) =>
                      handleUpdateEssay(eq.id, { topic: e.target.value })
                    }
                    aria-label="Topik atau rubrik soal uraian"
                    className="w-full h-9 rounded-lg border border-slate-300 px-3 text-sm text-slate-700 focus:border-[#1D4ED8] focus:outline-none"
                  />
                </div>
                <div className="sm:col-span-2 flex items-center gap-2">
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={eq.maxScore}
                    onChange={(e) =>
                      handleUpdateEssay(eq.id, {
                        maxScore: Math.max(1, Number(e.target.value) || 1),
                      })
                    }
                    aria-label="Skor maksimal uraian"
                    className="w-full h-9 rounded-lg border border-slate-300 px-2.5 text-center font-mono text-sm tabular-nums text-slate-900 focus:border-[#1D4ED8] focus:outline-none"
                  />
                  <span className="text-xs text-slate-500 shrink-0">poin</span>
                </div>
                <div className="sm:col-span-1 text-right">
                  <button
                    type="button"
                    onClick={() => handleRemoveEssay(eq.id)}
                    disabled={config.essays.length <= 1}
                    aria-label={`Hapus ${eq.label}`}
                    className="h-9 w-9 inline-flex items-center justify-center rounded-lg text-slate-400 hover:text-[#DC2626] hover:bg-red-50 disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
};
