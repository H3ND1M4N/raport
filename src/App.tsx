import { useCallback, useEffect, useState } from 'react';
import {
  BookOpen,
  BookOpenCheck,
  Building2,
  ClipboardList,
  Database,
  FileText,
  Layers,
  LayoutDashboard,
  Lock,
  LogOut,
  Menu,
  RefreshCw,
  ShieldCheck,
  WifiOff,
  X,
} from 'lucide-react';
import { CurriculumMappingView } from './components/CurriculumMappingView';
import { DashboardView, type NavTabId } from './components/DashboardView';
import { DapodikSyncView } from './components/DapodikSyncView';
import { GradeInputView } from './components/GradeInputView';
import { LoginView, type LoginSubmitPayload } from './components/LoginView';
import { PanduanSinkronisasi } from './components/PanduanSinkronisasi';
import { PWAInstallButton } from './components/PWAInstallButton';
import { ReportsPrincipalView } from './components/ReportsPrincipalView';
import {
  SchoolProfileSyncView,
  type RegisterSchoolInput,
} from './components/SchoolProfileSyncView';
import { SecurityOfflineView } from './components/SecurityOfflineView';
import { WaliP5View } from './components/WaliP5View';
import {
  fetchDapodikFromBrowserDirect,
  fetchDapodikFromLocalRelay,
} from './lib/dapodikClient';
import { parseDapodikSpreadsheetBuffer } from './lib/dapodikExcel';
import {
  isLocalOrPrivateUrl,
  normalizeDapodikWebServiceUrl,
  parseDapodikImportText,
  safeParseJsonResponse,
  summarizeSchoolProfile,
  updateSubjectsKktp,
  type AuthUserAccount,
  type DapodikConnectionConfig,
  type DapodikSyncDiff,
  type DeepLearningLevel,
  type EraporDataset,
  type GuruSubmission,
  type SchoolProfileSummary,
  type StudentGradeRecord,
  type UserRole,
  type WaliKelasRecord,
} from './lib/eraporCore';
import {
  clearOfflineOutboxIds,
  enqueueOfflineMutation,
  getOfflineOutbox,
  loadEncryptedSnapshotOffline,
  saveEncryptedSnapshotOffline,
  type OutboxMutation,
  type SubjectKktpMutationPayload,
} from './lib/offlineSync';
import { createInitialDataset } from './lib/seedData';

const AUTH_TOKEN_KEY = 'erapor_session_token';
const AUTH_USER_KEY = 'erapor_session_user';

const NAV_ITEMS: {
  id: NavTabId;
  label: string;
  guruLabel?: string;
  operatorOnly?: boolean;
  icon: typeof LayoutDashboard;
}[] = [
  { id: 'dashboard', label: 'Dasbor & Antrean', guruLabel: 'Dasbor Guru', icon: LayoutDashboard },
  { id: 'schools', label: 'Sekolah & Multi-Dapodik', operatorOnly: true, icon: Building2 },
  { id: 'dapodik', label: 'Referensi Dapodik', operatorOnly: true, icon: Database },
  { id: 'curriculum', label: 'Mapel, Guru & TP', icon: Layers },
  { id: 'grades', label: 'Input Nilai & TP', icon: BookOpenCheck },
  { id: 'wali', label: 'Wali & Kokurikuler', icon: ClipboardList },
  { id: 'reports', label: 'Cetak Rapor & Leger', guruLabel: 'Pratinjau Rapor', icon: FileText },
  { id: 'security', label: 'Enkripsi & Offline', icon: Lock },
];

