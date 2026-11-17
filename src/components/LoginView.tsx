import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Eye,
  EyeOff,
  Loader2,
  LogIn,
} from 'lucide-react';
import {
  normalizeNpsnInput,
  safeParseJsonResponse,
  validateNpsnFormat,
  type AuthRole,
  type SchoolJenjang,
  type SchoolProfileSummary,
} from '../lib/eraporCore';

export interface ResolvedSchoolInfo {
  namaSekolah?: string;
  jenjang?: SchoolJenjang;
  alamat?: string;
  kecamatan?: string;
  kabupaten?: string;
  provinsi?: string;
  sourceHost?: string;
  studentCount?: number;
  rombelCount?: number;
}

export interface LoginSubmitPayload {
  npsn: string;
  username: string;
  password: string;
  expectedRole: AuthRole;
  resolvedSchool?: ResolvedSchoolInfo;
}

interface LookupNpsnResponse {
  ok?: boolean;
  npsn?: string;
  registered?: boolean;
  dapodikReachable?: boolean;
  source?: 'vault' | 'dapodik_live' | 'kemdikbud_referensi' | 'auto_provision';
  school?: ResolvedSchoolInfo;
  error?: string;
}

interface LoginViewProps {
  schools: SchoolProfileSummary[];
  defaultNpsn: string;
  isOnline: boolean;
  isLoading: boolean;
  errorMessage: string | null;
  onSubmitLogin: (payload: LoginSubmitPayload) => Promise<void>;
  onOpenGuide?: () => void;
}

