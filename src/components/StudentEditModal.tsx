import React, { useEffect, useState } from 'react';
import { AlertTriangle, Save, Trash2, X } from 'lucide-react';
import { PackageCode } from '../types/grading';
import { PACKAGE_CODES } from '../utils/scoring';

export interface StudentProfileDraft {
  id: string;
  nis: string;
  name: string;
  className: string;
  packageCode: PackageCode;
}

interface StudentEditModalProps {
  student: StudentProfileDraft | null;
  enableMultiPackage: boolean;
  onClose: () => void;
  onSave: (updated: StudentProfileDraft) => void;
  onDelete: (id: string) => void;
}

export const StudentEditModal: React.FC<StudentEditModalProps> = ({
  student,
  enableMultiPackage,
  onClose,
  onSave,
  onDelete,
}) => {
  const [nis, setNis] = useState('');
  const [name, setName] = useState('');
  const [className, setClassName] = useState('');
  const [packageCode, setPackageCode] = useState<PackageCode>('A');
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (!student) return;
    setNis(student.nis);
    setName(student.name);
    setClassName(student.className);
    setPackageCode(student.packageCode || 'A');
    setError(null);
    setConfirmDelete(false);
  }, [student]);

  useEffect(() => {
    if (!student) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [student, onClose]);

  if (!student) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Nama lengkap siswa wajib diisi.');
      return;
    }
    onSave({
      id: student.id,
      nis: nis.trim() || '-',
      name: name.trim(),
      className: className.trim() || student.className,
      packageCode,
    });
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="edit-student-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 px-6 py-5 border-b border-slate-200">
          <div>
            <h2
              id="edit-student-title"
              className="text-lg font-bold tracking-tight text-slate-900"
            >
              Edit Data Siswa
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              Perubahan identitas siswa akan otomatis tersinkron di seluruh 5 mata pelajaran tanpa menghapus nilai yang sudah dikoreksi.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup jendela edit siswa"
            className="h-9 w-9 inline-flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-800 hover:bg-slate-100 cursor-pointer shrink-0"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit}>
          <div className="p-6 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="edit-stu-nis"
                  className="block text-xs font-medium text-slate-600 mb-1.5"
                >
                  NIS / Nomor Peserta
                </label>
                <input
                  id="edit-stu-nis"
                  type="text"
                  value={nis}
                  onChange={(e) => setNis(e.target.value)}
                  placeholder="Contoh: 2425101"
                  className="w-full h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm font-mono tabular-nums text-slate-900 focus:border-[#1D4ED8] focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]/20"
                />
              </div>

              <div>
                <label
                  htmlFor="edit-stu-class"
                  className="block text-xs font-medium text-slate-600 mb-1.5"
                >
                  Kelas / Rombel
                </label>
                <input
                  id="edit-stu-class"
                  type="text"
                  value={className}
                  onChange={(e) => setClassName(e.target.value)}
                  placeholder="Contoh: V-A"
                  className="w-full h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 focus:border-[#1D4ED8] focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]/20"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="edit-stu-name"
                className="block text-xs font-medium text-slate-600 mb-1.5"
              >
                Nama Lengkap Siswa
              </label>
              <input
                id="edit-stu-name"
                type="text"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (error) setError(null);
                }}
                placeholder="Masukkan nama lengkap siswa..."
                className="w-full h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 focus:border-[#1D4ED8] focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]/20"
              />
            </div>

            {enableMultiPackage && (
              <div>
                <span className="block text-xs font-medium text-slate-600 mb-1.5">
                  Kode Paket Soal
                </span>
                <div className="inline-flex rounded-lg bg-slate-100 p-1">
                  {PACKAGE_CODES.map((pkg) => (
                    <button
                      key={pkg}
                      type="button"
                      onClick={() => setPackageCode(pkg)}
                      className={`rounded-md px-4 py-1.5 font-mono text-xs font-semibold transition-colors cursor-pointer ${
                        packageCode === pkg
                          ? 'bg-white text-[#1D4ED8] shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Paket {pkg}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {error && (
              <p className="flex items-center gap-1.5 text-xs font-medium text-[#DC2626]">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span>{error}</span>
              </p>
            )}
          </div>

          {/* Footer with Delete & Save */}
          <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 border-t border-slate-200 bg-slate-50/70">
            <div>
              {confirmDelete ? (
                <div className="inline-flex items-center gap-2.5 text-xs">
                  <span className="text-slate-600 font-medium">Hapus siswa ini?</span>
                  <button
                    type="button"
                    onClick={() => {
                      onDelete(student.id);
                      onClose();
                    }}
                    className="font-semibold text-[#DC2626] hover:underline cursor-pointer"
                  >
                    Ya, Hapus
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(false)}
                    className="text-slate-500 hover:underline cursor-pointer"
                  >
                    Batal
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmDelete(true)}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-[#DC2626] hover:underline cursor-pointer"
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Hapus Siswa</span>
                </button>
              )}
            </div>

            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                Batal
              </button>
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#1D4ED8] px-4 py-2 text-xs font-semibold text-white hover:bg-[#1E40AF] transition-colors whitespace-nowrap cursor-pointer"
              >
                <Save className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Simpan Perubahan</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
