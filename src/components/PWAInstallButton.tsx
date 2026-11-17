import React, { useState } from 'react';
import { Download, Smartphone, X } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

interface PWAInstallButtonProps {
  compact?: boolean;
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({
  compact = false,
}) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showGuide, setShowGuide] = useState(false);

  if (isInstalled) {
    return null;
  }

  if (isInstallable) {
    return (
      <button
        type="button"
        onClick={() => void install()}
        className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-3.5 py-2 text-xs font-semibold text-white transition-colors hover:bg-blue-800 whitespace-nowrap shrink-0 cursor-pointer"
      >
        <Download className="h-3.5 w-3.5" aria-hidden="true" />
        <span>{compact ? 'Instal' : 'Instal Aplikasi (PWA)'}</span>
      </button>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setShowGuide(true)}
        className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 whitespace-nowrap shrink-0 cursor-pointer"
      >
        <Smartphone className="h-3.5 w-3.5" aria-hidden="true" />
        <span>{compact ? 'Instal App' : 'Instal Offline App'}</span>
      </button>

      {showGuide && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="pwa-install-title"
        >
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3
                  id="pwa-install-title"
                  className="text-base font-bold text-slate-900"
                >
                  Instalasi Cepat Tanpa Installer Rumit
                </h3>
                <p className="mt-1 text-xs text-slate-500">
                  Berjalan seperti aplikasi desktop & tablet mandiri dan tetap aktif saat offline.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowGuide(false)}
                aria-label="Tutup panduan instalasi"
                className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {isIOS ? (
              <ol className="mt-4 space-y-2 text-sm text-slate-700 list-decimal pl-5">
                <li>Ketuk ikon <strong>Bagikan (Share)</strong> di bilah Safari.</li>
                <li>Gulir ke bawah dan pilih <strong>Tambah ke Layar Utama (Add to Home Screen)</strong>.</li>
                <li>Buka ikon <strong>e-Rapor</strong> langsung dari layar utama meski tanpa internet.</li>
              </ol>
            ) : (
              <ol className="mt-4 space-y-2 text-sm text-slate-700 list-decimal pl-5">
                <li>Klik ikon <strong>Instal (Install App)</strong> di sisi kanan bilah alamat Chrome / Edge.</li>
                <li>Atau buka menu browser (⋮) lalu pilih <strong>Simpan dan Bagikan &rarr; Instal e-Rapor Dapodik Nusantara</strong>.</li>
                <li>Aplikasi otomatis menyimpan brankas terenkripsi AES-256-GCM untuk kerja offline.</li>
              </ol>
            )}

            <div className="mt-5 flex justify-end">
              <button
                type="button"
                onClick={() => setShowGuide(false)}
                className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 cursor-pointer"
              >
                Mengerti
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