export const LoginView: React.FC<LoginViewProps> = ({
  schools,
  defaultNpsn,
  isOnline,
  isLoading,
  errorMessage,
  onSubmitLogin,
  onOpenGuide,
}) => {
  const [selectedRole, setSelectedRole] = useState<AuthRole>('guru');
  const [npsnInput, setNpsnInput] = useState<string>(
    normalizeNpsnInput(defaultNpsn || schools[0]?.npsn || '')
  );
  const [username, setUsername] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const [lookupLoading, setLookupLoading] = useState<boolean>(false);
  const [lookupState, setLookupState] = useState<LookupNpsnResponse | null>(() => {
    const initial = schools.find((s) => s.npsn === defaultNpsn) || schools[0];
    if (!initial) return null;
    return {
      ok: true,
      npsn: initial.npsn,
      registered: true,
      source: 'vault',
      school: {
        namaSekolah: initial.namaSekolah,
        jenjang: initial.jenjang,
        kabupaten: initial.kabupaten,
        provinsi: initial.provinsi,
        sourceHost: initial.sourceHost,
        studentCount: initial.studentCount,
        rombelCount: initial.rombelCount,
      },
    };
  });

  const cleanNpsn = normalizeNpsnInput(npsnInput);

  useEffect(() => {
    if (cleanNpsn.length !== 8) {
      setLookupLoading(false);
      setLookupState(null);
      return;
    }

    const cachedSchool = schools.find((s) => s.npsn === cleanNpsn);
    if (cachedSchool) {
      setLookupLoading(false);
      setLookupState({
        ok: true,
        npsn: cleanNpsn,
        registered: true,
        source: 'vault',
        school: {
          namaSekolah: cachedSchool.namaSekolah,
          jenjang: cachedSchool.jenjang,
          kabupaten: cachedSchool.kabupaten,
          provinsi: cachedSchool.provinsi,
          sourceHost: cachedSchool.sourceHost,
          studentCount: cachedSchool.studentCount,
          rombelCount: cachedSchool.rombelCount,
        },
      });
      return;
    }

    if (!isOnline) {
      setLookupLoading(false);
      setLookupState({
        ok: true,
        npsn: cleanNpsn,
        registered: false,
        source: 'auto_provision',
        school: {
          npsn: cleanNpsn,
          namaSekolah: `Sekolah NPSN ${cleanNpsn}`,
          jenjang: 'SD',
        } as ResolvedSchoolInfo,
      });
      return;
    }

    let cancelled = false;
    const timer = window.setTimeout(async () => {
      setLookupLoading(true);
      try {
        const res = await fetch(
          `/api/dapodik/lookup-npsn?npsn=${encodeURIComponent(cleanNpsn)}`
        );
        const data = await safeParseJsonResponse<LookupNpsnResponse>(res, 'api');
        if (!cancelled && res.ok && data.ok) {
          setLookupState(data);
        }
      } catch {
        if (!cancelled) {
          setLookupState({
            ok: true,
            npsn: cleanNpsn,
            registered: false,
            source: 'auto_provision',
            school: {
              namaSekolah: `Sekolah NPSN ${cleanNpsn}`,
              jenjang: 'SD',
            },
          });
        }
      } finally {
        if (!cancelled) setLookupLoading(false);
      }
    }, 220);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [cleanNpsn, isOnline, schools]);

  const activeError = localError || errorMessage;

  const handleRoleSwitch = (nextRole: AuthRole) => {
    setSelectedRole(nextRole);
    setLocalError(null);
  };

  const handleNpsnChange = (raw: string) => {
    const clean = normalizeNpsnInput(raw);
    setNpsnInput(clean);
    setLocalError(null);
  };

  const handleFillPreset = (rolePreset: AuthRole) => {
    setSelectedRole(rolePreset);
    setUsername(rolePreset === 'guru' ? 'guru' : 'operator');
    setPassword(rolePreset === 'guru' ? 'guru123' : 'operator123');
    setLocalError(null);
  };

  const handleQuickDemoLogin = async (rolePreset: AuthRole) => {
    const npsnCheck = validateNpsnFormat(cleanNpsn);
    const targetNpsn = npsnCheck.valid
      ? npsnCheck.clean
      : schools[0]?.npsn || defaultNpsn;
    if (!npsnCheck.valid) {
      setNpsnInput(targetNpsn);
    }
    setSelectedRole(rolePreset);
    const userVal = rolePreset === 'guru' ? 'guru' : 'operator';
    const passVal = rolePreset === 'guru' ? 'guru123' : 'operator123';
    setUsername(userVal);
    setPassword(passVal);
    setLocalError(null);
    await onSubmitLogin({
      npsn: targetNpsn,
      username: userVal,
      password: passVal,
      expectedRole: rolePreset,
      resolvedSchool: lookupState?.school,
    });
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);

    const npsnCheck = validateNpsnFormat(cleanNpsn);
    if (!npsnCheck.valid) {
      setLocalError(npsnCheck.error || 'NPSN sekolah harus 8 digit angka.');
      return;
    }

    const trimmedUser = username.trim();
    if (!trimmedUser) {
      setLocalError('Masukkan username atau NIP akun Anda terlebih dahulu.');
      return;
    }
    if (!password || password.length < 4) {
      setLocalError('Masukkan kata sandi akun minimal 4 karakter.');
      return;
    }

    await onSubmitLogin({
      npsn: npsnCheck.clean,
      username: trimmedUser,
      password,
      expectedRole: selectedRole,
      resolvedSchool: lookupState?.school,
    });
  };

  return (
    <main className="min-h-screen bg-slate-900 px-4 py-8 flex items-center justify-center">
      <section
        aria-label="Kotak Login Aplikasi Raport"
        className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 text-slate-900 shadow-2xl"
      >
        <div className="text-center">
          <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 text-balance">
            Aplikasi Raport
          </h1>
          {!isOnline && (
            <p className="mt-1 text-xs font-medium text-amber-700">Mode Offline</p>
          )}
        </div>

        {/* Segmented Role Tabs */}
        <div
          role="tablist"
          aria-label="Pilih peran masuk aplikasi"
          className="mt-6 grid grid-cols-2 gap-1 rounded-lg bg-slate-100 p-1"
        >
          <button
            type="button"
            role="tab"
            aria-selected={selectedRole === 'guru'}
            onClick={() => handleRoleSwitch('guru')}
            className={`rounded-md px-3 py-2 text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
              selectedRole === 'guru'
                ? 'bg-slate-900 text-white'
                : 'text-slate-700 hover:text-slate-900'
            }`}
          >
            Guru / Wali Kelas
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={selectedRole === 'operator'}
            onClick={() => handleRoleSwitch('operator')}
            className={`rounded-md px-3 py-2 text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
              selectedRole === 'operator'
                ? 'bg-slate-900 text-white'
                : 'text-slate-700 hover:text-slate-900'
            }`}
          >
            Operator Sekolah
          </button>
        </div>

        {activeError && (
          <div
            role="alert"
            className="mt-4 flex items-start gap-2 rounded-lg border border-red-300 bg-red-50 px-3.5 py-2.5 text-xs font-medium text-red-900"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" aria-hidden="true" />
            <span>{activeError}</span>
          </div>
        )}

        <form onSubmit={(e) => void handleFormSubmit(e)} className="mt-5 space-y-4">
          <div>
            <label
              htmlFor="login-npsn"
              className="block text-xs font-semibold text-slate-800"
            >
              NPSN Sekolah (8 Digit)
            </label>
            <div className="relative mt-1.5">
              <input
                id="login-npsn"
                type="text"
                inputMode="numeric"
                maxLength={8}
                autoComplete="organization"
                value={cleanNpsn}
                onChange={(e) => handleNpsnChange(e.target.value)}
                placeholder="Contoh: 50102031"
                className="w-full rounded-lg border border-slate-300 bg-white py-2.5 pl-3 pr-16 font-mono text-sm font-semibold tabular-nums tracking-wider text-slate-900 placeholder:font-sans placeholder:font-normal placeholder:tracking-normal placeholder:text-slate-400 focus:border-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-700/20"
              />
              <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center font-mono text-[11px] tabular-nums text-slate-500">
                {lookupLoading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-700" aria-hidden="true" />
                ) : cleanNpsn.length === 8 ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" aria-hidden="true" />
                ) : (
                  `${cleanNpsn.length}/8`
                )}
              </span>
            </div>

            {/* Live NPSN & Dapodik auto-connect status */}
            <p
              aria-live="polite"
              className="mt-1.5 text-[11px] leading-snug text-slate-600"
            >
              {cleanNpsn.length < 8 ? (
                <span>Ketik 8 digit NPSN sekolah Anda untuk menyambung otomatis ke Dapodik.</span>
              ) : lookupLoading ? (
                <span className="text-blue-700 font-medium">
                  Memeriksa data sekolah &amp; koneksi Dapodik untuk NPSN {cleanNpsn}...
                </span>
              ) : lookupState?.dapodikReachable ? (
                <span className="font-medium text-emerald-700">
                  Dapodik Live Terdeteksi: {lookupState.school?.namaSekolah} (
                  {lookupState.school?.studentCount ?? 0} siswa)
                </span>
              ) : lookupState?.source === 'vault' ? (
                <span className="font-medium text-emerald-700">
                  {lookupState.school?.namaSekolah} ({lookupState.school?.jenjang}) · Otomatis sinkron Dapodik saat masuk
                </span>
              ) : lookupState?.source === 'kemdikbud_referensi' ? (
                <span className="font-medium text-emerald-700">
                  Terverifikasi Kemdikdasmen: {lookupState.school?.namaSekolah} ({lookupState.school?.jenjang}) · Siap sambung Dapodik
                </span>
              ) : (
                <span className="font-medium text-blue-700">
                  NPSN {cleanNpsn} siap didaftarkan &amp; disambungkan otomatis ke Dapodik sekolah saat masuk.
                </span>
              )}
            </p>
          </div>

          <div>
            <div className="flex items-center justify-between">
              <label
                htmlFor="login-username"
                className="block text-xs font-semibold text-slate-800"
              >
                Username atau NIP
              </label>
              <button
                type="button"
                onClick={() => handleFillPreset(selectedRole)}
                className="text-[11px] font-semibold text-blue-700 hover:underline cursor-pointer"
              >
                Isi akun {selectedRole === 'guru' ? 'guru' : 'operator'}
              </button>
            </div>
            <input
              id="login-username"
              type="text"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder={
                selectedRole === 'guru'
                  ? 'Masukkan username guru'
                  : 'Masukkan username operator'
              }
              className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-700/20"
            />
          </div>

          <div>
            <label
              htmlFor="login-password"
              className="block text-xs font-semibold text-slate-800"
            >
              Kata Sandi
            </label>
            <div className="relative mt-1.5">
              <input
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Masukkan kata sandi"
                className="w-full rounded-lg border border-slate-300 bg-white py-2.5 pl-3 pr-10 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-700/20"
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                aria-label={showPassword ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}
                className="absolute inset-y-0 right-0 flex items-center px-3 text-slate-500 hover:text-slate-800 cursor-pointer"
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" aria-hidden="true" />
                ) : (
                  <Eye className="h-4 w-4" aria-hidden="true" />
                )}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-800 disabled:opacity-50 cursor-pointer"
          >
            <LogIn className="h-4 w-4" aria-hidden="true" />
            <span>
              {isLoading
                ? 'Menghubungkan & Memeriksa...'
                : selectedRole === 'guru'
                  ? 'Masuk & Sambung Dapodik'
                  : 'Masuk sebagai Operator'}
            </span>
          </button>
        </form>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 pt-4 text-xs text-slate-600">
          <div className="flex items-center gap-2">
            <span>Demo:</span>
            <button
              type="button"
              disabled={isLoading}
              onClick={() => void handleQuickDemoLogin('guru')}
              className="font-semibold text-blue-700 hover:underline disabled:opacity-50 cursor-pointer"
            >
              Masuk Demo Guru
            </button>
            <span aria-hidden="true">·</span>
            <button
              type="button"
              disabled={isLoading}
              onClick={() => void handleQuickDemoLogin('operator')}
              className="font-semibold text-blue-700 hover:underline disabled:opacity-50 cursor-pointer"
            >
              Masuk Demo Operator
            </button>
          </div>

          {onOpenGuide && (
            <button
              type="button"
              onClick={onOpenGuide}
              className="font-semibold text-slate-600 hover:text-slate-900 hover:underline cursor-pointer"
            >
              Panduan
            </button>
          )}
        </div>
      </section>
    </main>
  );
};
