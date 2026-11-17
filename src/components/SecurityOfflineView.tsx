import React, { useState } from 'react';
import {
  CheckCircle2,
  Download,
  FileKey2,
  HardDriveDownload,
  Lock,
  RefreshCw,
  ShieldCheck,
  Upload,
  Wifi,
  WifiOff,
} from 'lucide-react';
import {
  decryptPayload,
  encryptPayload,
  type EncryptedEnvelope,
} from '../lib/cryptoVault';
import type { EraporDataset } from '../lib/eraporCore';
import type { OutboxMutation } from '../lib/offlineSync';
import { PWAInstallButton } from './PWAInstallButton';

interface SecurityOfflineViewProps {
  dataset: EraporDataset;
  vaultMeta: { algorithm: string; sha256: string; updatedAt: string } | null;
  simulatedOffline: boolean;
  onToggleSimulatedOffline: () => void;
  isBrowserOnline: boolean;
  outbox: OutboxMutation[];
  onFlushOutbox: () => Promise<void>;
  passphrase: string;
  onChangePassphrase: (nextPass: string) => void;
  onRestoreEncryptedDataset: (restored: EraporDataset) => Promise<void>;
}

export const SecurityOfflineView: React.FC<SecurityOfflineViewProps> = ({
  dataset,
  vaultMeta,
  simulatedOffline,
  onToggleSimulatedOffline,
  isBrowserOnline,
  outbox,
  onFlushOutbox,
  passphrase,
  onChangePassphrase,
  onRestoreEncryptedDataset,
}) => {
  const [passInput, setPassInput] = useState(passphrase);
  const [statusMessage, setStatusMessage] = useState<{
    type: 'ok' | 'err';
    text: string;
  } | null>(null);
  const [flushing, setFlushing] = useState(false);

  const effectiveOnline = isBrowserOnline && !simulatedOffline;

  const handleSavePassphrase = (e: React.FormEvent) => {
    e.preventDefault();
    onChangePassphrase(passInput.trim());
    setStatusMessage({
      type: 'ok',
      text: passInput.trim()
        ? 'Kunci sandi enkripsi AES-256-GCM lokal diperbarui untuk brankas perangkat ini.'
        : 'Menggunakan kunci brankas standar perangkat.',
    });
  };

  const handleExportEncryptedBackup = async () => {
    try {
      const envelope = await encryptPayload(dataset, passphrase || undefined);
      const blob = new Blob([JSON.stringify(envelope, null, 2)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Backup-Terenkripsi-${dataset.school.npsn}-${dataset.school.semesterId}.erapor.enc`;
      link.click();
      URL.revokeObjectURL(url);
      setStatusMessage({
        type: 'ok',
        text: `Cadangan terenkripsi AES-256-GCM berhasil diunduh (SHA-256: ${envelope.integritySha256.slice(0, 12)}...).`,
      });
    } catch (err) {
      setStatusMessage({
        type: 'err',
        text: err instanceof Error ? err.message : 'Gagal membuat cadangan terenkripsi.',
      });
    }
  };

  const handleImportEncryptedBackup = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const raw = await file.text();
      const envelope = JSON.parse(raw) as EncryptedEnvelope;
      const decrypted = await decryptPayload<EraporDataset>(
        envelope,
        passphrase || undefined
      );
      await onRestoreEncryptedDataset(decrypted);
      setStatusMessage({
        type: 'ok',
        text: `Berkas cadangan terenkripsi berhasil didekripsi & dipulihkan (${decrypted.students.length} siswa).`,
      });
    } catch {
      setStatusMessage({
        type: 'err',
        text: 'Gagal mendekripsi berkas. Pastikan kata sandi enkripsi (Passphrase) sesuai dengan saat ekspor.',
      });
    } finally {
      e.target.value = '';
    }
  };

  const handleFlush = async () => {
    setFlushing(true);
    try {
      await onFlushOutbox();
      setStatusMessage({
        type: 'ok',
        text: 'Seluruh antrean perubahan offline berhasil disinkronkan ke server sekolah.',
      });
    } catch (err) {
      setStatusMessage({
        type: 'err',
        text: err instanceof Error ? err.message : 'Sinkronisasi antrean gagal.',
      });
    } finally {
      setFlushing(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="border-b border-slate-200 pb-4">
        <h1 className="text-xl font-bold text-slate-900">
          Enkripsi Data, Akses Offline & Instalasi Mudah
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Privasi data peserta didik dilindungi dengan AES-256-GCM + PBKDF2-SHA256 di perangkat maupun server.
        </p>
      </div>

      {statusMessage && (
        <div
          role="status"
          className={`rounded-lg border px-4 py-2.5 text-xs ${
            statusMessage.type === 'ok'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
              : 'border-red-200 bg-red-50 text-red-900'
          }`}
        >
          {statusMessage.text}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Encryption Vault Card */}
        <section className="rounded-xl border border-slate-200 bg-white p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Lock className="h-4 w-4 text-emerald-700" aria-hidden="true" />
              <h2 className="text-sm font-bold text-slate-900">
                Brankas Enkripsi AES-256-GCM
              </h2>
            </div>
            <span className="font-mono text-[11px] font-semibold text-emerald-700">
              {vaultMeta?.algorithm.toUpperCase() || 'AES-256-GCM'}
            </span>
          </div>

          <p className="text-xs text-slate-600 leading-relaxed">
            Seluruh nilai siswa, deskripsi capaian, dan salinan offline di IndexedDB dienkripsi memakai{' '}
            <code className="font-mono text-slate-800">PBKDF2-SHA256</code> (100.000 iterasi) serta integritas{' '}
            <code className="font-mono text-slate-800">SHA-256</code>.
          </p>

          <form onSubmit={handleSavePassphrase} className="space-y-2.5">
            <label htmlFor="vault-passphrase" className="block text-xs font-semibold text-slate-700">
              Kunci Sandi Enkripsi Brankas Sekolah (Passphrase)
            </label>
            <div className="flex gap-2">
              <input
                id="vault-passphrase"
                type="password"
                value={passInput}
                onChange={(e) => setPassInput(e.target.value)}
                placeholder="Opsional: kunci sandi khusus sekolah..."
                className="flex-1 rounded-lg border border-slate-300 px-3 py-2 font-mono text-xs text-slate-900"
              />
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 cursor-pointer"
              >
                <FileKey2 className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Terapkan Kunci</span>
              </button>
            </div>
          </form>

          <div className="flex flex-wrap gap-3 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => void handleExportEncryptedBackup()}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50 cursor-pointer"
            >
              <Download className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Ekspor Backup Terenkripsi (.erapor.enc)</span>
            </button>

            <label className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50 cursor-pointer">
              <Upload className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Pulihkan dari .erapor.enc</span>
              <input
                type="file"
                accept=".enc,.json"
                onChange={(e) => void handleImportEncryptedBackup(e)}
                className="sr-only"
              />
            </label>
          </div>
        </section>

        {/* Offline Sync & Mode Switch */}
        <section className="rounded-xl border border-slate-200 bg-white p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {effectiveOnline ? (
                <Wifi className="h-4 w-4 text-emerald-700" aria-hidden="true" />
              ) : (
                <WifiOff className="h-4 w-4 text-amber-700" aria-hidden="true" />
              )}
              <h2 className="text-sm font-bold text-slate-900">
                Antrean Sinkronisasi Offline-First
              </h2>
            </div>
            <span
              className={`text-xs font-semibold ${
                effectiveOnline ? 'text-emerald-700' : 'text-amber-700'
              }`}
            >
              {effectiveOnline ? 'Terhubung ke Jaringan' : 'Mode Offline Aktif'}
            </span>
          </div>

          <p className="text-xs text-slate-600 leading-relaxed">
            Guru dapat terus menginput nilai dan catatan wali saat Wi-Fi sekolah terputus. Semua perubahan tersimpan terenkripsi di perangkat dan otomatis tersinkron ketika jaringan kembali.
          </p>

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3.5">
            <div>
              <p className="text-xs font-bold text-slate-900">
                Antrean Tertunda: <span className="font-mono tabular-nums">{outbox.length}</span> perubahan
              </p>
              <p className="text-[11px] text-slate-500">
                {outbox.length === 0
                  ? 'Semua data lokal sudah sama dengan server sekolah.'
                  : 'Menunggu jaringan aktif untuk unggah otomatis.'}
              </p>
            </div>
            <button
              type="button"
              disabled={!effectiveOnline || outbox.length === 0 || flushing}
              onClick={() => void handleFlush()}
              className="inline-flex items-center gap-1.5 rounded-lg bg-blue-700 px-3.5 py-2 text-xs font-semibold text-white hover:bg-blue-800 disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${flushing ? 'animate-spin' : ''}`} aria-hidden="true" />
              <span>Sinkronkan Sekarang</span>
            </button>
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-slate-100">
            <div>
              <p className="text-xs font-semibold text-slate-800">
                Simulasi Mode Offline (Uji Lapangan)
              </p>
              <p className="text-[11px] text-slate-500">
                Uji input nilai tanpa jaringan, lalu matikan simulasi untuk melihat auto-sync.
              </p>
            </div>
            <button
              type="button"
              onClick={onToggleSimulatedOffline}
              aria-pressed={simulatedOffline}
              className={`rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
                simulatedOffline
                  ? 'bg-amber-600 text-white hover:bg-amber-700'
                  : 'border border-slate-300 bg-white text-slate-800 hover:bg-slate-50'
              }`}
            >
              {simulatedOffline ? 'Kembalikan Online' : 'Uji Mode Offline'}
            </button>
          </div>
        </section>
      </div>

      {/* Simple Installation Guide */}
      <section className="rounded-xl border border-slate-200 bg-white p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <HardDriveDownload className="h-4 w-4 text-blue-700" aria-hidden="true" />
            <h2 className="text-sm font-bold text-slate-900">
              Instalasi Ringkas 1-Menit (Tanpa Konfigurasi Database Rumit)
            </h2>
          </div>
          <PWAInstallButton />
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-lg border border-slate-200 p-4">
            <p className="text-xs font-bold text-slate-900">01. Instal Sebagai Aplikasi Mandiri</p>
            <p className="mt-1.5 text-xs text-slate-600 leading-relaxed">
              Klik tombol <strong>Instal Aplikasi (PWA)</strong> agar e-Rapor terpasang di Desktop Windows/Mac, Chromebook, atau Tablet guru tanpa installer tambahan.
            </p>
          </div>
          <div className="rounded-lg border border-slate-200 p-4">
            <p className="text-xs font-bold text-slate-900">02. Hubungkan WebService Dapodik</p>
            <p className="mt-1.5 text-xs text-slate-600 leading-relaxed">
              Masukkan alamat WebService Dapodik sekolah (<code className="font-mono">localhost:5774</code>) atau impor JSON Dapodik di menu Referensi Dapodik.
            </p>
          </div>
          <div className="rounded-lg border border-slate-200 p-4">
            <p className="text-xs font-bold text-slate-900">03. Kerja Paralel & Auto-Sync</p>
            <p className="mt-1.5 text-xs text-slate-600 leading-relaxed">
              Guru dapat mengisi nilai secara offline di kelas mana saja; saat tersambung kembali ke Wi-Fi sekolah, laporan otomatis Kepala Sekolah langsung terbarui.
            </p>
          </div>
        </div>

        <div className="mt-4 flex items-center gap-2 text-xs text-slate-500">
          <ShieldCheck className="h-4 w-4 text-emerald-600" aria-hidden="true" />
          <span>
            Verifikasi SHA-256 Server Terakhir:{' '}
            <code className="font-mono text-slate-700">
              {vaultMeta?.sha256.slice(0, 24) || dataset.school.checksumSha256.slice(0, 24)}...
            </code>
          </span>
          <CheckCircle2 className="ml-2 h-3.5 w-3.5 text-emerald-600" aria-hidden="true" />
        </div>
      </section>
    </div>
  );
};
