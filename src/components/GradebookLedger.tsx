import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowDown,
  CheckCircle2,
  Clock,
  Download,
  FileSpreadsheet,
  Layers,
  PencilLine,
  Search,
  TableProperties,
  Trash2,
  Upload,
  UserPlus,
} from 'lucide-react';
import {
  ExamConfig,
  MultiSubjectStore,
  StudentSheet,
  SubjectId,
} from '../types/grading';
import {
  downloadStudentTemplateXlsx,
  exportFullReportXlsx,
  exportLegerAllSubjectsXlsx,
} from '../utils/excel';
import {
  SUBJECT_LIST,
  computeAllSubjectsLeger,
  computeClassSummary,
  computeStudentRanks,
  exportGradesToCsv,
  exportLegerToCsv,
  getSubjectMeta,
  gradeStudentSheet,
} from '../utils/scoring';

interface GradebookLedgerProps {
  activeSubjectId: SubjectId;
  store: MultiSubjectStore;
  config: ExamConfig;
  sheets: StudentSheet[];
  onSelectSubject: (id: SubjectId) => void;
  onEditStudent: (id: string, subjectId?: SubjectId) => void;
  onEditStudentProfile: (id: string) => void;
  onDeleteStudent: (id: string) => void;
  onAddNewStudent: () => void;
  onOpenImportExcel: () => void;
}

type LedgerScope = 'all-subjects' | 'single-subject';
type SingleStatusFilter = 'all' | 'passed' | 'remedial' | 'pending';
type LegerStatusFilter = 'all' | 'tuntas-semua' | 'remedial' | 'belum-lengkap';
type SortOption = 'score-desc' | 'score-asc' | 'name-asc' | 'nis-asc';

