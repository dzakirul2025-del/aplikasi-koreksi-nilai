import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Upload,
  X,
  XCircle,
} from 'lucide-react';
import {
  ExamConfig,
  ParsedExcelStudentRow,
  StudentSheet,
} from '../types/grading';
import {
  downloadStudentTemplateXlsx,
  parseStudentExcelFile,
} from '../utils/excel';

export type ImportStrategy = 'skip-duplicates' | 'update-duplicates' | 'replace-all';

interface ExcelImportModalProps {
  isOpen: boolean;
  config: ExamConfig;
  existingSheets: StudentSheet[];
  onClose: () => void;
  onConfirmImport: (
    rows: ParsedExcelStudentRow[],
    strategy: ImportStrategy
  ) => void;
}

export const ExcelImportModal: React.FC<ExcelImportModalProps> = ({
  isOpen,
  config,
  existingSheets,
  onClose,
  onConfirmImport,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [rows, setRows] = useState<ParsedExcelStudentRow[]>([]);
  const [strategy, setStrategy] = useState<ImportStrategy>('skip-duplicates');
  const [isDragging, setIsDragging] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  const stats = useMemo(() => {
    const valid = rows.filter((r) => r.status === 'valid').length;
    const duplicate = rows.filter((r) => r.status === 'duplicate').length;
    const invalid = rows.filter((r) => r.status === 'invalid').length;
    const actionable =
      strategy === 'skip-duplicates' ? valid : valid + duplicate;
    return { total: rows.length, valid, duplicate, invalid, actionable };
  }, [rows, strategy]);

  if (!isOpen) return null;

  const processFile = async (file: File) => {
    setErrorMsg(null);
    setIsParsing(true);
    try {
      const parsed = await parseStudentExcelFile(
        file,
        existingSheets,
        config.className
      );
      if (parsed.length === 0) {
        setErrorMsg(
          'File terbaca, namun tidak ditemukan baris data siswa. Pastikan menggunakan kolom NIS dan Nama Siswa sesuai template.'
        );
        setRows([]);
        setFileName(file.name);
      } else {
        setRows(parsed);
        setFileName(file.name);
      }
    } catch {
      setErrorMsg(
        'Gagal membaca file Excel. Pastikan format file adalah .xlsx, .xls, atau .csv yang valid.'
      );
      setRows([]);
      setFileName(null);
    } finally {
      setIsParsing(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      void processFile(file);
    }
    e.target.value = '';
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      void processFile(file);
    }
  };

  const handleResetFile = () => {
    setRows([]);
    setFileName(null);
    setErrorMsg(null);
  };

  const handleConfirm = () => {
    if (stats.actionable === 0) return;
    onConfirmImport(rows, strategy);
    handleResetFile();
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="excel-import-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-3xl max-h-[90vh] flex flex-col bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-start justify-between gap-4 px-6 py-5 border-b border-slate-200">
          <div>
            <h2
              id="excel-import-title"
              className="text-lg font-bold tracking-tight text-slate-900"
            >
              Impor Data Siswa dari Excel
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              Unggah daftar peserta ujian (.xlsx, .xls, atau .csv) menggunakan template resmi agar langsung masuk ke antrean koreksi.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup jendela impor"
            className="h-9 w-9 inline-flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-800 hover:bg-slate-100 cursor-pointer shrink-0"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Step 1: Official Template Bar */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between pb-5 border-b border-slate-200">
            <div className="flex items-start gap-3">
              <FileSpreadsheet
                className="h-5 w-5 text-[#1D4ED8] mt-0.5 shrink-0"
                aria-hidden="true"
              />
              <div>
                <div className="text-sm font-semibold text-slate-900">
                  1. Unduh Template Excel Resmi
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Berisi kolom <span className="font-mono text-slate-700">NIS</span>,{' '}
                  <span className="font-mono text-slate-700">Nama Siswa</span>,{' '}
                  <span className="font-mono text-slate-700">Kelas</span>, dan{' '}
                  <span className="font-mono text-slate-700">Kode Paket</span> beserta lembar petunjuk.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => downloadStudentTemplateXlsx(config)}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Download className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Unduh Template (.xlsx)</span>
            </button>
          </div>

          {/* Step 2: Upload Dropzone */}
          <div>
            <div className="flex items-center justify-between mb-2.5">
              <span className="text-sm font-semibold text-slate-900">
                2. Unggah File Daftar Siswa
              </span>
              {fileName && (
                <button
                  type="button"
                  onClick={handleResetFile}
                  className="text-xs font-medium text-[#1D4ED8] hover:underline cursor-pointer"
                >
                  Ganti File
                </button>
              )}
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleFileChange}
              className="hidden"
            />

            {!fileName || rows.length === 0 ? (
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`rounded-xl border-2 border-dashed p-8 text-center transition-colors cursor-pointer ${
                  isDragging
                    ? 'border-[#1D4ED8] bg-[#1D4ED8]/5'
                    : 'border-slate-300 bg-slate-50/60 hover:border-slate-400 hover:bg-slate-50'
                }`}
              >
                <Upload
                  className="mx-auto h-7 w-7 text-slate-400"
                  aria-hidden="true"
                />
                <div className="mt-3 text-sm font-semibold text-slate-800">
                  {isParsing
                    ? 'Membaca file spreadsheet...'
                    : 'Tarik file Excel ke sini atau klik untuk memilih file'}
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  Mendukung format .xlsx, .xls, dan .csv · Header otomatis dideteksi (NIS, Nama Siswa, Kelas, Paket)
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Validation summary metadata (clean unboxed separators) */}
                <div className="flex flex-wrap items-center justify-between gap-3 py-2 text-xs text-slate-600 border-b border-slate-200">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-slate-900">{fileName}</span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono tabular-nums">{stats.total} baris</span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono tabular-nums text-[#059669] font-medium">
                      {stats.valid} valid
                    </span>
                    {stats.duplicate > 0 && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono tabular-nums text-[#D97706] font-medium">
                          {stats.duplicate} duplikat NIS
                        </span>
                      </>
                    )}
                    {stats.invalid > 0 && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono tabular-nums text-[#DC2626] font-medium">
                          {stats.invalid} tidak valid
                        </span>
                      </>
                    )}
                  </div>
                </div>

                {/* Duplicate Strategy Control */}
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <span className="text-xs font-medium text-slate-600">
                    Mode Penanganan Data:
                  </span>
                  <div className="inline-flex items-center rounded-lg bg-slate-100 p-1 overflow-x-auto">
                    {(
                      [
                        { id: 'skip-duplicates', label: 'Lewati Duplikat' },
                        { id: 'update-duplicates', label: 'Perbarui NIS Sama' },
                        { id: 'replace-all', label: 'Ganti Semua Daftar' },
                      ] as { id: ImportStrategy; label: string }[]
                    ).map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setStrategy(opt.id)}
                        className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                          strategy === opt.id
                            ? 'bg-white text-slate-900 shadow-xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Parsed Rows Preview Table */}
                <div className="border border-slate-200 rounded-lg overflow-hidden max-h-64 overflow-y-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead className="sticky top-0 bg-slate-50 border-b border-slate-200 text-slate-500">
                      <tr>
                        <th className="py-2.5 pl-3 pr-2 font-mono w-12">Baris</th>
                        <th className="py-2.5 px-2 font-mono">NIS</th>
                        <th className="py-2.5 px-2">Nama Siswa</th>
                        <th className="py-2.5 px-2">Kelas</th>
                        <th className="py-2.5 px-2 text-center font-mono">Paket</th>
                        <th className="py-2.5 pl-2 pr-3 text-right">Validasi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {rows.map((r) => (
                        <tr key={`${r.rowIndex}-${r.nis}`} className="bg-white">
                          <td className="py-2 pl-3 pr-2 font-mono text-slate-400 tabular-nums">
                            {r.rowIndex}
                          </td>
                          <td className="py-2 px-2 font-mono text-slate-700 tabular-nums">
                            {r.nis}
                          </td>
                          <td className="py-2 px-2 font-medium text-slate-900">
                            {r.name || <span className="text-slate-400 italic">(kosong)</span>}
                          </td>
                          <td className="py-2 px-2 text-slate-600">{r.className}</td>
                          <td className="py-2 px-2 text-center font-mono text-slate-700">
                            {r.packageCode}
                          </td>
                          <td className="py-2 pl-2 pr-3 text-right whitespace-nowrap">
                            {r.status === 'valid' ? (
                              <span className="inline-flex items-center gap-1 font-medium text-[#059669]">
                                <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                                <span>Siap Impor</span>
                              </span>
                            ) : r.status === 'duplicate' ? (
                              <span className="inline-flex items-center gap-1 font-medium text-[#D97706]">
                                <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
                                <span>
                                  {strategy === 'skip-duplicates'
                                    ? 'Akan Dilewati'
                                    : strategy === 'update-duplicates'
                                    ? 'Akan Diperbarui'
                                    : 'Siap Impor'}
                                </span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 font-medium text-[#DC2626]">
                                <XCircle className="h-3.5 w-3.5" aria-hidden="true" />
                                <span>{r.reason ?? 'Tidak Valid'}</span>
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {errorMsg && (
              <p className="mt-3 flex items-center gap-1.5 text-xs font-medium text-[#DC2626]">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span>{errorMsg}</span>
              </p>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between gap-4 px-6 py-4 border-t border-slate-200 bg-slate-50/70">
          <div className="text-xs text-slate-500">
            {strategy === 'replace-all' && rows.length > 0
              ? 'Perhatian: Seluruh daftar siswa lama akan digantikan dengan file ini.'
              : 'Siswa yang baru diimpor akan otomatis berstatus Menunggu Koreksi.'}
          </div>
          <div className="flex items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
            >
              Batal
            </button>
            <button
              type="button"
              disabled={stats.actionable === 0}
              onClick={handleConfirm}
              className="rounded-lg bg-[#1D4ED8] px-4 py-2 text-xs font-semibold text-white hover:bg-[#1E40AF] disabled:opacity-40 disabled:pointer-events-none transition-colors whitespace-nowrap cursor-pointer"
            >
              Impor {stats.actionable > 0 ? `${stats.actionable} Siswa` : 'Data'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
