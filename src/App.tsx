import { useEffect, useState } from 'react';
import { CheckCircle2, RotateCcw, UserPlus } from 'lucide-react';
import { AnswerKeyConfig } from './components/AnswerKeyConfig';
import {
  ExcelImportModal,
  ImportStrategy,
} from './components/ExcelImportModal';
import { GradebookLedger } from './components/GradebookLedger';
import { ItemAnalysisAndPrint } from './components/ItemAnalysisAndPrint';
import { ManualGradingWorkspace } from './components/ManualGradingWorkspace';
import { SubjectSwitcherBar } from './components/SubjectSwitcherBar';
import {
  ActiveTab,
  ExamConfig,
  MultiSubjectStore,
  ParsedExcelStudentRow,
  StudentSheet,
  SubjectId,
} from './types/grading';
import {
  INITIAL_MULTI_SUBJECT_STORE,
  SUBJECT_LIST,
  getSubjectMeta,
  normalizeMultiSubjectStore,
} from './utils/scoring';

const STORAGE_KEY_STORE = 'koreksilembar_multimapel_v2';

function loadMultiSubjectStore(): MultiSubjectStore {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY_STORE);
    if (!raw) return INITIAL_MULTI_SUBJECT_STORE;
    return normalizeMultiSubjectStore(
      JSON.parse(raw) as Partial<MultiSubjectStore>
    );
  } catch {
    return INITIAL_MULTI_SUBJECT_STORE;
  }
}