export default function App() {
  const [dataset, setDataset] = useState<EraporDataset>(() => createInitialDataset());
  const [schools, setSchools] = useState<SchoolProfileSummary[]>(() => [
    summarizeSchoolProfile(createInitialDataset()),
  ]);
  const [activeNpsn, setActiveNpsn] = useState<string>(
    () => createInitialDataset().school.npsn
  );
  const [vaultMeta, setVaultMeta] = useState<{
    algorithm: string;
    sha256: string;
    updatedAt: string;
  } | null>(null);
  const [activeTab, setActiveTab] = useState<NavTabId>('dashboard');
  const [role, setRole] = useState<UserRole>('guru');
  const [preselectedRombelId, setPreselectedRombelId] = useState<string | undefined>(
    undefined
  );

  const [isBrowserOnline, setIsBrowserOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [simulatedOffline, setSimulatedOffline] = useState(false);
  const [outbox, setOutbox] = useState<OutboxMutation[]>([]);
  const [passphrase, setPassphrase] = useState('');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isSyncingDapodik, setIsSyncingDapodik] = useState(false);
  const [syncNotice, setSyncNotice] = useState<string | null>(null);
  const [connectionConfig, setConnectionConfig] =
    useState<DapodikConnectionConfig | null>(null);
  const [showGlobalGuide, setShowGlobalGuide] = useState(false);

  // Auth session state
  const [authUser, setAuthUser] = useState<AuthUserAccount | null>(() => {
    try {
      const raw = localStorage.getItem(AUTH_USER_KEY);
      return raw ? (JSON.parse(raw) as AuthUserAccount) : null;
    } catch {
      return null;
    }
  });
  const [authChecked, setAuthChecked] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [directPrintBanner, setDirectPrintBanner] = useState<string | null>(null);

  const effectiveOnline = isBrowserOnline && !simulatedOffline;

  // Browser online/offline listeners
  useEffect(() => {
    const handleOnline = () => setIsBrowserOnline(true);
    const handleOffline = () => setIsBrowserOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Load public school directory & restore/verify auth session
  useEffect(() => {
    let active = true;
    async function checkAuthSession() {
      try {
        const infoRes = await fetch('/api/auth/public-info');
        if (infoRes.ok) {
          const info = await safeParseJsonResponse<{
            activeNpsn?: string;
            schools?: SchoolProfileSummary[];
          }>(infoRes, 'api');
          if (active && info.schools && info.schools.length > 0) {
            setSchools(info.schools);
            if (info.activeNpsn) setActiveNpsn(info.activeNpsn);
          }
        }
      } catch {
        // Offline fallback keeps initial seed school summary
      }

      const params = new URLSearchParams(window.location.search);
      const autostart = params.get('autostart');
      if (autostart) {
        const autoRole = autostart === 'guru' ? 'guru' : 'operator';
        try {
          const loginRes = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              username: autoRole,
              password: autoRole === 'guru' ? 'guru123' : 'operator123',
              expectedRole: autoRole,
            }),
          });
          if (loginRes.ok && active) {
            const loginData = await safeParseJsonResponse<{
              ok: boolean;
              token: string;
              user: AuthUserAccount;
              dataset: EraporDataset;
              vaultMeta: { algorithm: string; sha256: string; updatedAt: string };
              activeNpsn: string;
              schools: SchoolProfileSummary[];
              connectionConfig?: DapodikConnectionConfig | null;
            }>(loginRes, 'api');
            localStorage.setItem(AUTH_TOKEN_KEY, loginData.token);
            localStorage.setItem(AUTH_USER_KEY, JSON.stringify(loginData.user));
            setAuthUser(loginData.user);
            setRole(loginData.user.role);
            setDataset(loginData.dataset);
            setVaultMeta(loginData.vaultMeta);
            setActiveNpsn(loginData.activeNpsn);
            setSchools(loginData.schools);
            if (loginData.connectionConfig !== undefined) {
              setConnectionConfig(loginData.connectionConfig);
            }
          }
        } catch {
          // Ignore autostart failure
        } finally {
          if (active) setAuthChecked(true);
        }
        return;
      }

      const storedToken = localStorage.getItem(AUTH_TOKEN_KEY);
      if (!storedToken) {
        if (active) {
          setAuthUser(null);
          setAuthChecked(true);
        }
        return;
      }

      try {
        const meRes = await fetch('/api/auth/me', {
          headers: { Authorization: `Bearer ${storedToken}` },
        });
        if (!meRes.ok) {
          localStorage.removeItem(AUTH_TOKEN_KEY);
          localStorage.removeItem(AUTH_USER_KEY);
          if (active) setAuthUser(null);
        } else {
          const me = await safeParseJsonResponse<{ ok: boolean; user: AuthUserAccount }>(
            meRes,
            'api'
          );
          if (active && me.ok && me.user) {
            setAuthUser(me.user);
            setRole(me.user.role);
            setActiveNpsn(me.user.schoolNpsn);
            localStorage.setItem(AUTH_USER_KEY, JSON.stringify(me.user));
          }
        }
      } catch {
        // Offline mode: keep cached localStorage authUser if present
      } finally {
        if (active) setAuthChecked(true);
      }
    }
    void checkAuthSession();
    return () => {
      active = false;
    };
  }, []);

  // Load initial state from Server or Encrypted IndexedDB Offline Vault
  useEffect(() => {
    let active = true;
    async function bootstrap() {
      try {
        const res = await fetch('/api/state');
        if (!res.ok) throw new Error('Server unreachable');
        const data = await safeParseJsonResponse<{
          dataset: EraporDataset;
          vaultMeta: { algorithm: string; sha256: string; updatedAt: string };
          activeNpsn?: string;
          schools?: SchoolProfileSummary[];
          connectionConfig?: DapodikConnectionConfig | null;
        }>(res, 'api');
        if (!active) return;

        const targetNpsn = data.activeNpsn || data.dataset.school.npsn;
        setActiveNpsn(targetNpsn);
        if (data.connectionConfig !== undefined) {
          setConnectionConfig(data.connectionConfig);
        }
        if (data.schools && data.schools.length > 0) {
          setSchools(data.schools);
        } else {
          setSchools([summarizeSchoolProfile(data.dataset)]);
        }

        const pending = await getOfflineOutbox(targetNpsn).catch(() => []);
        if (active) setOutbox(pending);

        // If we have local offline snapshot with pending mutations for this NPSN, preserve local edits until flushed
        if (pending.length > 0) {
          const offlineCached = await loadEncryptedSnapshotOffline(
            targetNpsn,
            passphrase || undefined
          ).catch(() => null);
          if (offlineCached && active) {
            setDataset(offlineCached.dataset);
            setVaultMeta(data.vaultMeta);
            return;
          }
        }

        setDataset(data.dataset);
        setVaultMeta(data.vaultMeta);
        await saveEncryptedSnapshotOffline(data.dataset, passphrase || undefined).catch(
          () => undefined
        );
      } catch {
        const pending = await getOfflineOutbox(activeNpsn).catch(() => []);
        if (active) setOutbox(pending);
        const offlineCached = await loadEncryptedSnapshotOffline(
          activeNpsn,
          passphrase || undefined
        ).catch(() => null);
        if (offlineCached && active) {
          setDataset(offlineCached.dataset);
        }
      }
    }
    void bootstrap();
    return () => {
      active = false;
    };
  }, [passphrase, activeNpsn]);

  const flushOutbox = useCallback(async () => {
    if (!effectiveOnline) return;
    const currentOutbox = await getOfflineOutbox(dataset.school.npsn).catch(() => []);
    if (currentOutbox.length === 0) return;

    const grades: StudentGradeRecord[] = [];
    const waliRecords: WaliKelasRecord[] = [];
    const subjectKktpUpdates: Array<{ mapelId: string; kktp: number }> = [];
    for (const item of currentOutbox) {
      if (item.type === 'UPSERT_GRADE') {
        grades.push(item.payload as StudentGradeRecord);
      } else if (item.type === 'UPSERT_WALI') {
        waliRecords.push(item.payload as WaliKelasRecord);
      } else if (item.type === 'UPDATE_SUBJECT_KKTP') {
        const kktpPayload = item.payload as SubjectKktpMutationPayload;
        if (Array.isArray(kktpPayload.updates)) {
          subjectKktpUpdates.push(...kktpPayload.updates);
        }
      }
    }

    const res = await fetch('/api/rapor/sync-batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        schoolNpsn: dataset.school.npsn,
        grades,
        waliRecords,
        subjectKktpUpdates,
        actor: 'Auto-Sync Antrean Offline',
      }),
    });

    if (!res.ok) {
      throw new Error('Gagal mengirim antrean sinkronisasi ke server.');
    }

    const data = await safeParseJsonResponse<{
      dataset: EraporDataset;
      vaultMeta: { algorithm: string; sha256: string; updatedAt: string };
    }>(res, 'api');

    await clearOfflineOutboxIds(currentOutbox.map((m) => m.id));
    setOutbox([]);
    setDataset(data.dataset);
    setVaultMeta(data.vaultMeta);
    await saveEncryptedSnapshotOffline(data.dataset, passphrase || undefined).catch(
      () => undefined
    );
    setSyncNotice(
      `${currentOutbox.length} perubahan offline berhasil disinkronkan secara otomatis.`
    );
  }, [effectiveOnline, passphrase, dataset.school.npsn]);

  // Auto-flush whenever connection returns online
  useEffect(() => {
    if (effectiveOnline && outbox.length > 0) {
      void flushOutbox().catch(() => undefined);
    }
  }, [effectiveOnline, outbox.length, flushOutbox]);

  // Real-time SSE listener when online
  useEffect(() => {
    if (!effectiveOnline) return;
    const source = new EventSource('/api/sync/events');
    const handleDatasetUpdated = (evt: MessageEvent) => {
      try {
        const parsed = JSON.parse(evt.data) as {
          type?: string;
          activeNpsn?: string;
          diff?: DapodikSyncDiff;
          dataset?: EraporDataset;
          schools?: SchoolProfileSummary[];
          connectionConfig?: DapodikConnectionConfig | null;
        };
        if (parsed.schools) {
          setSchools(parsed.schools);
        }
        if (parsed.activeNpsn) {
          setActiveNpsn(parsed.activeNpsn);
        }
        if (parsed.connectionConfig !== undefined) {
          setConnectionConfig(parsed.connectionConfig);
        }
        if (parsed.dataset && (outbox.length === 0 || parsed.type === 'SCHOOL_SWITCHED')) {
          setDataset(parsed.dataset);
          void saveEncryptedSnapshotOffline(
            parsed.dataset,
            passphrase || undefined
          ).catch(() => undefined);
          if (
            (parsed.type === 'DAPODIK_BRIDGE_SYNC' || parsed.type === 'DAPODIK_AUTO_SYNC') &&
            parsed.diff &&
            (parsed.diff.addedStudents > 0 ||
              parsed.diff.updatedStudents > 0 ||
              parsed.diff.movedRombelStudents > 0)
          ) {
            setSyncNotice(
              `Sinkronisasi real-time Dapodik diterima: +${parsed.diff.addedStudents} siswa baru, ${parsed.diff.updatedStudents} diperbarui.`
            );
          }
        }
      } catch {
        // Ignore malformed frame
      }
    };
    source.addEventListener('dataset_updated', handleDatasetUpdated);
    return () => {
      source.removeEventListener('dataset_updated', handleDatasetUpdated);
      source.close();
    };
  }, [effectiveOnline, outbox.length, passphrase]);

  // Browser-side real-time auto-poller when school Dapodik runs on local/LAN host and autoSyncEnabled is active
  useEffect(() => {
    if (
      !effectiveOnline ||
      !connectionConfig?.autoSyncEnabled ||
      !isLocalOrPrivateUrl(connectionConfig.sourceHost)
    ) {
      return;
    }

    let cancelled = false;
    let inFlight = false;
    const intervalMs = Math.max(10, connectionConfig.autoSyncIntervalSec || 30) * 1000;

    const runPoll = async () => {
      if (cancelled || inFlight) return;
      inFlight = true;
      try {
        const live = await fetchDapodikFromLocalRelay({
          npsn: dataset.school.npsn,
          fallbackSchoolName: dataset.school.namaSekolah,
        }).catch(() =>
          fetchDapodikFromBrowserDirect({
            hostUrl: connectionConfig.sourceHost,
            npsn: dataset.school.npsn,
            fallbackSchoolName: dataset.school.namaSekolah,
          })
        );
        if (cancelled) return;
        const res = await fetch('/api/dapodik/import-json', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...live.payload,
            syncChannel: 'browser_direct',
          }),
        });
        if (res.ok && !cancelled) {
          const data = await safeParseJsonResponse<{
            ok?: boolean;
            dataset?: EraporDataset;
            vaultMeta?: { algorithm: string; sha256: string; updatedAt: string };
            schools?: SchoolProfileSummary[];
            connectionConfig?: DapodikConnectionConfig;
          }>(res, 'api');
          if (data.ok && data.dataset) {
            setDataset(data.dataset);
            if (data.vaultMeta) setVaultMeta(data.vaultMeta);
            if (data.schools) setSchools(data.schools);
            if (data.connectionConfig) setConnectionConfig(data.connectionConfig);
          }
        }
      } catch {
        // Silently skip when local Dapodik PC is unreachable from browser (e.g. Bridge handles it)
      } finally {
        inFlight = false;
      }
    };

    const id = window.setInterval(() => {
      void runPoll();
    }, intervalMs);

    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [
    effectiveOnline,
    connectionConfig?.autoSyncEnabled,
    connectionConfig?.autoSyncIntervalSec,
    connectionConfig?.sourceHost,
    dataset.school.npsn,
    dataset.school.namaSekolah,
  ]);

  const handleSaveGrade = async (record: StudentGradeRecord) => {
    const markedRecord: StudentGradeRecord = {
      ...record,
      syncStatus: effectiveOnline ? 'synced' : 'pending',
    };

    let nextDatasetSnapshot: EraporDataset | null = null;
    setDataset((prev) => {
      const exists = prev.grades.some((g) => g.id === markedRecord.id);
      const nextGrades = exists
        ? prev.grades.map((g) => (g.id === markedRecord.id ? markedRecord : g))
        : [...prev.grades, markedRecord];
      nextDatasetSnapshot = { ...prev, grades: nextGrades };
      return nextDatasetSnapshot;
    });

    if (nextDatasetSnapshot) {
      await saveEncryptedSnapshotOffline(
        nextDatasetSnapshot,
        passphrase || undefined
      ).catch(() => undefined);
    }

    if (effectiveOnline) {
      try {
        const res = await fetch('/api/rapor/sync-batch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            schoolNpsn: dataset.school.npsn,
            grades: [markedRecord],
            actor: record.updatedBy,
          }),
        });
        if (!res.ok) throw new Error('Offline fallback');
        const data = await safeParseJsonResponse<{
          dataset: EraporDataset;
          vaultMeta: { algorithm: string; sha256: string; updatedAt: string };
        }>(res, 'api');
        setDataset(data.dataset);
        setVaultMeta(data.vaultMeta);
        return;
      } catch {
        // Queue in IndexedDB outbox if network request failed
      }
    }

    const pendingRecord: StudentGradeRecord = { ...markedRecord, syncStatus: 'pending' };
    setDataset((prev) => ({
      ...prev,
      grades: prev.grades.map((g) => (g.id === pendingRecord.id ? pendingRecord : g)),
    }));
    const mutation: OutboxMutation = {
      id: `${dataset.school.npsn}:${pendingRecord.id}`,
      schoolNpsn: dataset.school.npsn,
      type: 'UPSERT_GRADE',
      payload: pendingRecord,
      createdAt: new Date().toISOString(),
    };
    await enqueueOfflineMutation(mutation);
    setOutbox(await getOfflineOutbox(dataset.school.npsn));
  };

  const handleSaveWali = async (record: WaliKelasRecord) => {
    const markedRecord: WaliKelasRecord = {
      ...record,
      syncStatus: effectiveOnline ? 'synced' : 'pending',
    };

    let nextDatasetSnapshot: EraporDataset | null = null;
    setDataset((prev) => {
      const exists = prev.waliRecords.some((w) => w.id === markedRecord.id);
      const nextWali = exists
        ? prev.waliRecords.map((w) => (w.id === markedRecord.id ? markedRecord : w))
        : [...prev.waliRecords, markedRecord];
      nextDatasetSnapshot = { ...prev, waliRecords: nextWali };
      return nextDatasetSnapshot;
    });

    if (nextDatasetSnapshot) {
      await saveEncryptedSnapshotOffline(
        nextDatasetSnapshot,
        passphrase || undefined
      ).catch(() => undefined);
    }

    if (effectiveOnline) {
      try {
        const res = await fetch('/api/rapor/sync-batch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            schoolNpsn: dataset.school.npsn,
            waliRecords: [markedRecord],
            actor: 'Wali Kelas',
          }),
        });
        if (!res.ok) throw new Error('Offline fallback');
        const data = await safeParseJsonResponse<{
          dataset: EraporDataset;
          vaultMeta: { algorithm: string; sha256: string; updatedAt: string };
        }>(res, 'api');
        setDataset(data.dataset);
        setVaultMeta(data.vaultMeta);
        return;
      } catch {
        // Queue offline
      }
    }

    const pendingRecord: WaliKelasRecord = { ...markedRecord, syncStatus: 'pending' };
    const mutation: OutboxMutation = {
      id: `${dataset.school.npsn}:${pendingRecord.id}`,
      schoolNpsn: dataset.school.npsn,
      type: 'UPSERT_WALI',
      payload: pendingRecord,
      createdAt: new Date().toISOString(),
    };
    await enqueueOfflineMutation(mutation);
    setOutbox(await getOfflineOutbox(dataset.school.npsn));
  };

  const handleUpdateSubjectsKktp = async (
    updates: Array<{ mapelId: string; kktp: number }>
  ): Promise<{ recalculatedGradesCount: number }> => {
    const actor = authUser?.displayName || 'Guru Mata Pelajaran';
    const localResult = updateSubjectsKktp(dataset, { updates, actor });
    setDataset(localResult.nextDataset);
    await saveEncryptedSnapshotOffline(
      localResult.nextDataset,
      passphrase || undefined
    ).catch(() => undefined);

    if (effectiveOnline) {
      try {
        const res = await fetch('/api/rapor/subject-kktp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            schoolNpsn: dataset.school.npsn,
            updates,
            actor,
          }),
        });
        const data = await safeParseJsonResponse<{
          ok?: boolean;
          error?: string;
          recalculatedGradesCount?: number;
          dataset?: EraporDataset;
          vaultMeta?: { algorithm: string; sha256: string; updatedAt: string };
        }>(res, 'api');
        if (!res.ok || !data.ok || !data.dataset) {
          throw new Error(data.error || 'Gagal menyimpan perubahan KKTP.');
        }
        setDataset(data.dataset);
        if (data.vaultMeta) setVaultMeta(data.vaultMeta);
        await saveEncryptedSnapshotOffline(
          data.dataset,
          passphrase || undefined
        ).catch(() => undefined);
        return {
          recalculatedGradesCount:
            data.recalculatedGradesCount ?? localResult.recalculatedGradesCount,
        };
      } catch (err) {
        if (err instanceof Error && err.message.includes('KKTP')) {
          throw err;
        }
      }
    }

    const mutation: OutboxMutation = {
      id: `${dataset.school.npsn}:kktp-${Date.now()}`,
      schoolNpsn: dataset.school.npsn,
      type: 'UPDATE_SUBJECT_KKTP',
      payload: { updates, actor },
      createdAt: new Date().toISOString(),
    };
    await enqueueOfflineMutation(mutation);
    setOutbox(await getOfflineOutbox(dataset.school.npsn));
    return { recalculatedGradesCount: localResult.recalculatedGradesCount };
  };

  const handleSaveGradesBatch = async (records: StudentGradeRecord[]) => {
    if (records.length === 0) return;
    const markedRecords: StudentGradeRecord[] = records.map((r) => ({
      ...r,
      syncStatus: effectiveOnline ? 'synced' : 'pending',
    }));

    let nextSnapshot: EraporDataset | null = null;
    setDataset((prev) => {
      const byId = new Map(prev.grades.map((g) => [g.id, g]));
      for (const rec of markedRecords) {
        byId.set(rec.id, rec);
      }
      nextSnapshot = { ...prev, grades: Array.from(byId.values()) };
      return nextSnapshot;
    });

    if (nextSnapshot) {
      await saveEncryptedSnapshotOffline(
        nextSnapshot,
        passphrase || undefined
      ).catch(() => undefined);
    }

    if (effectiveOnline) {
      try {
        const res = await fetch('/api/rapor/sync-batch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            schoolNpsn: dataset.school.npsn,
            grades: markedRecords,
            actor: authUser?.displayName || 'Impor Excel Nilai Guru',
          }),
        });
        if (!res.ok) throw new Error('Offline fallback');
        const data = await safeParseJsonResponse<{
          dataset: EraporDataset;
          vaultMeta: { algorithm: string; sha256: string; updatedAt: string };
        }>(res, 'api');
        setDataset(data.dataset);
        setVaultMeta(data.vaultMeta);
        return;
      } catch {
        // Fallback to offline outbox
      }
    }

    for (const rec of markedRecords) {
      await enqueueOfflineMutation({
        id: `${dataset.school.npsn}:${rec.id}`,
        schoolNpsn: dataset.school.npsn,
        type: 'UPSERT_GRADE',
        payload: { ...rec, syncStatus: 'pending' },
        createdAt: new Date().toISOString(),
      });
    }
    setOutbox(await getOfflineOutbox(dataset.school.npsn));
  };

  const handleSaveSubjectMapping = async (params: {
    id?: string;
    kode: string;
    nama: string;
    kelompok: 'Umum' | 'Muatan Lokal' | 'Pilihan';
    kkm: number;
    guruPengampu: string;
    nipGuru?: string;
  }) => {
    const res = await fetch('/api/rapor/subject-mapping', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        schoolNpsn: dataset.school.npsn,
        ...params,
        actor: authUser?.displayName || 'Operator / Guru',
      }),
    });
    const data = await safeParseJsonResponse<{
      ok?: boolean;
      error?: string;
      dataset?: EraporDataset;
      vaultMeta?: { algorithm: string; sha256: string; updatedAt: string };
    }>(res, 'api');
    if (!res.ok || !data.ok || !data.dataset) {
      throw new Error(data.error || 'Gagal menyimpan pemetaan mata pelajaran.');
    }
    setDataset(data.dataset);
    if (data.vaultMeta) setVaultMeta(data.vaultMeta);
    await saveEncryptedSnapshotOffline(data.dataset, passphrase || undefined).catch(
      () => undefined
    );
  };

  const handleSaveTp = async (params: {
    id?: string;
    mapelId: string;
    tingkat: number;
    kode: string;
    deskripsi: string;
    levelMendalam?: DeepLearningLevel;
    dimensiProfil?: string[];
  }) => {
    const res = await fetch('/api/rapor/tp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        schoolNpsn: dataset.school.npsn,
        action: 'upsert',
        ...params,
        actor: authUser?.displayName || 'Guru Mata Pelajaran',
      }),
    });
    const data = await safeParseJsonResponse<{
      ok?: boolean;
      error?: string;
      dataset?: EraporDataset;
      vaultMeta?: { algorithm: string; sha256: string; updatedAt: string };
    }>(res, 'api');
    if (!res.ok || !data.ok || !data.dataset) {
      throw new Error(data.error || 'Gagal menyimpan Tujuan Pembelajaran.');
    }
    setDataset(data.dataset);
    if (data.vaultMeta) setVaultMeta(data.vaultMeta);
    await saveEncryptedSnapshotOffline(data.dataset, passphrase || undefined).catch(
      () => undefined
    );
  };

  const handleDeleteTp = async (tpId: string) => {
    const res = await fetch('/api/rapor/tp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        schoolNpsn: dataset.school.npsn,
        action: 'delete',
        id: tpId,
        actor: authUser?.displayName || 'Guru / Operator',
      }),
    });
    const data = await safeParseJsonResponse<{
      ok?: boolean;
      error?: string;
      dataset?: EraporDataset;
      vaultMeta?: { algorithm: string; sha256: string; updatedAt: string };
    }>(res, 'api');
    if (!res.ok || !data.ok || !data.dataset) {
      throw new Error(data.error || 'Gagal menghapus Tujuan Pembelajaran.');
    }
    setDataset(data.dataset);
    if (data.vaultMeta) setVaultMeta(data.vaultMeta);
    await saveEncryptedSnapshotOffline(data.dataset, passphrase || undefined).catch(
      () => undefined
    );
  };

  const handleActivateKka = async (): Promise<{
    alreadyActive: boolean;
    addedTpCount: number;
  }> => {
    const res = await fetch('/api/rapor/activate-kka', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        schoolNpsn: dataset.school.npsn,
        actor: authUser?.displayName || 'Operator / Kurikulum Sekolah',
      }),
    });
    const data = await safeParseJsonResponse<{
      ok?: boolean;
      error?: string;
      alreadyActive?: boolean;
      addedTpCount?: number;
      dataset?: EraporDataset;
      vaultMeta?: { algorithm: string; sha256: string; updatedAt: string };
    }>(res, 'api');
    if (!res.ok || !data.ok || !data.dataset) {
      throw new Error(data.error || 'Gagal mengaktifkan mata pelajaran KKA 2026.');
    }
    setDataset(data.dataset);
    if (data.vaultMeta) setVaultMeta(data.vaultMeta);
    await saveEncryptedSnapshotOffline(data.dataset, passphrase || undefined).catch(
      () => undefined
    );
    return {
      alreadyActive: Boolean(data.alreadyActive),
      addedTpCount: data.addedTpCount ?? 0,
    };
  };

  const handleSaveDapodikConfig = useCallback(
    async (patch: {
      hostUrl?: string;
      token?: string;
      autoSyncEnabled?: boolean;
      autoSyncIntervalSec?: number;
    }): Promise<DapodikConnectionConfig> => {
      const res = await fetch('/api/dapodik/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          npsn: dataset.school.npsn,
          ...patch,
        }),
      });
      const data = await safeParseJsonResponse<{
        ok?: boolean;
        error?: string;
        connectionConfig?: DapodikConnectionConfig;
      }>(res, 'api');
      if (!res.ok || !data.ok || !data.connectionConfig) {
        throw new Error(data.error || 'Gagal menyimpan konfigurasi Dapodik.');
      }
      setConnectionConfig(data.connectionConfig);
      if (data.connectionConfig.sourceHost) {
        setDataset((prev) => ({
          ...prev,
          school: {
            ...prev.school,
            sourceHost: data.connectionConfig!.sourceHost,
          },
        }));
      }
      return data.connectionConfig;
    },
    [dataset.school.npsn]
  );

  const handleSyncLiveDapodik = async (params: {
    hostUrl: string;
    npsn: string;
    token: string;
    mode: 'live' | 'simulate_delta';
  }): Promise<DapodikSyncDiff | null> => {
    setIsSyncingDapodik(true);
    try {
      const res = await fetch('/api/dapodik/sync-live', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });
      const data = await safeParseJsonResponse<{
        ok?: boolean;
        error?: string;
        needsLocalBridge?: boolean;
        diff?: DapodikSyncDiff;
        dataset?: EraporDataset;
        vaultMeta?: { algorithm: string; sha256: string; updatedAt: string };
        schools?: SchoolProfileSummary[];
        connectionConfig?: DapodikConnectionConfig;
      }>(res, 'api');

      if (params.mode === 'live' && (!res.ok || !data.ok) && data.needsLocalBridge) {
        const cleanHost = normalizeDapodikWebServiceUrl(params.hostUrl);
        try {
          // Try Local CORS Relay (127.0.0.1:5775) first, then direct WebService fetch
          const browserLive = await fetchDapodikFromLocalRelay({
            npsn: params.npsn,
            fallbackSchoolName: dataset.school.namaSekolah,
          }).catch(() =>
            fetchDapodikFromBrowserDirect({
              hostUrl: cleanHost,
              npsn: params.npsn,
              token: params.token,
              fallbackSchoolName: dataset.school.namaSekolah,
            })
          );
          const importRes = await fetch('/api/dapodik/import-json', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              ...browserLive.payload,
              syncChannel: 'browser_direct',
            }),
          });
          const importData = await safeParseJsonResponse<{
            ok?: boolean;
            error?: string;
            diff?: DapodikSyncDiff;
            dataset?: EraporDataset;
            vaultMeta?: { algorithm: string; sha256: string; updatedAt: string };
            schools?: SchoolProfileSummary[];
            connectionConfig?: DapodikConnectionConfig;
          }>(importRes, 'api');
          if (!importRes.ok || !importData.ok || !importData.dataset) {
            throw new Error(importData.error || 'Gagal menyimpan data dari Dapodik lokal.');
          }
          setDataset(importData.dataset);
          if (importData.vaultMeta) setVaultMeta(importData.vaultMeta);
          if (importData.schools) setSchools(importData.schools);
          if (importData.connectionConfig) setConnectionConfig(importData.connectionConfig);
          await saveEncryptedSnapshotOffline(
            importData.dataset,
            passphrase || undefined
          ).catch(() => undefined);
          return importData.diff ?? null;
        } catch (browserErr) {
          const browserMsg = browserErr instanceof Error ? browserErr.message : '';
          if (browserMsg.includes('Token') || browserMsg.includes('HTML')) {
            throw new Error(browserMsg);
          }
          if (data.error && data.error.includes('HTML')) {
            throw new Error(data.error);
          }
          throw new Error(
            `Alamat lokal (${cleanHost}) tidak dapat diakses langsung oleh server cloud. Gunakan Cara 1 (Upload Excel .xlsx/.csv langsung tanpa Token) atau Cara 2 (jalankan Penyambung Lokal 127.0.0.1:5775 di PC Dapodik).`
          );
        }
      }

      if (!res.ok || !data.ok || !data.dataset) {
        throw new Error(data.error || 'Gagal menyinkronkan data Dapodik.');
      }
      setDataset(data.dataset);
      if (data.vaultMeta) setVaultMeta(data.vaultMeta);
      if (data.schools) setSchools(data.schools);
      if (data.connectionConfig) setConnectionConfig(data.connectionConfig);
      await saveEncryptedSnapshotOffline(data.dataset, passphrase || undefined).catch(
        () => undefined
      );
      return data.diff ?? null;
    } finally {
      setIsSyncingDapodik(false);
    }
  };

  const submitImportedPayload = async (
    parsed: ReturnType<typeof parseDapodikImportText>,
    syncChannel: 'file_import' | 'local_bridge' | 'browser_direct' = 'file_import'
  ): Promise<DapodikSyncDiff | null> => {
    const res = await fetch('/api/dapodik/import-json', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...parsed, syncChannel }),
    });
    const data = await safeParseJsonResponse<{
      ok?: boolean;
      error?: string;
      diff?: DapodikSyncDiff;
      dataset?: EraporDataset;
      vaultMeta?: { algorithm: string; sha256: string; updatedAt: string };
      schools?: SchoolProfileSummary[];
      connectionConfig?: DapodikConnectionConfig;
    }>(res, 'api');
    if (!res.ok || !data.ok || !data.dataset) {
      throw new Error(data.error || 'Impor data Dapodik gagal.');
    }
    setDataset(data.dataset);
    if (data.vaultMeta) setVaultMeta(data.vaultMeta);
    if (data.schools) setSchools(data.schools);
    if (data.connectionConfig) setConnectionConfig(data.connectionConfig);
    await saveEncryptedSnapshotOffline(data.dataset, passphrase || undefined).catch(
      () => undefined
    );
    return data.diff ?? null;
  };

  const handleImportDapodikJson = async (
    rawText: string
  ): Promise<DapodikSyncDiff | null> => {
    const parsed = parseDapodikImportText(rawText, {
      npsn: dataset.school.npsn,
      namaSekolah: dataset.school.namaSekolah,
      kurikulum: dataset.school.kurikulum,
    });
    return submitImportedPayload(parsed, 'file_import');
  };

  const handleImportDapodikFile = async (
    file: File
  ): Promise<DapodikSyncDiff | null> => {
    const lowerName = file.name.toLowerCase();
    if (lowerName.endsWith('.xlsx') || lowerName.endsWith('.xls')) {
      const buffer = await file.arrayBuffer();
      const parsed = parseDapodikSpreadsheetBuffer(buffer, {
        npsn: dataset.school.npsn,
        namaSekolah: dataset.school.namaSekolah,
        kurikulum: dataset.school.kurikulum,
      });
      return submitImportedPayload(parsed, 'file_import');
    }
    const text = await file.text();
    return handleImportDapodikJson(text);
  };

  const handleSyncLocalRelay = async (): Promise<DapodikSyncDiff | null> => {
    setIsSyncingDapodik(true);
    try {
      const live = await fetchDapodikFromLocalRelay({
        npsn: dataset.school.npsn,
        fallbackSchoolName: dataset.school.namaSekolah,
      });
      return await submitImportedPayload(live.payload, 'local_bridge');
    } finally {
      setIsSyncingDapodik(false);
    }
  };

  const handleRegisterSchool = async (input: RegisterSchoolInput): Promise<void> => {
    const res = await fetch('/api/schools/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    const data = await safeParseJsonResponse<{
      ok?: boolean;
      error?: string;
      dataset?: EraporDataset;
      vaultMeta?: { algorithm: string; sha256: string; updatedAt: string };
      activeNpsn?: string;
      schools?: SchoolProfileSummary[];
      connectionConfig?: DapodikConnectionConfig;
    }>(res, 'api');
    if (!res.ok || !data.ok || !data.dataset) {
      throw new Error(data.error || 'Gagal mendaftarkan profil sekolah.');
    }
    setPreselectedRombelId(undefined);
    setActiveNpsn(data.activeNpsn || data.dataset.school.npsn);
    setDataset(data.dataset);
    if (data.vaultMeta) setVaultMeta(data.vaultMeta);
    if (data.schools) setSchools(data.schools);
    if (data.connectionConfig) setConnectionConfig(data.connectionConfig);
    await saveEncryptedSnapshotOffline(data.dataset, passphrase || undefined).catch(
      () => undefined
    );
    setOutbox([]);
    setSyncNotice(
      `Profil ${data.dataset.school.namaSekolah} (NPSN ${data.dataset.school.npsn}) berhasil dibuat & diaktifkan.`
    );
  };

  const handleTestSchoolConnection = async (params: {
    hostUrl: string;
    npsn: string;
    token: string;
  }) => {
    const res = await fetch('/api/schools/test-connection', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    const serverResult = await safeParseJsonResponse<{
      reachable: boolean;
      needsLocalBridge?: boolean;
      detectedSchoolName?: string;
      rombelCount?: number;
      studentCount?: number;
      error?: string;
    }>(res, 'api');

    if (!serverResult.reachable && serverResult.needsLocalBridge) {
      try {
        const direct = await fetchDapodikFromBrowserDirect({
          hostUrl: params.hostUrl,
          npsn: params.npsn,
          token: params.token,
        });
        return {
          reachable: true,
          detectedSchoolName: `${direct.detectedSchoolName} (via Browser-Direct)`,
          rombelCount: direct.rombelCount,
          studentCount: direct.studentCount,
        };
      } catch {
        return serverResult;
      }
    }

    return serverResult;
  };

  const handleLoginSubmit = async (payload: LoginSubmitPayload): Promise<void> => {
    setAuthLoading(true);
    setAuthError(null);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await safeParseJsonResponse<{
        ok?: boolean;
        error?: string;
        token?: string;
        user?: AuthUserAccount;
        dataset?: EraporDataset;
        vaultMeta?: { algorithm: string; sha256: string; updatedAt: string };
        activeNpsn?: string;
        schools?: SchoolProfileSummary[];
        connectionConfig?: DapodikConnectionConfig | null;
        autoProvisioned?: boolean;
        dapodikSyncStatus?: {
          synced: boolean;
          via?: 'server_direct';
          needsBrowserRelay?: boolean;
          sourceHost: string;
          studentCount?: number;
          rombelCount?: number;
          message: string;
        };
      }>(res, 'api');

      if (!res.ok || !data.ok || !data.token || !data.user || !data.dataset) {
        setAuthError(data.error || 'Login gagal. Periksa kembali kredensial Anda.');
        return;
      }

      localStorage.setItem(AUTH_TOKEN_KEY, data.token);
      localStorage.setItem(AUTH_USER_KEY, JSON.stringify(data.user));
      setAuthUser(data.user);
      setRole(data.user.role);
      setActiveNpsn(data.activeNpsn || data.dataset.school.npsn);
      setDataset(data.dataset);
      if (data.vaultMeta) setVaultMeta(data.vaultMeta);
      if (data.schools) setSchools(data.schools);
      if (data.connectionConfig !== undefined) setConnectionConfig(data.connectionConfig);
      setActiveTab('dashboard');
      setDirectPrintBanner(null);
      setPreselectedRombelId(data.user.assignedRombelId);

      const schoolName = data.dataset.school.namaSekolah;
      const schoolNpsn = data.dataset.school.npsn;
      if (data.dapodikSyncStatus?.synced) {
        setSyncNotice(
          `Selamat datang, ${data.user.displayName}. Tersambung otomatis ke Dapodik ${schoolName} (NPSN ${schoolNpsn}).`
        );
      } else if (data.autoProvisioned) {
        setSyncNotice(
          `Sekolah ${schoolName} (NPSN ${schoolNpsn}) terdaftar otomatis & siap tersambung ke Dapodik.`
        );
      } else {
        setSyncNotice(
          `Selamat datang, ${data.user.displayName} (${data.user.role === 'guru' ? 'Akun Guru' : 'Akun Operator Sekolah'}) · NPSN ${schoolNpsn}.`
        );
      }

      await saveEncryptedSnapshotOffline(data.dataset, passphrase || undefined).catch(
        () => undefined
      );

      // If Dapodik isn't directly reachable from cloud server, silently try local Bridge Relay (127.0.0.1:5775)
      if (!data.dapodikSyncStatus?.synced && effectiveOnline) {
        void fetchDapodikFromLocalRelay({
          npsn: schoolNpsn,
          fallbackSchoolName: schoolName,
        })
          .then(async (live) => {
            const importRes = await fetch('/api/dapodik/import-json', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                ...live.payload,
                syncChannel: 'browser_direct',
              }),
            });
            if (importRes.ok) {
              const imported = await safeParseJsonResponse<{
                ok?: boolean;
                dataset?: EraporDataset;
                vaultMeta?: { algorithm: string; sha256: string; updatedAt: string };
                schools?: SchoolProfileSummary[];
                connectionConfig?: DapodikConnectionConfig;
              }>(importRes, 'api');
              if (imported.ok && imported.dataset) {
                setDataset(imported.dataset);
                if (imported.vaultMeta) setVaultMeta(imported.vaultMeta);
                if (imported.schools) setSchools(imported.schools);
                if (imported.connectionConfig) setConnectionConfig(imported.connectionConfig);
                setSyncNotice(
                  `Tersambung otomatis ke Dapodik ${imported.dataset.school.namaSekolah} (NPSN ${schoolNpsn}) · ${live.studentCount} siswa disinkronkan.`
                );
              }
            }
          })
          .catch(() => undefined);
      }
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Gagal menghubungi server login.');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = async () => {
    const token = localStorage.getItem(AUTH_TOKEN_KEY);
    if (token && effectiveOnline) {
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      }).catch(() => undefined);
    }
    localStorage.removeItem(AUTH_TOKEN_KEY);
    localStorage.removeItem(AUTH_USER_KEY);
    setAuthUser(null);
    setAuthError(null);
    setSyncNotice(null);
    setDirectPrintBanner(null);
    setActiveTab('dashboard');
  };

  const handleSubmitToOperator = async (
    rombelId: string,
    notes?: string
  ): Promise<void> => {
    const res = await fetch('/api/submissions/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        schoolNpsn: dataset.school.npsn,
        rombelId,
        submittedBy: authUser?.displayName || 'Guru / Wali Kelas',
        submittedByNip: authUser?.nip || '-',
        notes,
      }),
    });
    const data = await safeParseJsonResponse<{
      ok?: boolean;
      error?: string;
      submission?: GuruSubmission;
      dataset?: EraporDataset;
      vaultMeta?: { algorithm: string; sha256: string; updatedAt: string };
    }>(res, 'api');
    if (!res.ok || !data.ok || !data.dataset) {
      throw new Error(data.error || 'Gagal mengirim data ke akun operator.');
    }
    setDataset(data.dataset);
    if (data.vaultMeta) setVaultMeta(data.vaultMeta);
    await saveEncryptedSnapshotOffline(data.dataset, passphrase || undefined).catch(
      () => undefined
    );
    setSyncNotice(
      `Data ${data.submission?.rombelNama || 'Rombel'} (${data.submission?.gradesCount ?? 0} nilai) berhasil disimpan dan masuk ke Akun Operator.`
    );
  };

  const handleOperatorAction = async (params: {
    submissionId?: string;
    rombelId?: string;
    action: 'sync_dapodik' | 'print_rapor';
  }): Promise<void> => {
    const res = await fetch('/api/submissions/operator-action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        schoolNpsn: dataset.school.npsn,
        submissionId: params.submissionId,
        rombelId: params.rombelId,
        action: params.action,
        operatorName: authUser?.displayName || 'Operator Sekolah',
      }),
    });
    const data = await safeParseJsonResponse<{
      ok?: boolean;
      error?: string;
      submission?: GuruSubmission;
      dataset?: EraporDataset;
      vaultMeta?: { algorithm: string; sha256: string; updatedAt: string };
    }>(res, 'api');
    if (!res.ok || !data.ok || !data.dataset) {
      throw new Error(data.error || 'Gagal memproses pilihan operator.');
    }
    setDataset(data.dataset);
    if (data.vaultMeta) setVaultMeta(data.vaultMeta);
    await saveEncryptedSnapshotOffline(data.dataset, passphrase || undefined).catch(
      () => undefined
    );

    const targetRombelId = data.submission?.rombelId || params.rombelId;
    const rombelLabel = data.submission?.rombelNama || 'Rombel';

    if (params.action === 'sync_dapodik') {
      setSyncNotice(
        `Pilihan 1 selesai: Data ${rombelLabel} terverifikasi Read-Only dan ditandai Tersinkron ke Dapodik. Anda dapat langsung mengunduh Paket CSV Dapodik atau membuka Referensi Dapodik.`
      );
    } else {
      if (targetRombelId) {
        setPreselectedRombelId(targetRombelId);
      }
      setDirectPrintBanner(
        `Data nilai ${rombelLabel} dari Guru (${data.submission?.gradesCount ?? 0} nilai) siap dicetak. Pilih siswa lalu tekan tombol Print Rapor.`
      );
      setSyncNotice(null);
      setActiveTab('reports');
    }
  };

  const handleNavigate = (tab: NavTabId, rombelId?: string) => {
    if (rombelId) setPreselectedRombelId(rombelId);
    setActiveTab(tab);
    setMobileMenuOpen(false);
  };

  const visibleNavItems = NAV_ITEMS.filter((item) =>
    authUser?.role === 'operator' ? true : !item.operatorOnly
  );
  const pendingOperatorInboxCount = (dataset.submissions ?? []).filter(
    (s) => s.status === 'menunggu_operator'
  ).length;

  const activeNavObj = visibleNavItems.find((i) => i.id === activeTab);
  const activeNavTitle =
    (authUser?.role === 'guru' ? activeNavObj?.guruLabel : undefined) ||
    activeNavObj?.label ||
    'Dasbor Utama';

  // Wait briefly on initial session check, or render LoginView if not signed in
  if (!authChecked) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 text-xs text-slate-600">
        Memeriksa sesi brankas terenkripsi e-Rapor...
      </div>
    );
  }

  if (!authUser) {
    return (
      <>
        <LoginView
          schools={schools}
          defaultNpsn={activeNpsn}
          isOnline={effectiveOnline}
          isLoading={authLoading}
          errorMessage={authError}
          onSubmitLogin={handleLoginSubmit}
          onOpenGuide={() => setShowGlobalGuide(true)}
        />
        <PanduanSinkronisasi
          isOpen={showGlobalGuide}
          onClose={() => setShowGlobalGuide(false)}
          npsn={activeNpsn}
          schoolName={schools.find((s) => s.npsn === activeNpsn)?.namaSekolah || 'Sekolah'}
          initialTrack="guru"
        />
      </>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex">
      {/* Desktop Sidebar (256px) */}
      <aside
        aria-label="Navigasi Utama"
        className="no-print hidden lg:flex lg:w-64 lg:flex-col lg:border-r lg:border-slate-200 lg:bg-white lg:fixed lg:inset-y-0"
      >
        <div className="flex h-14 items-center border-b border-slate-200 px-6">
          <span className="font-display text-base font-extrabold tracking-tight text-slate-900 whitespace-nowrap shrink-0">
            e-Rapor Dapodik
          </span>
        </div>

        <nav className="flex-1 space-y-1 p-4">
          {visibleNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            const labelText =
              authUser.role === 'guru' && item.guruLabel ? item.guruLabel : item.label;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleNavigate(item.id)}
                aria-current={isActive ? 'page' : undefined}
                className={`flex w-full items-center justify-between rounded-lg px-3.5 py-2.5 text-xs font-semibold whitespace-nowrap cursor-pointer ${
                  isActive
                    ? 'bg-blue-700 text-white'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <span className="flex items-center gap-3">
                  <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <span>{labelText}</span>
                </span>
                {item.id === 'dashboard' &&
                  authUser.role === 'operator' &&
                  pendingOperatorInboxCount > 0 && (
                    <span
                      className={`font-mono tabular-nums text-[11px] font-bold ${
                        isActive ? 'text-blue-100' : 'text-amber-700'
                      }`}
                    >
                      {pendingOperatorInboxCount}
                    </span>
                  )}
              </button>
            );
          })}
        </nav>

        <div className="border-t border-slate-200 p-4 text-xs text-slate-600 space-y-3">
          <div>
            <p className="font-semibold text-slate-900 truncate">
              {authUser.displayName}
            </p>
            <p className="mt-0.5 text-[11px] text-slate-500">
              {authUser.role === 'operator' ? 'Operator Sekolah' : 'Guru / Wali Kelas'} ·{' '}
              <span className="font-mono">{authUser.username}</span>
            </p>
          </div>

          <div className="border-t border-slate-100 pt-2.5">
            <p className="font-semibold text-slate-900 truncate">
              {dataset.school.namaSekolah}
            </p>
            <p className="mt-0.5 font-mono text-[11px] text-slate-500">
              NPSN {dataset.school.npsn} · {dataset.school.semesterId}
            </p>
            {authUser.role === 'operator' && (
              <button
                type="button"
                onClick={() => handleNavigate('schools')}
                className="mt-1.5 text-[11px] font-semibold text-blue-700 hover:underline cursor-pointer"
              >
                Ganti / Tambah Sekolah ({schools.length}) &rarr;
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={() => void handleLogout()}
            className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
          >
            <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Keluar Akun</span>
          </button>
        </div>
      </aside>

      {/* Mobile Navigation Drawer */}
      {mobileMenuOpen && (
        <div className="no-print fixed inset-0 z-50 flex lg:hidden">
          <div
            className="fixed inset-0 bg-slate-900/40"
            onClick={() => setMobileMenuOpen(false)}
            aria-hidden="true"
          />
          <aside className="relative z-10 flex w-64 flex-col bg-white border-r border-slate-200">
            <div className="flex h-14 items-center justify-between border-b border-slate-200 px-4">
              <span className="font-display text-sm font-extrabold text-slate-900">
                e-Rapor Dapodik
              </span>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                aria-label="Tutup menu navigasi"
                className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <nav className="flex-1 space-y-1 p-3">
              {visibleNavItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                const labelText =
                  authUser.role === 'guru' && item.guruLabel ? item.guruLabel : item.label;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleNavigate(item.id)}
                    className={`flex w-full items-center gap-3 rounded-lg px-3.5 py-2.5 text-xs font-semibold cursor-pointer ${
                      isActive
                        ? 'bg-blue-700 text-white'
                        : 'text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                    <span>{labelText}</span>
                  </button>
                );
              })}
            </nav>
            <div className="border-t border-slate-200 p-3">
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  void handleLogout();
                }}
                className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Keluar Akun</span>
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* Main Content Shell */}
      <div className="flex flex-1 flex-col lg:pl-64 min-w-0">
        {/* Top Bar Contract: Single-row, 3-zone header */}
        <header className="no-print sticky top-0 z-30 flex h-14 items-center justify-between gap-4 border-b border-slate-200 bg-white px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Buka menu navigasi"
              className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 lg:hidden cursor-pointer"
            >
              <Menu className="h-4 w-4" />
            </button>
            <span className="text-sm font-semibold text-slate-900 truncate">
              {activeNavTitle}
            </span>
          </div>

          <div className="hidden md:flex items-center gap-2 text-xs text-slate-500 whitespace-nowrap shrink-0">
            <span className="font-semibold text-slate-800">
              {authUser.role === 'operator' ? 'Operator Sekolah' : 'Guru / Wali Kelas'}
            </span>
            <span aria-hidden="true">·</span>
            <span className="inline-flex items-center gap-1.5 font-medium text-slate-700">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" aria-hidden="true" />
              <span>AES-256-GCM</span>
            </span>
            <span aria-hidden="true">·</span>
            <span className={effectiveOnline ? 'text-emerald-700 font-medium' : 'text-amber-700 font-medium'}>
              {effectiveOnline ? 'Terhubung' : 'Mode Offline'}
            </span>
            {outbox.length > 0 && (
              <>
                <span aria-hidden="true">·</span>
                <span className="font-mono font-semibold text-amber-700 tabular-nums">
                  {outbox.length} Antrean
                </span>
              </>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setShowGlobalGuide(true)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <BookOpen className="h-3.5 w-3.5 text-blue-700" aria-hidden="true" />
              <span>Panduan</span>
            </button>
            {outbox.length > 0 && effectiveOnline ? (
              <button
                type="button"
                onClick={() => void flushOutbox()}
                className="inline-flex items-center gap-1.5 rounded-lg bg-amber-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-amber-700 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Sinkron ({outbox.length})</span>
              </button>
            ) : (
              <div className="hidden sm:block">
                <PWAInstallButton compact />
              </div>
            )}
            <button
              type="button"
              onClick={() => void handleLogout()}
              aria-label="Keluar dari akun"
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <LogOut className="h-3.5 w-3.5 text-slate-500" aria-hidden="true" />
              <span className="hidden sm:inline">Keluar</span>
            </button>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          {syncNotice && (
            <div
              role="status"
              className="no-print mb-5 flex items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-xs text-emerald-900"
            >
              <span>{syncNotice}</span>
              <button
                type="button"
                onClick={() => setSyncNotice(null)}
                className="font-semibold text-emerald-700 hover:underline cursor-pointer"
              >
                Tutup
              </button>
            </div>
          )}

          {activeTab === 'dashboard' && (
            <DashboardView
              key={`${dataset.school.npsn}-${authUser.role}`}
              dataset={dataset}
              role={role}
              authUser={authUser}
              onRoleChange={setRole}
              onNavigate={handleNavigate}
              onSubmitToOperator={handleSubmitToOperator}
              onOperatorAction={handleOperatorAction}
              onTriggerDapodikSync={() => {
                void handleSyncLiveDapodik({
                  hostUrl: connectionConfig?.sourceHost || dataset.school.sourceHost,
                  npsn: dataset.school.npsn,
                  token: '',
                  mode: 'live',
                })
                  .then((diff) => {
                    if (diff) {
                      setSyncNotice(
                        `Sinkronisasi Dapodik real-time berhasil (+${diff.addedStudents} baru, ${diff.updatedStudents} diperbarui).`
                      );
                    }
                  })
                  .catch((err) => {
                    const msg =
                      err instanceof Error
                        ? err.message
                        : 'WebService Dapodik lokal belum terhubung langsung.';
                    setSyncNotice(
                      `${msg} Ikuti 3 langkah mudah di bawah untuk menghubungkan PC Dapodik sekolah.`
                    );
                    setActiveTab('dapodik');
                  });
              }}
              isSyncingDapodik={isSyncingDapodik}
              isOnline={effectiveOnline}
              pendingOutboxCount={outbox.length}
            />
          )}

          {activeTab === 'schools' && (
            <SchoolProfileSyncView
              key={dataset.school.npsn}
              dataset={dataset}
              isOnline={effectiveOnline}
              onRegisterSchool={handleRegisterSchool}
              onTestConnection={handleTestSchoolConnection}
            />
          )}

          {activeTab === 'dapodik' && (
            <DapodikSyncView
              key={dataset.school.npsn}
              dataset={dataset}
              connectionConfig={connectionConfig}
              isOnline={effectiveOnline}
              onSyncLive={handleSyncLiveDapodik}
              onSyncLocalRelay={handleSyncLocalRelay}
              onImportJson={handleImportDapodikJson}
              onImportFile={handleImportDapodikFile}
              onSaveConfig={handleSaveDapodikConfig}
            />
          )}

          {activeTab === 'curriculum' && (
            <CurriculumMappingView
              key={dataset.school.npsn}
              dataset={dataset}
              isOnline={effectiveOnline}
              onSaveSubjectMapping={handleSaveSubjectMapping}
              onSaveTp={handleSaveTp}
              onDeleteTp={handleDeleteTp}
              onActivateKka={handleActivateKka}
            />
          )}

          {activeTab === 'grades' && (
            <GradeInputView
              key={dataset.school.npsn}
              dataset={dataset}
              initialRombelId={preselectedRombelId}
              onSaveGrade={handleSaveGrade}
              onSaveGradesBatch={handleSaveGradesBatch}
              onUpdateSubjectsKktp={handleUpdateSubjectsKktp}
              onSubmitToOperator={handleSubmitToOperator}
              isOnline={effectiveOnline}
            />
          )}

          {activeTab === 'wali' && (
            <WaliP5View
              key={dataset.school.npsn}
              dataset={dataset}
              onSaveWali={handleSaveWali}
              onSubmitToOperator={handleSubmitToOperator}
              isOnline={effectiveOnline}
            />
          )}

          {activeTab === 'reports' && (
            <ReportsPrincipalView
              key={`${dataset.school.npsn}-${preselectedRombelId || 'default'}`}
              dataset={dataset}
              isOnline={effectiveOnline}
              initialRombelId={preselectedRombelId}
              directPrintBanner={directPrintBanner}
              onDismissDirectPrintBanner={() => setDirectPrintBanner(null)}
            />
          )}

          {activeTab === 'security' && (
            <SecurityOfflineView
              key={dataset.school.npsn}
              dataset={dataset}
              vaultMeta={vaultMeta}
              simulatedOffline={simulatedOffline}
              onToggleSimulatedOffline={() => setSimulatedOffline((v) => !v)}
              isBrowserOnline={isBrowserOnline}
              outbox={outbox}
              onFlushOutbox={flushOutbox}
              passphrase={passphrase}
              onChangePassphrase={setPassphrase}
              onRestoreEncryptedDataset={async (restored) => {
                setDataset(restored);
                await saveEncryptedSnapshotOffline(
                  restored,
                  passphrase || undefined
                ).catch(() => undefined);
                if (effectiveOnline) {
                  await fetch('/api/dapodik/import-json', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      school: restored.school,
                      rombels: restored.rombels,
                      students: restored.students,
                    }),
                  });
                }
              }}
            />
          )}
        </main>
      </div>

      {/* Non-intrusive Offline Indicator */}
      {!effectiveOnline && (
        <div
          role="status"
          className="no-print fixed bottom-4 left-4 z-40 flex items-center gap-2 rounded-lg bg-amber-600 px-3.5 py-2 text-xs font-semibold text-white shadow-lg"
        >
          <WifiOff className="h-3.5 w-3.5" aria-hidden="true" />
          <span>
            Mode Offline — Data terenkripsi disimpan lokal ({outbox.length} menunggu sinkronisasi)
          </span>
        </div>
      )}

      <PanduanSinkronisasi
        isOpen={showGlobalGuide}
        onClose={() => setShowGlobalGuide(false)}
        npsn={dataset.school.npsn}
        schoolName={dataset.school.namaSekolah}
        initialTrack={
          activeTab === 'grades' || activeTab === 'wali' || activeTab === 'reports'
            ? 'guru'
            : 'excel'
        }
        onJumpToMethod={() => {
          setActiveTab('dapodik');
        }}
      />
    </div>
  );
}

