import React from 'react';
import { MultiSubjectStore, SubjectId } from '../types/grading';
import { SUBJECT_LIST } from '../utils/scoring';

interface SubjectSwitcherBarProps {
  activeSubjectId: SubjectId;
  store: MultiSubjectStore;
  onSelectSubject: (id: SubjectId) => void;
}

export const SubjectSwitcherBar: React.FC<SubjectSwitcherBarProps> = ({
  activeSubjectId,
  store,
  onSelectSubject,
}) => {
  return (
    <div className="no-print mb-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <span className="text-xs font-medium text-slate-500 whitespace-nowrap shrink-0">
        Mata Pelajaran Aktif:
      </span>

      <div
        role="tablist"
        aria-label="Pilih mata pelajaran"
        className="flex items-center gap-1 overflow-x-auto rounded-lg bg-slate-100 p-1"
      >
        {SUBJECT_LIST.map((subj) => {
          const isActive = subj.id === activeSubjectId;
          const st = store[subj.id];
          const graded = st.sheets.filter((s) => s.gradedAt !== null).length;
          const total = st.sheets.length;

          return (
            <button
              key={subj.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => onSelectSubject(subj.id)}
              className={`inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#1D4ED8] ${
                isActive
                  ? 'bg-white text-[#1D4ED8] font-semibold shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span>{subj.name}</span>
              <span
                className={`font-mono text-[11px] tabular-nums ${
                  isActive ? 'text-slate-500' : 'text-slate-400'
                }`}
              >
                {graded}/{total}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