export const GradebookLedger: React.FC<GradebookLedgerProps> = ({
  activeSubjectId,
  store,
  config,
  sheets,
  onSelectSubject,
  onEditStudent,
  onEditStudentProfile,
  onDeleteStudent,
  onAddNewStudent,
  onOpenImportExcel,
}) => {
  const [scope, setScope] = useState<LedgerScope>('all-subjects');
  const [search, setSearch] = useState('');
  const [singleFilter, setSingleFilter] = useState<SingleStatusFilter>('all');
  const [legerFilter, setLegerFilter] = useState<LegerStatusFilter>('all');
  const [sortBy, setSortBy] = useState<SortOption>('score-desc');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const activeSubjectMeta = getSubjectMeta(activeSubjectId);

  // Single-subject metrics & rows
  const singleSummary = useMemo(
    () => computeClassSummary(sheets, config),
    [sheets, config]
  );

  const singleRanks = useMemo(
    () => computeStudentRanks(sheets, config),
    [sheets, config]
  );

  const singleRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    const enriched = sheets.map((sheet) => ({
      sheet,
      isGraded: sheet.gradedAt !== null,
      result: gradeStudentSheet(sheet, config),
      rank: singleRanks[sheet.id] ?? null,
    }));

    const filtered = enriched.filter((row) => {
      if (q) {
        const matchesName = row.sheet.name.toLowerCase().includes(q);
        const matchesNis = row.sheet.nis.toLowerCase().includes(q);
        const matchesClass = (row.sheet.className || '')
          .toLowerCase()
          .includes(q);
        if (!matchesName && !matchesNis && !matchesClass) return false;
      }
      if (singleFilter === 'passed') return row.isGraded && row.result.passed;
      if (singleFilter === 'remedial')
        return row.isGraded && !row.result.passed;
      if (singleFilter === 'pending') return !row.isGraded;
      return true;
    });

    return [...filtered].sort((a, b) => {
      if (sortBy === 'score-desc') {
        if (a.isGraded !== b.isGraded) return a.isGraded ? -1 : 1;
        return b.result.finalScore - a.result.finalScore;
      }
      if (sortBy === 'score-asc') {
        if (a.isGraded !== b.isGraded) return a.isGraded ? -1 : 1;
        return a.result.finalScore - b.result.finalScore;
      }
      if (sortBy === 'name-asc') {
        return a.sheet.name.localeCompare(b.sheet.name, 'id');
      }
      return a.sheet.nis.localeCompare(b.sheet.nis, 'id');
    });
  }, [sheets, config, singleRanks, search, singleFilter, sortBy]);

  // All-subjects leger metrics & rows
  const legerData = useMemo(() => computeAllSubjectsLeger(store), [store]);

  const subjectRankingInsight = useMemo(() => {
    const gradedSubjs = SUBJECT_LIST.map((s) => ({
      meta: s,
      summary: legerData.subjectSummaries[s.id],
    })).filter((item) => item.summary.gradedCount > 0);

    if (gradedSubjs.length === 0) return null;
    const sorted = [...gradedSubjs].sort(
      (a, b) => b.summary.average - a.summary.average
    );
    return {
      highest: sorted[0],
      lowest: sorted[sorted.length - 1],
    };
  }, [legerData]);

  const filteredLegerRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = legerData.rows.filter((row) => {
      if (q) {
        const matchesName = row.name.toLowerCase().includes(q);
        const matchesNis = row.nis.toLowerCase().includes(q);
        const matchesClass = row.className.toLowerCase().includes(q);
        if (!matchesName && !matchesNis && !matchesClass) return false;
      }
      if (legerFilter !== 'all') {
        return row.overallStatus === legerFilter;
      }
      return true;
    });

    return [...list].sort((a, b) => {
      if (sortBy === 'score-desc') {
        return (b.averageScore ?? -1) - (a.averageScore ?? -1);
      }
      if (sortBy === 'score-asc') {
        if (a.averageScore === null && b.averageScore === null) return 0;
        if (a.averageScore === null) return 1;
        if (b.averageScore === null) return -1;
        return a.averageScore - b.averageScore;
      }
      if (sortBy === 'name-asc') {
        return a.name.localeCompare(b.name, 'id');
      }
      return a.nis.localeCompare(b.nis, 'id');
    });
  }, [legerData.rows, search, legerFilter, sortBy]);

  return (
    <div className="space-y-6">
      {/* Header + Scope Switch + Excel Actions */}
      <div className="flex flex-col gap-4 border-b border-slate-200 pb-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              {scope === 'all-subjects'
                ? 'Rekap Nilai Semua Mata Pelajaran'
                : `Rekap Nilai — ${activeSubjectMeta.name}`}
            </h1>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-slate-500">
              <span className="font-medium text-slate-700">{config.title}</span>
              <span aria-hidden="true">·</span>
              <span>Kelas {config.className}</span>
              <span aria-hidden="true">·</span>
              <span>
                {scope === 'all-subjects'
                  ? '5 Mata Pelajaran (Matematika, IPAS, Pendidikan Pancasila, Bahasa Indonesia, SBDP)'
                  : `KKM ${config.kkm}${
                      config.curveAdjustment > 0
                        ? ` · Katrol +${config.curveAdjustment}`
                        : ''
                    }`}
              </span>
            </div>
          </div>

          {/* Scope Toggle (All Subjects Leger vs Single Subject) */}
          <div
            className="inline-flex items-center rounded-lg bg-slate-100 p-1 self-start lg:self-auto"
            role="tablist"
            aria-label="Pilih cakupan rekap nilai"
          >
            <button
              type="button"
              role="tab"
              aria-selected={scope === 'all-subjects'}
              onClick={() => setScope('all-subjects')}
              className={`inline-flex items-center gap-1.5 rounded-md px-3.5 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                scope === 'all-subjects'
                  ? 'bg-white text-[#1D4ED8] shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Layers className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Semua Mapel (Leger)</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={scope === 'single-subject'}
              onClick={() => setScope('single-subject')}
              className={`inline-flex items-center gap-1.5 rounded-md px-3.5 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                scope === 'single-subject'
                  ? 'bg-white text-[#1D4ED8] shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <TableProperties className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Per Mapel ({activeSubjectMeta.shortName})</span>
            </button>
          </div>
        </div>

        {/* Action Row: Template, Import Excel, Export Excel, Export CSV */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          {scope === 'single-subject' ? (
            <div className="flex items-center gap-1 overflow-x-auto rounded-lg bg-slate-100 p-1">
              {SUBJECT_LIST.map((subj) => {
                const active = subj.id === activeSubjectId;
                return (
                  <button
                    key={subj.id}
                    type="button"
                    onClick={() => onSelectSubject(subj.id)}
                    className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      active
                        ? 'bg-white text-[#1D4ED8] font-semibold shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {subj.shortName}
                  </button>
                );
              })}
            </div>
          ) : (
            <p className="text-xs text-slate-500">
              Klik nilai pada sel mata pelajaran mana pun untuk langsung membuka lembar koreksi siswa tersebut.
            </p>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => downloadStudentTemplateXlsx(config)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <FileSpreadsheet className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Template Excel</span>
            </button>
            <button
              type="button"
              onClick={onOpenImportExcel}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#1D4ED8] bg-[#1D4ED8]/8 px-3.5 py-2 text-xs font-semibold text-[#1D4ED8] hover:bg-[#1D4ED8]/14 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Upload className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Impor Data Siswa</span>
            </button>
            {scope === 'all-subjects' ? (
              <>
                <button
                  type="button"
                  onClick={() => exportLegerAllSubjectsXlsx(store)}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Download className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Ekspor Leger (.xlsx)</span>
                </button>
                <button
                  type="button"
                  onClick={() => exportLegerToCsv(store)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <span>CSV</span>
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => exportFullReportXlsx(sheets, config)}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Download className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Laporan Mapel (.xlsx)</span>
                </button>
                <button
                  type="button"
                  onClick={() => exportGradesToCsv(sheets, config)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <span>CSV</span>
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ================= VIEW A: ALL SUBJECTS LEGER ================= */}
      {scope === 'all-subjects' ? (
        <div className="space-y-6">
          {/* 4-Column Leger KPI Strip */}
          <div className="bg-white border border-slate-200 rounded-xl grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-slate-200">
            <div className="p-5">
              <div className="text-xs font-medium text-slate-500">
                Rata-rata Leger Kelas
              </div>
              <div className="mt-1.5 font-mono text-3xl font-semibold text-slate-900 tabular-nums">
                {legerData.totalGradedSheets > 0
                  ? legerData.overallAverage.toFixed(1)
                  : '—'}
              </div>
              <div className="mt-1 text-xs text-slate-500">
                Gabungan 5 mata pelajaran
              </div>
            </div>

            <div className="p-5">
              <div className="text-xs font-medium text-slate-500">
                Rata-rata Mapel Tertinggi
              </div>
              <div className="mt-1.5 font-mono text-2xl font-semibold text-[#059669] tabular-nums">
                {subjectRankingInsight
                  ? `${subjectRankingInsight.highest.summary.average.toFixed(1)}`
                  : '—'}
              </div>
              <div className="mt-1 text-xs text-slate-600 truncate">
                {subjectRankingInsight
                  ? `${subjectRankingInsight.highest.meta.name} · Terendah: ${subjectRankingInsight.lowest.meta.shortName} (${subjectRankingInsight.lowest.summary.average.toFixed(1)})`
                  : 'Belum ada nilai terinput'}
              </div>
            </div>

            <div className="p-5">
              <div className="text-xs font-medium text-slate-500">
                Tuntas Semua Mapel
              </div>
              <div className="mt-1.5 font-mono text-3xl font-semibold text-slate-900 tabular-nums">
                {legerData.allPassedStudents}
                <span className="text-lg text-slate-400">
                  /{legerData.rows.length}
                </span>
              </div>
              <div className="mt-1 text-xs text-slate-500 font-mono tabular-nums">
                {legerData.fullyGradedStudents} siswa lengkap 5 mapel
              </div>
            </div>

            <div className="p-5">
              <div className="text-xs font-medium text-slate-500">
                Progres Koreksi Total
              </div>
              <div className="mt-1.5 font-mono text-3xl font-semibold text-slate-900 tabular-nums">
                {legerData.totalGradedSheets}
                <span className="text-lg text-slate-400">
                  /{legerData.totalExpectedSheets}
                </span>
              </div>
              <div className="mt-1 text-xs text-slate-500">
                Lembar jawaban di 5 mapel
              </div>
            </div>
          </div>

          {/* 5-Subject Performance Strip */}
          <div className="bg-white border border-slate-200 rounded-xl grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 divide-y lg:divide-y-0 lg:divide-x divide-slate-200">
            {SUBJECT_LIST.map((subj) => {
              const sum = legerData.subjectSummaries[subj.id];
              return (
                <button
                  key={subj.id}
                  type="button"
                  onClick={() => {
                    onSelectSubject(subj.id);
                    setScope('single-subject');
                  }}
                  className="p-4 text-left hover:bg-slate-50 transition-colors cursor-pointer group"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-slate-800 group-hover:text-[#1D4ED8] truncate">
                      {subj.name}
                    </span>
                    <span className="font-mono text-[11px] text-slate-400 tabular-nums shrink-0">
                      {sum.gradedCount}/{sum.totalCount}
                    </span>
                  </div>
                  <div className="mt-2 flex items-baseline justify-between gap-2">
                    <span className="font-mono text-xl font-semibold text-slate-900 tabular-nums">
                      {sum.gradedCount > 0 ? sum.average.toFixed(1) : '—'}
                    </span>
                    <span className="font-mono text-xs text-slate-500 tabular-nums">
                      {sum.gradedCount > 0 ? `${sum.passRate}% tuntas` : 'Belum ada'}
                    </span>
                  </div>
                  <div className="mt-2 h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-[#1D4ED8]"
                      style={{
                        width: `${sum.gradedCount > 0 ? Math.min(100, sum.average) : 0}%`,
                      }}
                    />
                  </div>
                </button>
              );
            })}
          </div>

          {/* Combined Leger Table */}
          <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between p-4 border-b border-slate-200">
              <div className="flex flex-wrap items-center gap-3">
                <div className="relative w-full sm:w-64">
                  <Search
                    className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400"
                    aria-hidden="true"
                  />
                  <input
                    type="search"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Cari nama, NIS, atau kelas..."
                    className="w-full h-9 rounded-lg border border-slate-300 bg-white pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#1D4ED8] focus:outline-none"
                  />
                </div>

                <div
                  className="inline-flex items-center rounded-lg bg-slate-100 p-1 overflow-x-auto"
                  role="group"
                  aria-label="Filter status leger"
                >
                  {(
                    [
                      { id: 'all', label: 'Semua' },
                      { id: 'tuntas-semua', label: 'Tuntas Semua' },
                      { id: 'remedial', label: 'Ada Remedial' },
                      { id: 'belum-lengkap', label: 'Belum Lengkap' },
                    ] as { id: LegerStatusFilter; label: string }[]
                  ).map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setLegerFilter(tab.id)}
                      className={`rounded-md px-3 py-1 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                        legerFilter === tab.id
                          ? 'bg-white text-slate-900 shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <label
                  htmlFor="sort-leger"
                  className="text-xs text-slate-500 whitespace-nowrap"
                >
                  Urutkan:
                </label>
                <select
                  id="sort-leger"
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as SortOption)}
                  className="h-9 rounded-lg border border-slate-300 bg-white px-2.5 text-xs font-medium text-slate-800 focus:border-[#1D4ED8] focus:outline-none"
                >
                  <option value="score-desc">Rata-rata Tertinggi (Rank)</option>
                  <option value="score-asc">Rata-rata Terendah</option>
                  <option value="name-asc">Nama A – Z</option>
                  <option value="nis-asc">Nomor Induk (NIS)</option>
                </select>
              </div>
            </div>

            {filteredLegerRows.length === 0 ? (
              <div className="p-12 text-center">
                <p className="text-sm font-medium text-slate-800">
                  Tidak ada siswa yang sesuai dengan filter leger saat ini.
                </p>
                <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setSearch('');
                      setLegerFilter('all');
                    }}
                    className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
                  >
                    Atur Ulang Filter
                  </button>
                  <button
                    type="button"
                    onClick={onOpenImportExcel}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-[#1D4ED8] px-4 py-2 text-xs font-semibold text-white hover:bg-[#1E40AF] cursor-pointer"
                  >
                    <Upload className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Impor Data Siswa</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-medium text-slate-500">
                      <th className="py-3 pl-5 pr-2 w-14 font-mono">Rank</th>
                      <th className="py-3 px-2 font-mono">NIS</th>
                      <th className="py-3 px-3 min-w-[170px]">Nama Siswa</th>
                      {SUBJECT_LIST.map((subj) => (
                        <th
                          key={subj.id}
                          className="py-3 px-2.5 text-right whitespace-nowrap"
                        >
                          {subj.shortName}
                        </th>
                      ))}
                      <th className="py-3 px-3 text-right whitespace-nowrap">
                        Jumlah
                      </th>
                      <th className="py-3 px-3 text-right whitespace-nowrap">
                        Rata-rata
                      </th>
                      <th className="py-3 px-3 whitespace-nowrap">
                        Status Leger
                      </th>
                      <th className="py-3 pl-3 pr-5 text-right whitespace-nowrap">
                        Aksi
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm">
                    {filteredLegerRows.map((row) => (
                      <tr
                        key={row.studentId}
                        className="hover:bg-slate-50/80 transition-colors"
                      >
                        <td className="py-3 pl-5 pr-2 font-mono text-xs font-semibold text-slate-500 tabular-nums">
                          {row.rank ? `#${row.rank}` : '—'}
                        </td>
                        <td className="py-3 px-2 font-mono text-xs text-slate-500 tabular-nums whitespace-nowrap">
                          {row.nis}
                        </td>
                        <td className="py-3 px-3">
                          <div className="font-medium text-slate-900">
                            {row.name}
                          </div>
                          <div className="text-xs text-slate-400">
                            Kelas {row.className}
                          </div>
                        </td>

                        {SUBJECT_LIST.map((subj) => {
                          const cell = row.subjects[subj.id];
                          return (
                            <td
                              key={subj.id}
                              className="py-2.5 px-2 text-right whitespace-nowrap"
                            >
                              <button
                                type="button"
                                onClick={() =>
                                  onEditStudent(row.studentId, subj.id)
                                }
                                title={`Klik untuk koreksi ${subj.name} — ${row.name}`}
                                className={`inline-flex items-center justify-end gap-1 rounded px-2 py-1 font-mono text-xs tabular-nums transition-colors cursor-pointer ${
                                  !cell.isGraded
                                    ? 'text-slate-400 hover:bg-slate-100 hover:text-[#1D4ED8]'
                                    : cell.passed
                                    ? 'font-medium text-slate-900 hover:bg-slate-100'
                                    : 'font-semibold text-[#DC2626] bg-red-50/60 hover:bg-red-100/70'
                                }`}
                              >
                                {cell.isGraded && cell.score !== null ? (
                                  <>
                                    {!cell.passed && (
                                      <ArrowDown
                                        className="h-3 w-3 shrink-0"
                                        aria-hidden="true"
                                      />
                                    )}
                                    <span>{cell.score.toFixed(1)}</span>
                                  </>
                                ) : (
                                  <span>Isi</span>
                                )}
                              </button>
                            </td>
                          );
                        })}

                        <td className="py-3 px-3 text-right font-mono text-xs font-medium text-slate-700 tabular-nums whitespace-nowrap">
                          {row.gradedSubjectCount > 0
                            ? row.totalScore.toFixed(1)
                            : '—'}
                        </td>
                        <td className="py-3 px-3 text-right font-mono text-sm font-bold text-slate-900 tabular-nums whitespace-nowrap">
                          {row.averageScore !== null
                            ? row.averageScore.toFixed(1)
                            : '—'}
                        </td>
                        <td className="py-3 px-3 whitespace-nowrap">
                          {row.overallStatus === 'tuntas-semua' ? (
                            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#059669]">
                              <CheckCircle2
                                className="h-3.5 w-3.5 shrink-0"
                                aria-hidden="true"
                              />
                              <span>Tuntas Semua</span>
                            </span>
                          ) : row.overallStatus === 'remedial' ? (
                            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#DC2626]">
                              <AlertTriangle
                                className="h-3.5 w-3.5 shrink-0"
                                aria-hidden="true"
                              />
                              <span>{row.remedialSubjectCount} Remedial</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500">
                              <Clock
                                className="h-3.5 w-3.5 shrink-0"
                                aria-hidden="true"
                              />
                              <span className="font-mono tabular-nums">
                                {row.gradedSubjectCount}/{SUBJECT_LIST.length}{' '}
                                mapel
                              </span>
                            </span>
                          )}
                        </td>
                        <td className="py-3 pl-3 pr-5 text-right whitespace-nowrap">
                          {confirmDeleteId === row.studentId ? (
                            <div className="inline-flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => {
                                  onDeleteStudent(row.studentId);
                                  setConfirmDeleteId(null);
                                }}
                                className="text-xs font-semibold text-[#DC2626] hover:underline cursor-pointer"
                              >
                                Ya, Hapus
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteId(null)}
                                className="text-xs text-slate-500 hover:underline cursor-pointer"
                              >
                                Batal
                              </button>
                            </div>
                          ) : (
                            <div className="inline-flex items-center gap-3">
                              <button
                                type="button"
                                onClick={() =>
                                  onEditStudentProfile(row.studentId)
                                }
                                className="inline-flex items-center gap-1 text-xs font-medium text-[#1D4ED8] hover:underline cursor-pointer"
                              >
                                <PencilLine
                                  className="h-3.5 w-3.5"
                                  aria-hidden="true"
                                />
                                <span>Edit</span>
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  setConfirmDeleteId(row.studentId)
                                }
                                className="inline-flex items-center gap-1 text-xs font-medium text-[#DC2626] hover:underline cursor-pointer"
                              >
                                <Trash2
                                  className="h-3.5 w-3.5"
                                  aria-hidden="true"
                                />
                                <span>Hapus</span>
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      ) : (
        /* ================= VIEW B: SINGLE SUBJECT DETAIL ================= */
        <div className="space-y-6">
          {/* 4-Column Single-Subject KPI Strip */}
          <div className="bg-white border border-slate-200 rounded-xl grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-slate-200">
            <div className="p-5">
              <div className="text-xs font-medium text-slate-500">
                Rata-rata {activeSubjectMeta.shortName}
              </div>
              <div className="mt-1.5 font-mono text-3xl font-semibold text-slate-900 tabular-nums">
                {singleSummary.gradedCount > 0
                  ? singleSummary.average.toFixed(1)
                  : '—'}
              </div>
              <div className="mt-1 text-xs text-slate-500 font-mono tabular-nums">
                {singleSummary.gradedCount > 0
                  ? `Median ${singleSummary.median.toFixed(1)} · SD ${singleSummary.stdDev.toFixed(1)}`
                  : `Batas KKM ${config.kkm}`}
              </div>
            </div>

            <div className="p-5">
              <div className="text-xs font-medium text-slate-500">
                Rentang Nilai
              </div>
              <div className="mt-1.5 font-mono text-3xl font-semibold text-slate-900 tabular-nums">
                {singleSummary.gradedCount > 0
                  ? `${singleSummary.highest.toFixed(0)} / ${singleSummary.lowest.toFixed(0)}`
                  : '—'}
              </div>
              <div className="mt-1 text-xs text-slate-500">
                Tertinggi / Terendah
              </div>
            </div>

            <div className="p-5">
              <div className="text-xs font-medium text-slate-500">
                Ketuntasan (≥ {config.kkm})
              </div>
              <div className="mt-1.5 font-mono text-3xl font-semibold text-[#059669] tabular-nums">
                {singleSummary.gradedCount > 0
                  ? `${singleSummary.passRate}%`
                  : '—'}
              </div>
              <div className="mt-1 text-xs text-slate-500 font-mono tabular-nums">
                {singleSummary.passedCount} tuntas · {singleSummary.remedialCount}{' '}
                remedial
              </div>
            </div>

            <div className="p-5">
              <div className="text-xs font-medium text-slate-500">
                Progres Koreksi
              </div>
              <div className="mt-1.5 font-mono text-3xl font-semibold text-slate-900 tabular-nums">
                {singleSummary.gradedCount}
                <span className="text-lg text-slate-400">
                  /{singleSummary.totalCount}
                </span>
              </div>
              <div className="mt-1 text-xs text-slate-500">
                {singleSummary.totalCount - singleSummary.gradedCount} lembar
                menunggu
              </div>
            </div>
          </div>

          <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between p-4 border-b border-slate-200">
              <div className="flex flex-wrap items-center gap-3">
                <div className="relative w-full sm:w-64">
                  <Search
                    className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400"
                    aria-hidden="true"
                  />
                  <input
                    type="search"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Cari nama, NIS, atau kelas..."
                    className="w-full h-9 rounded-lg border border-slate-300 bg-white pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#1D4ED8] focus:outline-none"
                  />
                </div>

                <div
                  className="inline-flex items-center rounded-lg bg-slate-100 p-1 overflow-x-auto"
                  role="group"
                  aria-label="Filter status ketuntasan"
                >
                  {(
                    [
                      { id: 'all', label: 'Semua' },
                      { id: 'passed', label: 'Tuntas' },
                      { id: 'remedial', label: 'Remedial' },
                      { id: 'pending', label: 'Menunggu' },
                    ] as { id: SingleStatusFilter; label: string }[]
                  ).map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setSingleFilter(tab.id)}
                      className={`rounded-md px-3 py-1 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                        singleFilter === tab.id
                          ? 'bg-white text-slate-900 shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <label
                  htmlFor="sort-gradebook"
                  className="text-xs text-slate-500 whitespace-nowrap"
                >
                  Urutkan:
                </label>
                <select
                  id="sort-gradebook"
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as SortOption)}
                  className="h-9 rounded-lg border border-slate-300 bg-white px-2.5 text-xs font-medium text-slate-800 focus:border-[#1D4ED8] focus:outline-none"
                >
                  <option value="score-desc">Nilai Tertinggi (Peringkat)</option>
                  <option value="score-asc">Nilai Terendah</option>
                  <option value="name-asc">Nama A – Z</option>
                  <option value="nis-asc">Nomor Induk (NIS)</option>
                </select>
              </div>
            </div>

            {singleRows.length === 0 ? (
              <div className="p-12 text-center">
                <p className="text-sm font-medium text-slate-800">
                  Tidak ada data siswa yang cocok dengan filter saat ini.
                </p>
                <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
                  {(search || singleFilter !== 'all') && (
                    <button
                      type="button"
                      onClick={() => {
                        setSearch('');
                        setSingleFilter('all');
                      }}
                      className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
                    >
                      Atur Ulang Filter
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={onAddNewStudent}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-[#1D4ED8] px-4 py-2 text-xs font-semibold text-white hover:bg-[#1E40AF] cursor-pointer"
                  >
                    <UserPlus className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Tambah Siswa</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-medium text-slate-500">
                      <th className="py-3 pl-5 pr-2 w-14 font-mono">Rank</th>
                      <th className="py-3 px-3">NIS</th>
                      <th className="py-3 px-3">Nama Siswa</th>
                      {config.enableMultiPackage && (
                        <th className="py-3 px-2 text-center font-mono">Paket</th>
                      )}
                      <th className="py-3 px-3 text-right">PG (B/S/K)</th>
                      {config.includeEssay && (
                        <th className="py-3 px-3 text-right">Uraian</th>
                      )}
                      <th className="py-3 px-3 text-right">Nilai Akhir</th>
                      <th className="py-3 px-3 text-center">Predikat</th>
                      <th className="py-3 px-3">Status</th>
                      <th className="py-3 pl-3 pr-5 text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm">
                    {singleRows.map(({ sheet, isGraded, result, rank }) => (
                      <tr
                        key={sheet.id}
                        className="hover:bg-slate-50/80 transition-colors"
                      >
                        <td className="py-3 pl-5 pr-2 font-mono text-xs font-semibold text-slate-500 tabular-nums">
                          {rank ? `#${rank}` : '—'}
                        </td>
                        <td className="py-3 px-3 font-mono text-xs text-slate-600 tabular-nums whitespace-nowrap">
                          {sheet.nis}
                        </td>
                        <td className="py-3 px-3">
                          <div className="font-medium text-slate-900">
                            {sheet.name}
                          </div>
                          <div className="text-xs text-slate-500 truncate max-w-xs">
                            {sheet.className || config.className}
                            {sheet.notes ? ` · ${sheet.notes}` : ''}
                          </div>
                        </td>
                        {config.enableMultiPackage && (
                          <td className="py-3 px-2 text-center font-mono text-xs font-semibold text-slate-700">
                            {sheet.packageCode || 'A'}
                          </td>
                        )}
                        <td className="py-3 px-3 text-right font-mono text-xs tabular-nums whitespace-nowrap">
                          {isGraded ? (
                            <span>
                              <span className="text-[#059669] font-medium">
                                {result.correctCount}
                              </span>
                              <span className="text-slate-300"> / </span>
                              <span className="text-[#DC2626] font-medium">
                                {result.wrongCount}
                              </span>
                              <span className="text-slate-300"> / </span>
                              <span className="text-slate-500">
                                {result.blankCount}
                              </span>
                            </span>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                        {config.includeEssay && (
                          <td className="py-3 px-3 text-right font-mono text-xs text-slate-700 tabular-nums whitespace-nowrap">
                            {isGraded
                              ? `${result.essayTotal}/${result.essayMax}`
                              : '—'}
                          </td>
                        )}
                        <td className="py-3 px-3 text-right font-mono text-sm font-semibold text-slate-900 tabular-nums whitespace-nowrap">
                          {isGraded
                            ? config.roundingMode === 'decimal1'
                              ? result.finalScore.toFixed(1)
                              : result.finalScore.toFixed(0)
                            : '—'}
                        </td>
                        <td className="py-3 px-3 text-center font-mono text-xs font-bold text-slate-800 whitespace-nowrap">
                          {isGraded ? result.predicate : '—'}
                        </td>
                        <td className="py-3 px-3 whitespace-nowrap">
                          {!isGraded ? (
                            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500">
                              <Clock
                                className="h-3.5 w-3.5 shrink-0"
                                aria-hidden="true"
                              />
                              <span>Menunggu</span>
                            </span>
                          ) : result.passed ? (
                            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#059669]">
                              <CheckCircle2
                                className="h-3.5 w-3.5 shrink-0"
                                aria-hidden="true"
                              />
                              <span>Tuntas</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#DC2626]">
                              <AlertTriangle
                                className="h-3.5 w-3.5 shrink-0"
                                aria-hidden="true"
                              />
                              <span>Remedial</span>
                            </span>
                          )}
                        </td>
                        <td className="py-3 pl-3 pr-5 text-right whitespace-nowrap">
                          {confirmDeleteId === sheet.id ? (
                            <div className="inline-flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => {
                                  onDeleteStudent(sheet.id);
                                  setConfirmDeleteId(null);
                                }}
                                className="text-xs font-semibold text-[#DC2626] hover:underline cursor-pointer"
                              >
                                Ya, Hapus
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteId(null)}
                                className="text-xs text-slate-500 hover:underline cursor-pointer"
                              >
                                Batal
                              </button>
                            </div>
                          ) : (
                            <div className="inline-flex items-center gap-3">
                              <button
                                type="button"
                                onClick={() => onEditStudent(sheet.id)}
                                className="text-xs font-medium text-slate-700 hover:text-[#1D4ED8] hover:underline cursor-pointer"
                              >
                                {isGraded ? 'Nilai' : 'Koreksi'}
                              </button>
                              <button
                                type="button"
                                onClick={() => onEditStudentProfile(sheet.id)}
                                className="inline-flex items-center gap-1 text-xs font-medium text-[#1D4ED8] hover:underline cursor-pointer"
                              >
                                <PencilLine
                                  className="h-3.5 w-3.5"
                                  aria-hidden="true"
                                />
                                <span>Edit</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteId(sheet.id)}
                                className="inline-flex items-center gap-1 text-xs font-medium text-[#DC2626] hover:underline cursor-pointer"
                              >
                                <Trash2
                                  className="h-3.5 w-3.5"
                                  aria-hidden="true"
                                />
                                <span>Hapus</span>
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
};
