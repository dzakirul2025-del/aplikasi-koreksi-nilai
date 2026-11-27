import React, { useMemo, useState } from 'react';
import { BarChart3, FileSpreadsheet, Printer } from 'lucide-react';
import { ExamConfig, PackageCode, StudentSheet } from '../types/grading';
import {
  PACKAGE_CODES,
  computeItemAnalysis,
  getAvailableOptions,
} from '../utils/scoring';

interface ItemAnalysisAndPrintProps {
  config: ExamConfig;
  sheets: StudentSheet[];
}

export const ItemAnalysisAndPrint: React.FC<ItemAnalysisAndPrintProps> = ({
  config,
  sheets,
}) => {
  const [subView, setSubView] = useState<'analysis' | 'print'>('analysis');
  const [packageFilter, setPackageFilter] = useState<PackageCode | 'ALL'>('ALL');

  const options = useMemo(
    () => getAvailableOptions(config.optionCount),
    [config.optionCount]
  );

  const effectiveFilter = config.enableMultiPackage ? packageFilter : 'ALL';

  const analysisRows = useMemo(
    () => computeItemAnalysis(sheets, config, effectiveFilter),
    [sheets, config, effectiveFilter]
  );

  const gradedCount = useMemo(
    () =>
      sheets.filter((s) => {
        if (s.gradedAt === null) return false;
        if (effectiveFilter !== 'ALL') {
          return (s.packageCode || 'A') === effectiveFilter;
        }
        return true;
      }).length,
    [sheets, effectiveFilter]
  );

  const summaryInsights = useMemo(() => {
    if (gradedCount === 0 || analysisRows.length === 0) return null;
    const activeNormal = analysisRows.filter(
      (r) => r.questionStatus === 'normal'
    );
    const pool = activeNormal.length > 0 ? activeNormal : analysisRows;
    const sorted = [...pool].sort(
      (a, b) => a.accuracyPercent - b.accuracyPercent
    );
    const hardest = sorted[0];
    const easiest = sorted[sorted.length - 1];
    const revisionCount = pool.filter(
      (r) => r.discriminationLabel === 'Revisi'
    ).length;
    return { hardest, easiest, revisionCount };
  }, [analysisRows, gradedCount]);

  // Layout columns for printable LJK paper
  const ljkCols = config.mcCount > 30 ? 3 : 2;
  const rowsPerCol = Math.ceil(config.mcCount / ljkCols);
  const printColumns = Array.from({ length: ljkCols }, (_, colIdx) => {
    const start = colIdx * rowsPerCol + 1;
    const end = Math.min(config.mcCount, (colIdx + 1) * rowsPerCol);
    const nums: number[] = [];
    for (let n = start; n <= end; n++) nums.push(n);
    return nums;
  });

  return (
    <div className="space-y-6">
      {/* Header & Sub-view switcher */}
      <div className="no-print flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Analisis Butir Psikometrik &amp; Cetak LJK
          </h1>
          <p className="mt-1.5 text-sm text-slate-500">
            Pantau tingkat kesukaran, indeks daya beda (D), dan efektivitas pengecoh tiap butir soal atau cetak blangko LJK A4.
          </p>
        </div>

        <div
          className="inline-flex items-center rounded-lg bg-slate-100 p-1 self-start sm:self-auto"
          role="tablist"
          aria-label="Pilih tampilan analisis atau cetak LJK"
        >
          <button
            type="button"
            role="tab"
            aria-selected={subView === 'analysis'}
            onClick={() => setSubView('analysis')}
            className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              subView === 'analysis'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <BarChart3 className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Analisis Butir Soal</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={subView === 'print'}
            onClick={() => setSubView('print')}
            className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              subView === 'print'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <FileSpreadsheet className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Pratinjau Cetak LJK</span>
          </button>
        </div>
      </div>

      {subView === 'analysis' ? (
        <div className="space-y-6">
          {config.enableMultiPackage && (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs text-slate-500">
                Filter sampel berdasarkan Paket Soal:
              </span>
              <div className="inline-flex items-center rounded-lg bg-slate-100 p-1">
                {(['ALL', ...PACKAGE_CODES] as (PackageCode | 'ALL')[]).map(
                  (pkg) => (
                    <button
                      key={pkg}
                      type="button"
                      onClick={() => setPackageFilter(pkg)}
                      className={`rounded-md px-3 py-1 text-xs font-medium transition-colors cursor-pointer ${
                        packageFilter === pkg
                          ? 'bg-white text-slate-900 shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {pkg === 'ALL' ? 'Semua Paket' : `Paket ${pkg}`}
                    </button>
                  )
                )}
              </div>
            </div>
          )}

          {summaryInsights && (
            <div className="bg-white border border-slate-200 rounded-xl grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-slate-200">
              <div className="p-5">
                <div className="text-xs font-medium text-slate-500">
                  Soal Tersulit (Perlu Pembahasan)
                </div>
                <div className="mt-1.5 flex items-baseline gap-2">
                  <span className="font-mono text-2xl font-semibold text-[#DC2626] tabular-nums">
                    No.{' '}
                    {String(summaryInsights.hardest.questionNumber).padStart(
                      2,
                      '0'
                    )}
                  </span>
                  <span className="font-mono text-xs text-slate-500 tabular-nums">
                    ({summaryInsights.hardest.accuracyPercent}% benar · Kunci{' '}
                    {summaryInsights.hardest.keyAnswer})
                  </span>
                </div>
              </div>

              <div className="p-5">
                <div className="text-xs font-medium text-slate-500">
                  Soal Termudah
                </div>
                <div className="mt-1.5 flex items-baseline gap-2">
                  <span className="font-mono text-2xl font-semibold text-[#059669] tabular-nums">
                    No.{' '}
                    {String(summaryInsights.easiest.questionNumber).padStart(
                      2,
                      '0'
                    )}
                  </span>
                  <span className="font-mono text-xs text-slate-500 tabular-nums">
                    ({summaryInsights.easiest.accuracyPercent}% benar · Kunci{' '}
                    {summaryInsights.easiest.keyAnswer})
                  </span>
                </div>
              </div>

              <div className="p-5">
                <div className="text-xs font-medium text-slate-500">
                  Kualitas Daya Beda (Indeks D)
                </div>
                <div className="mt-1.5 flex items-baseline gap-2">
                  <span className="font-mono text-2xl font-semibold text-slate-900 tabular-nums">
                    {summaryInsights.revisionCount} soal
                  </span>
                  <span className="font-mono text-xs text-slate-500 tabular-nums">
                    perlu ditinjau · sampel {gradedCount} siswa
                  </span>
                </div>
              </div>
            </div>
          )}

          <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            {gradedCount === 0 ? (
              <div className="p-12 text-center">
                <p className="text-sm font-medium text-slate-800">
                  Belum ada lembar jawaban terkoreksi untuk filter ini.
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Koreksi minimal dua lembar siswa di tab Koreksi Manual untuk menghitung tingkat kesukaran dan indeks daya beda butir soal.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-medium text-slate-500">
                      <th className="py-3 pl-5 pr-2 w-16 font-mono">No</th>
                      <th className="py-3 px-2 w-16 text-center font-mono">
                        Kunci
                      </th>
                      <th className="py-3 px-2 w-24">Aturan</th>
                      <th className="py-3 px-3 min-w-[180px]">
                        Persentase Benar
                      </th>
                      {options.map((opt) => (
                        <th
                          key={opt}
                          className="py-3 px-2 text-right font-mono w-10"
                        >
                          {opt}
                        </th>
                      ))}
                      <th className="py-3 px-2 text-right font-mono w-12">
                        Ksg
                      </th>
                      <th className="py-3 px-3 text-right">Kesukaran</th>
                      <th className="py-3 pl-3 pr-5 text-right">
                        Daya Beda (D)
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm">
                    {analysisRows.map((row) => {
                      const barColor =
                        row.difficulty === 'Mudah'
                          ? 'bg-[#059669]'
                          : row.difficulty === 'Sedang'
                          ? 'bg-[#1D4ED8]'
                          : 'bg-[#DC2626]';
                      const diffColor =
                        row.difficulty === 'Mudah'
                          ? 'text-[#059669]'
                          : row.difficulty === 'Sedang'
                          ? 'text-slate-700'
                          : 'text-[#DC2626]';
                      const discColor =
                        row.discriminationLabel === 'Sangat Baik' ||
                        row.discriminationLabel === 'Baik'
                          ? 'text-[#059669]'
                          : row.discriminationLabel === 'Cukup'
                          ? 'text-slate-700'
                          : 'text-[#DC2626]';

                      return (
                        <tr
                          key={row.questionNumber}
                          className={`hover:bg-slate-50/70 ${
                            row.questionStatus === 'annulled' ? 'opacity-55' : ''
                          }`}
                        >
                          <td className="py-2.5 pl-5 pr-2 font-mono text-xs font-semibold text-slate-600 tabular-nums">
                            {String(row.questionNumber).padStart(2, '0')}
                          </td>
                          <td className="py-2.5 px-2 text-center font-mono text-xs font-bold text-[#1D4ED8]">
                            {row.keyAnswer}
                          </td>
                          <td className="py-2.5 px-2 font-mono text-xs text-slate-500 whitespace-nowrap">
                            {row.questionStatus === 'bonus'
                              ? 'Bonus'
                              : row.questionStatus === 'annulled'
                              ? 'Anulir'
                              : row.questionWeight > 1
                              ? `HOTS ${row.questionWeight}x`
                              : '1x'}
                          </td>
                          <td className="py-2.5 px-3">
                            <div className="flex items-center gap-3">
                              <div className="h-2 flex-1 rounded-full bg-slate-100 overflow-hidden">
                                <div
                                  className={`h-full rounded-full ${barColor}`}
                                  style={{ width: `${row.accuracyPercent}%` }}
                                />
                              </div>
                              <span className="w-10 text-right font-mono text-xs font-semibold text-slate-800 tabular-nums">
                                {row.accuracyPercent}%
                              </span>
                            </div>
                          </td>
                          {options.map((opt) => {
                            const count = row.distribution[opt] ?? 0;
                            const isKey = opt === row.keyAnswer;
                            return (
                              <td
                                key={opt}
                                className={`py-2.5 px-2 text-right font-mono text-xs tabular-nums ${
                                  isKey
                                    ? 'font-bold text-slate-900 bg-slate-50/80'
                                    : count > 0
                                    ? 'text-slate-600'
                                    : 'text-slate-300'
                                }`}
                              >
                                {count}
                              </td>
                            );
                          })}
                          <td className="py-2.5 px-2 text-right font-mono text-xs text-slate-400 tabular-nums">
                            {row.blankCount}
                          </td>
                          <td
                            className={`py-2.5 px-3 text-right text-xs font-semibold whitespace-nowrap ${diffColor}`}
                          >
                            {row.difficulty}
                          </td>
                          <td className="py-2.5 pl-3 pr-5 text-right whitespace-nowrap">
                            {row.questionStatus !== 'normal' ? (
                              <span className="font-mono text-xs text-slate-400">
                                —
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 text-xs">
                                <span className="font-mono text-slate-500 tabular-nums">
                                  {row.discriminationIndex.toFixed(2)}
                                </span>
                                <span className={`font-semibold ${discColor}`}>
                                  {row.discriminationLabel}
                                </span>
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      ) : (
        /* Printable Manual LJK Sheet Preview */
        <div className="space-y-4">
          <div className="no-print flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-slate-500">
              Format lembar otomatis menyesuaikan jumlah soal PG ({config.mcCount}{' '}
              soal, opsi {config.optionCount === 4 ? 'A–D' : 'A–E'})
              {config.enableMultiPackage ? ', pilihan Kode Paket A/B/C,' : ''} dan
              kotak uraian.
            </p>
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-2 rounded-lg bg-[#1D4ED8] px-4 py-2 text-xs font-semibold text-white hover:bg-[#1E40AF] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Printer className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Cetak Lembar Jawaban (A4)</span>
            </button>
          </div>

          <article className="print-only-sheet mx-auto max-w-[820px] bg-white border border-slate-300 rounded-xl p-8 sm:p-10 text-slate-900">
            {/* Official Paper Header */}
            <div className="flex items-start justify-between gap-4 border-b-2 border-slate-900 pb-4">
              <div>
                <div className="text-xs font-semibold tracking-wide text-slate-600">
                  LEMBAR JAWABAN MANUAL
                </div>
                <h2 className="text-xl font-bold text-slate-900 mt-0.5">
                  {config.title}
                </h2>
                <div className="mt-1 text-xs text-slate-600">
                  {config.subject} · Kelas {config.className} · Tanggal{' '}
                  {config.examDate}
                </div>
              </div>

              <div className="border border-slate-900 px-4 py-2 text-center min-w-[110px]">
                <div className="text-[11px] font-medium text-slate-600">
                  Nilai Akhir
                </div>
                <div className="h-9" />
              </div>
            </div>

            {/* Student Identity Lines */}
            <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs border border-slate-300 p-4">
              <div className="space-y-3">
                <div className="flex items-end gap-2">
                  <span className="w-24 font-medium shrink-0">Nama Siswa</span>
                  <span className="flex-1 border-b border-dotted border-slate-500 h-4" />
                </div>
                <div className="flex items-end gap-2">
                  <span className="w-24 font-medium shrink-0">NIS / Absen</span>
                  <span className="flex-1 border-b border-dotted border-slate-500 h-4" />
                </div>
              </div>
              <div className="space-y-3">
                <div className="flex items-end gap-2">
                  <span className="w-24 font-medium shrink-0">Kelas</span>
                  <span className="flex-1 border-b border-dotted border-slate-500 h-4 text-slate-700">
                    {config.className}
                  </span>
                </div>
                {config.enableMultiPackage ? (
                  <div className="flex items-center gap-2">
                    <span className="w-24 font-medium shrink-0">Kode Paket</span>
                    <div className="flex items-center gap-2">
                      {PACKAGE_CODES.map((pkg) => (
                        <span
                          key={pkg}
                          className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-slate-800 font-mono text-[11px] font-bold"
                        >
                          {pkg}
                        </span>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="flex items-end gap-2">
                    <span className="w-24 font-medium shrink-0">
                      Tanda Tangan
                    </span>
                    <span className="flex-1 border-b border-dotted border-slate-500 h-4" />
                  </div>
                )}
              </div>
            </div>

            <p className="mt-4 text-[11px] text-slate-600">
              Petunjuk: Beri tanda silang (X) atau hitamkan penuh pada salah satu huruf jawaban yang paling benar. Bila ingin mengganti jawaban, coret dua garis mendatar (=) pada pilihan sebelumnya.
            </p>

            {/* Bubble Grid */}
            <div className="mt-5">
              <div className="text-xs font-bold text-slate-900 mb-2.5">
                BAGIAN A. PILIHAN GANDA ({config.mcCount} SOAL)
              </div>
              <div
                className={`grid gap-6 ${
                  ljkCols === 3
                    ? 'grid-cols-1 sm:grid-cols-3'
                    : 'grid-cols-1 sm:grid-cols-2'
                }`}
              >
                {printColumns.map((colNums, idx) => (
                  <div
                    key={idx}
                    className="space-y-2 border border-slate-300 p-3"
                  >
                    {colNums.map((qNum) => (
                      <div
                        key={qNum}
                        className="flex items-center justify-between gap-2"
                      >
                        <span className="font-mono text-xs font-semibold w-6 text-right tabular-nums">
                          {String(qNum).padStart(2, '0')}.
                        </span>
                        <div className="flex items-center gap-2">
                          {options.map((opt) => (
                            <span
                              key={opt}
                              className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-slate-700 font-mono text-[11px] font-medium"
                            >
                              {opt}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>

            {/* Essay Box */}
            {config.includeEssay && config.essays.length > 0 && (
              <div className="mt-6">
                <div className="text-xs font-bold text-slate-900 mb-2.5">
                  BAGIAN B. PENILAIAN URAIAN (DIISI GURU PENGOREKSI)
                </div>
                <table className="w-full border-collapse border border-slate-400 text-xs">
                  <thead>
                    <tr className="bg-slate-100">
                      <th className="border border-slate-400 py-1.5 px-3 text-left w-28">
                        Nomor
                      </th>
                      <th className="border border-slate-400 py-1.5 px-3 text-left">
                        Aspek / Indikator Penilaian
                      </th>
                      <th className="border border-slate-400 py-1.5 px-3 text-center w-20">
                        Maks
                      </th>
                      <th className="border border-slate-400 py-1.5 px-3 text-center w-24">
                        Skor
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {config.essays.map((eq) => (
                      <tr key={eq.id}>
                        <td className="border border-slate-400 py-2 px-3 font-medium">
                          {eq.label}
                        </td>
                        <td className="border border-slate-400 py-2 px-3 text-slate-700">
                          {eq.topic}
                        </td>
                        <td className="border border-slate-400 py-2 px-3 text-center font-mono tabular-nums">
                          {eq.maxScore}
                        </td>
                        <td className="border border-slate-400 py-2 px-3" />
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </article>
        </div>
      )}
    </div>
  );
};