const NAV_ITEMS: { id: ActiveTab; label: string }[] = [
  { id: 'koreksi', label: 'Koreksi Manual' },
  { id: 'kunci', label: 'Kunci & Bobot' },
  { id: 'rekap', label: 'Rekap Nilai' },
  { id: 'analisis', label: 'Analisis & LJK' },
];

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('koreksi');
  const [activeSubjectId, setActiveSubjectId] =
    useState<SubjectId>('matematika');
  const [store, setStore] = useState<MultiSubjectStore>(() =>
    loadMultiSubjectStore()
  );
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);

  const [activeSheetId, setActiveSheetId] = useState<string | null>(() => {
    const initial = loadMultiSubjectStore().matematika.sheets;
    const firstPending = initial.find((s) => s.gradedAt === null);
    return firstPending?.id ?? initial[0]?.id ?? null;
  });

  const [notice, setNotice] = useState<string | null>(null);

  const activeSubject = store[activeSubjectId];
  const config = activeSubject.config;
  const sheets = activeSubject.sheets;

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY_STORE, JSON.stringify(store));
    } catch {
      // Ignore storage quota errors
    }
  }, [store]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 4000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const handleSelectSubject = (nextSubjectId: SubjectId) => {
    setActiveSubjectId(nextSubjectId);
    const nextSheets = store[nextSubjectId].sheets;
    // Preserve same student selection across subjects if present, else pick first pending
    if (activeSheetId && nextSheets.some((s) => s.id === activeSheetId)) {
      return;
    }
    const firstPending = nextSheets.find((s) => s.gradedAt === null);
    setActiveSheetId(firstPending?.id ?? nextSheets[0]?.id ?? null);
  };

  const handleUpdateConfig = (nextConfig: ExamConfig) => {
    setStore((prev) => ({
      ...prev,
      [activeSubjectId]: {
        ...prev[activeSubjectId],
        config: nextConfig,
      },
    }));
  };

  const handleCreateNewSheet = () => {
    setActiveSheetId(null);
    setActiveTab('koreksi');
  };

  const handleSaveSheet = (saved: StudentSheet, advanceToNext: boolean) => {
    let nextActiveSubjectSheets: StudentSheet[] = [];

    setStore((prev) => {
      const nextStore = { ...prev };
      const existsInActive = prev[activeSubjectId].sheets.some(
        (s) => s.id === saved.id
      );

      SUBJECT_LIST.forEach((subj) => {
        const currentState = prev[subj.id];
        if (subj.id === activeSubjectId) {
          const updated = existsInActive
            ? currentState.sheets.map((s) => (s.id === saved.id ? saved : s))
            : [...currentState.sheets, saved];
          nextActiveSubjectSheets = updated;
          nextStore[subj.id] = { ...currentState, sheets: updated };
        } else {
          // Synchronize student roster identity across all 5 subjects
          const existsHere = currentState.sheets.some((s) => s.id === saved.id);
          const synced = existsHere
            ? currentState.sheets.map((s) =>
                s.id === saved.id
                  ? {
                      ...s,
                      nis: saved.nis,
                      name: saved.name,
                      className: saved.className,
                    }
                  : s
              )
            : [
                ...currentState.sheets,
                {
                  id: saved.id,
                  nis: saved.nis,
                  name: saved.name,
                  className: saved.className,
                  packageCode: 'A' as const,
                  answers: {},
                  essayScores: {},
                  notes: '',
                  gradedAt: null,
                },
              ];
          nextStore[subj.id] = { ...currentState, sheets: synced };
        }
      });

      return nextStore;
    });

    const subjName = getSubjectMeta(activeSubjectId).name;
    setNotice(`Nilai ${subjName} untuk ${saved.name} berhasil disimpan.`);

    if (advanceToNext) {
      const nextPending = nextActiveSubjectSheets.find(
        (s) => s.gradedAt === null && s.id !== saved.id
      );
      if (nextPending) {
        setActiveSheetId(nextPending.id);
      } else {
        setActiveSheetId(null);
      }
    } else {
      setActiveSheetId(saved.id);
    }
  };

  const handleConfirmExcelImport = (
    parsedRows: ParsedExcelStudentRow[],
    strategy: ImportStrategy
  ) => {
    const usable = parsedRows.filter((r) => r.status !== 'invalid');
    if (usable.length === 0) return;

    const now = Date.now();
    let addedCount = 0;
    let updatedCount = 0;
    let firstPendingId: string | null = null;

    setStore((prev) => {
      const nextStore = { ...prev };

      if (strategy === 'replace-all') {
        const baseIds = usable.map((_, idx) => `stu-imp-${now}-${idx}`);
        SUBJECT_LIST.forEach((subj) => {
          const st = prev[subj.id];
          const replaced: StudentSheet[] = usable.map((row, idx) => ({
            id: baseIds[idx],
            nis: row.nis,
            name: row.name,
            className: row.className || st.config.className,
            packageCode: row.packageCode || 'A',
            answers: {},
            essayScores: {},
            notes: '',
            gradedAt: null,
          }));
          nextStore[subj.id] = { ...st, sheets: replaced };
        });
        addedCount = usable.length;
        firstPendingId = baseIds[0] ?? null;
      } else {
        // Compute master additions/updates from active subject roster so IDs match across all 5 subjects
        const refSheets = prev[activeSubjectId].sheets;
        const nisToId = new Map<string, string>();
        refSheets.forEach((s) => {
          const key = s.nis.trim().toLowerCase();
          if (key && key !== '-') nisToId.set(key, s.id);
        });

        const operations: {
          type: 'add' | 'update';
          id: string;
          row: ParsedExcelStudentRow;
        }[] = [];

        usable.forEach((row, idx) => {
          const normNis = row.nis.trim().toLowerCase();
          const existingId = nisToId.get(normNis);
          if (existingId) {
            if (strategy === 'update-duplicates') {
              operations.push({ type: 'update', id: existingId, row });
              updatedCount++;
            }
          } else {
            const newId = `stu-imp-${now}-${idx}`;
            if (normNis) nisToId.set(normNis, newId);
            operations.push({ type: 'add', id: newId, row });
            addedCount++;
          }
        });

        SUBJECT_LIST.forEach((subj) => {
          const st = prev[subj.id];
          const updatedSheets = [...st.sheets];

          operations.forEach((op) => {
            const idx = updatedSheets.findIndex((s) => s.id === op.id);
            if (op.type === 'update' && idx !== -1) {
              updatedSheets[idx] = {
                ...updatedSheets[idx],
                name: op.row.name,
                className: op.row.className || updatedSheets[idx].className,
                packageCode:
                  op.row.packageCode || updatedSheets[idx].packageCode,
              };
            } else if (op.type === 'add' && idx === -1) {
              updatedSheets.push({
                id: op.id,
                nis: op.row.nis,
                name: op.row.name,
                className: op.row.className || st.config.className,
                packageCode: op.row.packageCode || 'A',
                answers: {},
                essayScores: {},
                notes: '',
                gradedAt: null,
              });
            }
          });

          nextStore[subj.id] = { ...st, sheets: updatedSheets };
        });

        const pendingInActive = nextStore[activeSubjectId].sheets.find(
          (s) => s.gradedAt === null
        );
        firstPendingId = pendingInActive?.id ?? null;
      }

      return nextStore;
    });

    if (firstPendingId) {
      setActiveSheetId(firstPendingId);
    }

    if (strategy === 'replace-all') {
      setNotice(
        `Daftar siswa di 5 mata pelajaran diganti: ${addedCount} siswa berhasil diimpor dari Excel.`
      );
    } else if (updatedCount > 0) {
      setNotice(
        `Impor Excel selesai di 5 mapel: ${addedCount} siswa ditambahkan, ${updatedCount} diperbarui.`
      );
    } else {
      setNotice(
        `${addedCount} siswa baru berhasil diimpor ke seluruh 5 mata pelajaran.`
      );
    }
  };

  const handleEditFromLedger = (id: string, subjectId?: SubjectId) => {
    if (subjectId) {
      setActiveSubjectId(subjectId);
    }
    setActiveSheetId(id);
    setActiveTab('koreksi');
  };

  const handleDeleteStudent = (id: string) => {
    setStore((prev) => {
      const nextStore = { ...prev };
      SUBJECT_LIST.forEach((subj) => {
        nextStore[subj.id] = {
          ...prev[subj.id],
          sheets: prev[subj.id].sheets.filter((s) => s.id !== id),
        };
      });
      return nextStore;
    });

    if (activeSheetId === id) {
      const remaining = sheets.filter((s) => s.id !== id);
      setActiveSheetId(remaining[0]?.id ?? null);
    }
    setNotice('Data siswa dihapus dari daftar kelas.');
  };

  const handleResetDemoData = () => {
    setStore(INITIAL_MULTI_SUBJECT_STORE);
    setActiveSubjectId('matematika');
    const firstPending = INITIAL_MULTI_SUBJECT_STORE.matematika.sheets.find(
      (s) => s.gradedAt === null
    );
    setActiveSheetId(
      firstPending?.id ?? INITIAL_MULTI_SUBJECT_STORE.matematika.sheets[0].id
    );
    setNotice('Seluruh data contoh 5 mata pelajaran dikembalikan ke kondisi awal.');
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#F8FAFC] text-[#0F172A]">
      {/* Strict 3-Zone Top Bar Contract */}
      <header className="no-print sticky top-0 z-30 bg-white/95 backdrop-blur-xs border-b border-slate-200">
        <div className="mx-auto max-w-[1360px] flex items-center justify-between gap-8 px-4 sm:px-6 lg:px-8 h-16">
          {/* Zone 1: Single-line Brand Wordmark */}
          <button
            type="button"
            onClick={() => setActiveTab('koreksi')}
            className="text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1D4ED8]"
          >
            KoreksiLembar
          </button>

          {/* Zone 2: 4 Clean Single-Line Nav Links */}
          <nav
            aria-label="Navigasi utama"
            className="hidden md:flex items-center gap-7"
          >
            {NAV_ITEMS.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveTab(item.id)}
                  className={`relative py-5 text-sm font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    isActive
                      ? 'text-[#1D4ED8]'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {item.label}
                  {isActive && (
                    <span
                      aria-hidden="true"
                      className="absolute inset-x-0 bottom-0 h-0.5 bg-[#1D4ED8]"
                    />
                  )}
                </button>
              );
            })}
          </nav>

          {/* Zone 3: 1 Primary CTA */}
          <div className="shrink-0">
            <button
              type="button"
              onClick={handleCreateNewSheet}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#1D4ED8] px-4 py-2 text-xs font-semibold text-white hover:bg-[#1E40AF] transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1D4ED8]"
            >
              <UserPlus className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Siswa Baru</span>
            </button>
          </div>
        </div>

        {/* Compact Mobile Tab Row */}
        <nav
          aria-label="Navigasi seluler"
          className="md:hidden flex items-center gap-5 overflow-x-auto border-t border-slate-100 px-4"
        >
          {NAV_ITEMS.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                className={`relative py-2.5 text-xs font-medium whitespace-nowrap shrink-0 cursor-pointer ${
                  isActive ? 'text-[#1D4ED8]' : 'text-slate-600'
                }`}
              >
                {item.label}
                {isActive && (
                  <span
                    aria-hidden="true"
                    className="absolute inset-x-0 bottom-0 h-0.5 bg-[#1D4ED8]"
                  />
                )}
              </button>
            );
          })}
        </nav>
      </header>

      {/* Main Content Container */}
      <main className="flex-1 mx-auto w-full max-w-[1360px] px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {notice && (
          <div
            role="status"
            aria-live="polite"
            className="no-print mb-6 flex items-center justify-between gap-3 rounded-lg border border-emerald-200 bg-emerald-50/70 px-4 py-2.5 text-xs font-medium text-[#059669]"
          >
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>{notice}</span>
            </div>
            <button
              type="button"
              onClick={() => setNotice(null)}
              className="text-emerald-700 hover:underline cursor-pointer"
            >
              Tutup
            </button>
          </div>
        )}

        {/* Subject Switcher Bar for single-subject workspaces */}
        {activeTab !== 'rekap' && (
          <SubjectSwitcherBar
            activeSubjectId={activeSubjectId}
            store={store}
            onSelectSubject={handleSelectSubject}
          />
        )}

        {activeTab === 'koreksi' && (
          <ManualGradingWorkspace
            config={config}
            sheets={sheets}
            activeSheetId={activeSheetId}
            onSelectSheet={(id) => setActiveSheetId(id)}
            onCreateNewSheet={handleCreateNewSheet}
            onSaveSheet={handleSaveSheet}
            onOpenImportExcel={() => setIsImportModalOpen(true)}
          />
        )}

        {activeTab === 'kunci' && (
          <AnswerKeyConfig
            config={config}
            sheets={sheets}
            onUpdateConfig={handleUpdateConfig}
          />
        )}

        {activeTab === 'rekap' && (
          <GradebookLedger
            activeSubjectId={activeSubjectId}
            store={store}
            config={config}
            sheets={sheets}
            onSelectSubject={handleSelectSubject}
            onEditStudent={handleEditFromLedger}
            onDeleteStudent={handleDeleteStudent}
            onAddNewStudent={handleCreateNewSheet}
            onOpenImportExcel={() => setIsImportModalOpen(true)}
          />
        )}

        {activeTab === 'analisis' && (
          <ItemAnalysisAndPrint config={config} sheets={sheets} />
        )}
      </main>

      {/* Excel Import Modal (syncs across all 5 subjects) */}
      <ExcelImportModal
        isOpen={isImportModalOpen}
        config={config}
        existingSheets={sheets}
        onClose={() => setIsImportModalOpen(false)}
        onConfirmImport={handleConfirmExcelImport}
      />

      {/* Quiet Footer */}
      <footer className="no-print border-t border-slate-200 bg-white mt-auto">
        <div className="mx-auto max-w-[1360px] flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between px-4 sm:px-6 lg:px-8 py-4 text-xs text-slate-500">
          <div>
            KoreksiLembar · Matematika, IPAS, Pendidikan Pancasila, Bahasa Indonesia, SBDP
          </div>
          <button
            type="button"
            onClick={handleResetDemoData}
            className="inline-flex items-center gap-1.5 text-slate-500 hover:text-slate-900 transition-colors self-start sm:self-auto cursor-pointer"
          >
            <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Atur Ulang Data Contoh</span>
          </button>
        </div>
      </footer>
    </div>
  );
}
