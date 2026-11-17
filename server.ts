import 'dotenv/config';
import express, { type Request, type Response } from 'express';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { GoogleGenAI, ThinkingLevel } from '@google/genai';
import {
  buildNodeBridgeScript,
  buildWindowsBridgeBatScript,
  buildWindowsPowerShellBridgeScript,
} from './src/lib/dapodikClient.ts';
import {
  activateKkaElective,
  applyOperatorSubmissionAction,
  assertDapodikReadOnlyMethod,
  computeDeepLearningReadiness,
  computeDeterministicChecksum,
  computePrincipalMetrics,
  createCleanSchoolDataset,
  createGuruSubmission,
  deleteTujuanPembelajaran,
  hasDapodikSyncChanges,
  isLocalOrPrivateUrl,
  normalizeDapodikWebServiceUrl,
  normalizeNpsnInput,
  parseDapodikWebServiceResponses,
  parseKemdikbudNpsnHtml,
  reconcileDapodikSync,
  safeParseJsonResponse,
  summarizeSchoolProfile,
  updateSubjectsKktp,
  upsertSubjectMapping,
  upsertTujuanPembelajaran,
  validateLoginInput,
  validateNpsnFormat,
  validateSchoolProfileInput,
  type AuditLogEntry,
  type AuthRole,
  type AuthUserAccount,
  type DapodikConnectionConfig,
  type DapodikIncomingPayload,
  type DapodikStudent,
  type DeepLearningLevel,
  type EraporDataset,
  type KurikulumType,
  type SchoolJenjang,
  type SchoolProfileSummary,
  type StudentGradeRecord,
  type WaliKelasRecord,
} from './src/lib/eraporCore.ts';
import { createInitialDataset } from './src/lib/seedData.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, 'data');
const SCHOOLS_DIR = path.join(DATA_DIR, 'schools');
const LEGACY_VAULT_FILE = path.join(DATA_DIR, 'erapor-vault.enc.json');
const REGISTRY_FILE = path.join(DATA_DIR, 'registry.enc.json');
const PORT = Number(process.env.PORT) || 3000;

const SERVER_VAULT_SECRET =
  process.env.ERAPOR_VAULT_SECRET ||
  'erapor-kemdikdasmen-aes256-gcm-school-vault-2026';

interface ServerEncryptedFile {
  version: string;
  algorithm: 'aes-256-gcm';
  saltHex: string;
  ivHex: string;
  authTagHex: string;
  ciphertextB64: string;
  sha256: string;
  updatedAt: string;
}

interface SchoolRegistry {
  activeNpsn: string;
  registeredNpsns: string[];
}

function getSchoolVaultPath(npsn: string): string {
  const safeNpsn = npsn.replace(/[^0-9]/g, '') || 'default';
  return path.join(SCHOOLS_DIR, `${safeNpsn}.enc.json`);
}

function getSchoolConnPath(npsn: string): string {
  const safeNpsn = npsn.replace(/[^0-9]/g, '') || 'default';
  return path.join(SCHOOLS_DIR, `${safeNpsn}.conn.enc.json`);
}

interface StoredSchoolConnSecret {
  npsn: string;
  sourceHost: string;
  token: string;
  autoSyncEnabled: boolean;
  autoSyncIntervalSec: number;
  bridgeKey: string;
  lastLiveChannel?: 'server_direct' | 'browser_direct' | 'local_bridge' | 'none';
  lastLiveCheckAt?: string;
  lastLiveMessage?: string;
}

function createBridgeKey(npsn: string): string {
  return crypto
    .createHmac('sha256', SERVER_VAULT_SECRET)
    .update(`bridge:${npsn}`)
    .digest('hex')
    .slice(0, 32);
}

function deriveServerKey(salt: Buffer): Buffer {
  return crypto.scryptSync(SERVER_VAULT_SECRET, salt, 32);
}

function saveEncryptedJsonFile(filePath: string, payload: unknown): ServerEncryptedFile {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  const plaintext = JSON.stringify(payload);
  const sha256 = crypto.createHash('sha256').update(plaintext).digest('hex');
  const salt = crypto.randomBytes(16);
  const iv = crypto.randomBytes(12);
  const key = deriveServerKey(salt);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  const envelope: ServerEncryptedFile = {
    version: 'ERAPOR-SERVER-AES256-GCM-V1',
    algorithm: 'aes-256-gcm',
    saltHex: salt.toString('hex'),
    ivHex: iv.toString('hex'),
    authTagHex: authTag.toString('hex'),
    ciphertextB64: encrypted.toString('base64'),
    sha256,
    updatedAt: new Date().toISOString(),
  };

  fs.writeFileSync(filePath, JSON.stringify(envelope, null, 2), 'utf8');
  return envelope;
}

function loadEncryptedJsonFile<T>(
  filePath: string
): { data: T; vaultMeta: Omit<ServerEncryptedFile, 'ciphertextB64'> } | null {
  if (!fs.existsSync(filePath)) return null;
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    const envelope = JSON.parse(raw) as ServerEncryptedFile;
    const salt = Buffer.from(envelope.saltHex, 'hex');
    const iv = Buffer.from(envelope.ivHex, 'hex');
    const authTag = Buffer.from(envelope.authTagHex, 'hex');
    const key = deriveServerKey(salt);
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(envelope.ciphertextB64, 'base64')),
      decipher.final(),
    ]).toString('utf8');

    const data = JSON.parse(decrypted) as T;
    const { ciphertextB64: _omit, ...meta } = envelope;
    return { data, vaultMeta: meta };
  } catch {
    return null;
  }
}

function loadOrInitRegistry(): SchoolRegistry {
  const existingReg = loadEncryptedJsonFile<SchoolRegistry>(REGISTRY_FILE);
  if (existingReg && existingReg.data.registeredNpsns.length > 0) {
    return existingReg.data;
  }

  // Smooth migration from legacy single-school vault if present
  const legacy = loadEncryptedJsonFile<EraporDataset>(LEGACY_VAULT_FILE);
  if (legacy) {
    const npsn = legacy.data.school.npsn;
    saveEncryptedJsonFile(getSchoolVaultPath(npsn), legacy.data);
    const migratedReg: SchoolRegistry = { activeNpsn: npsn, registeredNpsns: [npsn] };
    saveEncryptedJsonFile(REGISTRY_FILE, migratedReg);
    return migratedReg;
  }

  const initial = createInitialDataset();
  saveEncryptedJsonFile(getSchoolVaultPath(initial.school.npsn), initial);
  const reg: SchoolRegistry = {
    activeNpsn: initial.school.npsn,
    registeredNpsns: [initial.school.npsn],
  };
  saveEncryptedJsonFile(REGISTRY_FILE, reg);
  return reg;
}

function loadSchoolDataset(npsn: string): {
  dataset: EraporDataset;
  vaultMeta: Omit<ServerEncryptedFile, 'ciphertextB64'>;
} | null {
  const loaded = loadEncryptedJsonFile<EraporDataset>(getSchoolVaultPath(npsn));
  if (!loaded) return null;
  return { dataset: loaded.data, vaultMeta: loaded.vaultMeta };
}

function saveSchoolDataset(
  dataset: EraporDataset
): Omit<ServerEncryptedFile, 'ciphertextB64'> {
  const saved = saveEncryptedJsonFile(getSchoolVaultPath(dataset.school.npsn), dataset);
  const { ciphertextB64: _omit, ...meta } = saved;
  return meta;
}

function loadSchoolConnSecret(npsn: string, fallbackHost = 'http://localhost:5774/WebService'): StoredSchoolConnSecret {
  const loaded = loadEncryptedJsonFile<StoredSchoolConnSecret>(getSchoolConnPath(npsn));
  if (loaded) {
    return {
      ...loaded.data,
      bridgeKey: loaded.data.bridgeKey || createBridgeKey(npsn),
      autoSyncIntervalSec: loaded.data.autoSyncIntervalSec || 30,
    };
  }
  const fresh: StoredSchoolConnSecret = {
    npsn,
    sourceHost: fallbackHost,
    token: '',
    autoSyncEnabled: false,
    autoSyncIntervalSec: 30,
    bridgeKey: createBridgeKey(npsn),
    lastLiveChannel: 'none',
  };
  saveEncryptedJsonFile(getSchoolConnPath(npsn), fresh);
  return fresh;
}

function saveSchoolConnSecret(secret: StoredSchoolConnSecret): StoredSchoolConnSecret {
  saveEncryptedJsonFile(getSchoolConnPath(secret.npsn), secret);
  return secret;
}

function toPublicConnectionConfig(secret: StoredSchoolConnSecret): DapodikConnectionConfig {
  return {
    npsn: secret.npsn,
    sourceHost: secret.sourceHost,
    hasToken: Boolean(secret.token.trim()),
    autoSyncEnabled: secret.autoSyncEnabled,
    autoSyncIntervalSec: secret.autoSyncIntervalSec,
    bridgeKey: secret.bridgeKey,
    lastLiveChannel: secret.lastLiveChannel,
    lastLiveCheckAt: secret.lastLiveCheckAt,
    lastLiveMessage: secret.lastLiveMessage,
  };
}

interface StoredAuthRecord {
  username: string;
  role: AuthRole;
  displayName: string;
  nip: string;
  assignedRombelId?: string;
  saltHex: string;
  passwordHashHex: string;
}

interface StoredSchoolAuthVault {
  npsn: string;
  accounts: StoredAuthRecord[];
}

interface StoredSessionEntry {
  token: string;
  user: AuthUserAccount;
  expiresAtMs: number;
}

const SESSIONS_FILE = path.join(DATA_DIR, 'sessions.enc.json');

function getSchoolAuthPath(npsn: string): string {
  const safeNpsn = npsn.replace(/[^0-9]/g, '') || 'default';
  return path.join(SCHOOLS_DIR, `${safeNpsn}.auth.enc.json`);
}

function hashPasswordScrypt(password: string, saltHex?: string): {
  saltHex: string;
  passwordHashHex: string;
} {
  const salt = saltHex || crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 32).toString('hex');
  return { saltHex: salt, passwordHashHex: hash };
}

function verifyPasswordScrypt(password: string, saltHex: string, expectedHex: string): boolean {
  try {
    const computed = crypto.scryptSync(password, saltHex, 32);
    const expected = Buffer.from(expectedHex, 'hex');
    if (computed.length !== expected.length) return false;
    return crypto.timingSafeEqual(computed, expected);
  } catch {
    return false;
  }
}

function loadOrInitSchoolAuth(dataset: EraporDataset): StoredSchoolAuthVault {
  const authPath = getSchoolAuthPath(dataset.school.npsn);
  const loaded = loadEncryptedJsonFile<StoredSchoolAuthVault>(authPath);
  if (loaded && Array.isArray(loaded.data.accounts) && loaded.data.accounts.length > 0) {
    return loaded.data;
  }

  const primaryRombel = dataset.rombels[2] || dataset.rombels[0];
  const operatorPass = hashPasswordScrypt('operator123');
  const guruPass = hashPasswordScrypt('guru123');

  const vault: StoredSchoolAuthVault = {
    npsn: dataset.school.npsn,
    accounts: [
      {
        username: 'operator',
        role: 'operator',
        displayName: `Operator Dapodik · ${dataset.school.namaSekolah}`,
        nip: '198903152019031004',
        ...operatorPass,
      },
      {
        username: 'guru',
        role: 'guru',
        displayName: primaryRombel?.waliKelasNama || 'Guru Kelas / Mata Pelajaran',
        nip: primaryRombel?.waliKelasNip || '198111052008011009',
        assignedRombelId: primaryRombel?.id,
        ...guruPass,
      },
    ],
  };

  saveEncryptedJsonFile(authPath, vault);
  return vault;
}

function loadSessionsStore(): Record<string, StoredSessionEntry> {
  const loaded = loadEncryptedJsonFile<Record<string, StoredSessionEntry>>(SESSIONS_FILE);
  if (!loaded) return {};
  const now = Date.now();
  const valid: Record<string, StoredSessionEntry> = {};
  for (const [token, entry] of Object.entries(loaded.data)) {
    if (entry && entry.expiresAtMs > now) {
      valid[token] = entry;
    }
  }
  return valid;
}

const sessionStore: Record<string, StoredSessionEntry> = loadSessionsStore();

function persistSessionsStore(): void {
  saveEncryptedJsonFile(SESSIONS_FILE, sessionStore);
}

function extractAuthToken(req: Request): string {
  const authHeader = String(req.headers.authorization || '').trim();
  if (authHeader.toLowerCase().startsWith('bearer ')) {
    return authHeader.slice(7).trim();
  }
  return String(req.headers['x-erapor-token'] || '').trim();
}


function initActiveState(): {
  registry: SchoolRegistry;
  dataset: EraporDataset;
  vaultMeta: Omit<ServerEncryptedFile, 'ciphertextB64'>;
} {
  let registry = loadOrInitRegistry();
  let loaded = loadSchoolDataset(registry.activeNpsn);
  if (!loaded) {
    const initial = createInitialDataset();
    const meta = saveSchoolDataset(initial);
    registry = {
      activeNpsn: initial.school.npsn,
      registeredNpsns: Array.from(new Set([initial.school.npsn, ...registry.registeredNpsns])),
    };
    saveEncryptedJsonFile(REGISTRY_FILE, registry);
    loaded = { dataset: initial, vaultMeta: meta };
  }
  return { registry, dataset: loaded.dataset, vaultMeta: loaded.vaultMeta };
}

const initialBoot = initActiveState();
let activeRegistry: SchoolRegistry = initialBoot.registry;
let stateCache: {
  dataset: EraporDataset;
  vaultMeta: Omit<ServerEncryptedFile, 'ciphertextB64'>;
} = {
  dataset: initialBoot.dataset,
  vaultMeta: initialBoot.vaultMeta,
};

const sseClients = new Set<Response>();

function listAllSchoolSummaries(): SchoolProfileSummary[] {
  const summaries: SchoolProfileSummary[] = [];
  for (const npsn of activeRegistry.registeredNpsns) {
    const loaded = loadSchoolDataset(npsn);
    if (loaded) {
      summaries.push(summarizeSchoolProfile(loaded.dataset));
    }
  }
  return summaries;
}

function broadcastSse(eventName: string, payload: unknown): void {
  const frame = `event: ${eventName}\ndata: ${JSON.stringify(payload)}\n\n`;
  for (const res of sseClients) {
    try {
      res.write(frame);
    } catch {
      sseClients.delete(res);
    }
  }
}

function persistActiveState(nextDataset: EraporDataset): void {
  const meta = saveSchoolDataset(nextDataset);
  if (!activeRegistry.registeredNpsns.includes(nextDataset.school.npsn)) {
    activeRegistry = {
      activeNpsn: nextDataset.school.npsn,
      registeredNpsns: [...activeRegistry.registeredNpsns, nextDataset.school.npsn],
    };
    saveEncryptedJsonFile(REGISTRY_FILE, activeRegistry);
  }
  stateCache = { dataset: nextDataset, vaultMeta: meta };
}

async function fetchDapodikFromWebService(params: {
  hostUrl: string;
  npsn: string;
  token?: string;
  fallbackSchoolName?: string;
  fallbackAlamat?: string;
  fallbackRombelId?: string;
}): Promise<{
  payload: DapodikIncomingPayload;
  detectedSchoolName: string;
  rombelCount: number;
  studentCount: number;
}> {
  const cleanBase = normalizeDapodikWebServiceUrl(params.hostUrl);
  const cleanNpsn = params.npsn.trim();
  const pdUrl = `${cleanBase}/getPesertaDidik?npsn=${encodeURIComponent(cleanNpsn)}`;
  const rombelUrl = `${cleanBase}/getRombonganBelajar?npsn=${encodeURIComponent(cleanNpsn)}`;
  const sekolahUrl = `${cleanBase}/getSekolah?npsn=${encodeURIComponent(cleanNpsn)}`;
  const gtkUrl = `${cleanBase}/getGtk?npsn=${encodeURIComponent(cleanNpsn)}`;

  // Enforce strict Read-Only Guard (HTTP GET only) before any request
  assertDapodikReadOnlyMethod('GET', sekolahUrl);
  assertDapodikReadOnlyMethod('GET', rombelUrl);
  assertDapodikReadOnlyMethod('GET', pdUrl);
  assertDapodikReadOnlyMethod('GET', gtkUrl);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 4500);
  try {
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (params.token?.trim()) {
      headers.Authorization = `Bearer ${params.token.trim()}`;
    }

    const [sekolahRes, rombelRes, pdRes, gtkRes] = await Promise.all([
      fetch(sekolahUrl, { method: 'GET', headers, signal: controller.signal }),
      fetch(rombelUrl, { method: 'GET', headers, signal: controller.signal }),
      fetch(pdUrl, { method: 'GET', headers, signal: controller.signal }),
      fetch(gtkUrl, { method: 'GET', headers, signal: controller.signal }).catch(() => null),
    ]);
    clearTimeout(timeout);

    if (pdRes.status === 401 || pdRes.status === 403 || sekolahRes.status === 401) {
      throw new Error(
        `Token WebService Dapodik ditolak (HTTP ${pdRes.status}). Salin Token terbaru dari Dapodik menu Pengaturan -> WebService.`
      );
    }

    if (!pdRes.ok) {
      throw new Error(`Dapodik WebService merespons HTTP ${pdRes.status}`);
    }

    const [sekolahRaw, rombelRaw, pesertaDidikRaw, gtkRaw] = await Promise.all([
      sekolahRes.ok
        ? safeParseJsonResponse(sekolahRes, 'dapodik').catch(() => undefined)
        : Promise.resolve(undefined),
      rombelRes.ok
        ? safeParseJsonResponse(rombelRes, 'dapodik').catch(() => undefined)
        : Promise.resolve(undefined),
      safeParseJsonResponse(pdRes, 'dapodik'),
      gtkRes && gtkRes.ok
        ? safeParseJsonResponse(gtkRes, 'dapodik').catch(() => undefined)
        : Promise.resolve(undefined),
    ]);

    return parseDapodikWebServiceResponses({
      sourceHost: cleanBase,
      npsn: params.npsn,
      sekolahRaw,
      rombelRaw,
      pesertaDidikRaw,
      gtkRaw,
      fallbackSchoolName: params.fallbackSchoolName,
      fallbackAlamat: params.fallbackAlamat,
      fallbackRombelId: params.fallbackRombelId,
    });
  } catch (err) {
    clearTimeout(timeout);
    throw err;
  }
}

async function lookupKemdikbudByNpsn(npsn: string) {
  const clean = normalizeNpsnInput(npsn);
  if (clean.length !== 8) return null;
  const targetUrl = `https://referensi.data.kemdikbud.go.id/pendidikan/npsn/${clean}`;
  assertDapodikReadOnlyMethod('GET', targetUrl);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 2200);
  try {
    const res = await fetch(targetUrl, {
      method: 'GET',
      headers: {
        Accept: 'text/html,application/xhtml+xml',
        'User-Agent': 'Mozilla/5.0 (compatible; e-Rapor-Kemdikdasmen/1.0)',
      },
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!res.ok) return null;
    const html = await res.text();
    return parseKemdikbudNpsnHtml(html, clean);
  } catch {
    clearTimeout(timeout);
    return null;
  }
}

function buildAiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '10mb' }));

  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({
      ok: true,
      service: 'e-rapor-dapodik-nusantara',
      activeNpsn: activeRegistry.activeNpsn,
      registeredSchools: activeRegistry.registeredNpsns.length,
      encryption: stateCache.vaultMeta.algorithm,
      readOnlyDapodikGuard: true,
      timestamp: new Date().toISOString(),
    });
  });

  app.get('/api/state', (_req: Request, res: Response) => {
    const conn = loadSchoolConnSecret(
      stateCache.dataset.school.npsn,
      stateCache.dataset.school.sourceHost
    );
    res.json({
      dataset: stateCache.dataset,
      vaultMeta: stateCache.vaultMeta,
      activeNpsn: activeRegistry.activeNpsn,
      schools: listAllSchoolSummaries(),
      connectionConfig: toPublicConnectionConfig(conn),
    });
  });

  app.get('/api/schools', (_req: Request, res: Response) => {
    res.json({
      activeNpsn: activeRegistry.activeNpsn,
      schools: listAllSchoolSummaries(),
    });
  });

  // Public school directory + auth endpoints for Guru & Operator Login
  app.get('/api/auth/public-info', (_req: Request, res: Response) => {
    res.json({
      ok: true,
      activeNpsn: activeRegistry.activeNpsn,
      schools: listAllSchoolSummaries(),
    });
  });

  // Lookup NPSN in encrypted vaults, live Dapodik WebService, or Kemdikbud Referensi (Read-Only GET)
  app.get('/api/dapodik/lookup-npsn', async (req: Request, res: Response) => {
    try {
      const rawNpsn = String(req.query.npsn || '');
      const check = validateNpsnFormat(rawNpsn);
      if (!check.valid) {
        res.status(400).json({ ok: false, error: check.error });
        return;
      }

      const targetNpsn = check.clean;
      const existingLoaded =
        targetNpsn === stateCache.dataset.school.npsn
          ? { dataset: stateCache.dataset, vaultMeta: stateCache.vaultMeta }
          : loadSchoolDataset(targetNpsn);

      if (existingLoaded) {
        const summary = summarizeSchoolProfile(existingLoaded.dataset);
        const conn = loadSchoolConnSecret(
          targetNpsn,
          existingLoaded.dataset.school.sourceHost
        );
        res.json({
          ok: true,
          npsn: targetNpsn,
          registered: true,
          dapodikReachable: false,
          source: 'vault',
          school: {
            ...summary,
            alamat: existingLoaded.dataset.school.alamat,
            kecamatan: existingLoaded.dataset.school.kecamatan,
          },
          connectionConfig: toPublicConnectionConfig(conn),
        });
        return;
      }

      // Not in local vaults yet: try live Dapodik WebService + Kemdikbud reference in parallel
      const defaultHost = 'http://localhost:5774/WebService';
      const [liveResult, kemdikbudMeta] = await Promise.all([
        fetchDapodikFromWebService({
          hostUrl: defaultHost,
          npsn: targetNpsn,
        }).catch(() => null),
        lookupKemdikbudByNpsn(targetNpsn),
      ]);

      if (liveResult) {
        res.json({
          ok: true,
          npsn: targetNpsn,
          registered: false,
          dapodikReachable: true,
          source: 'dapodik_live',
          school: {
            npsn: targetNpsn,
            namaSekolah: liveResult.detectedSchoolName,
            jenjang: liveResult.payload.school?.jenjang || 'SD',
            alamat: liveResult.payload.school?.alamat || kemdikbudMeta?.alamat || '-',
            kecamatan: kemdikbudMeta?.kecamatan || '-',
            kabupaten: kemdikbudMeta?.kabupaten || 'Kabupaten/Kota',
            provinsi: kemdikbudMeta?.provinsi || 'Indonesia',
            sourceHost: defaultHost,
            studentCount: liveResult.studentCount,
            rombelCount: liveResult.rombelCount,
          },
        });
        return;
      }

      if (kemdikbudMeta) {
        res.json({
          ok: true,
          npsn: targetNpsn,
          registered: false,
          dapodikReachable: false,
          source: 'kemdikbud_referensi',
          school: {
            ...kemdikbudMeta,
            sourceHost: defaultHost,
            studentCount: 0,
            rombelCount: 0,
          },
        });
        return;
      }

      res.json({
        ok: true,
        npsn: targetNpsn,
        registered: false,
        dapodikReachable: false,
        source: 'auto_provision',
        school: {
          npsn: targetNpsn,
          namaSekolah: `Sekolah NPSN ${targetNpsn}`,
          jenjang: 'SD',
          sourceHost: defaultHost,
          studentCount: 0,
          rombelCount: 0,
        },
      });
    } catch (err) {
      res.status(500).json({
        ok: false,
        error: err instanceof Error ? err.message : 'Gagal memeriksa NPSN sekolah.',
      });
    }
  });

  app.post('/api/auth/login', async (req: Request, res: Response) => {
    try {
      const {
        npsn = activeRegistry.activeNpsn,
        username = '',
        password = '',
        expectedRole,
        resolvedSchool,
      } = (req.body || {}) as {
        npsn?: string;
        username?: string;
        password?: string;
        expectedRole?: AuthRole;
        resolvedSchool?: {
          namaSekolah?: string;
          jenjang?: SchoolJenjang;
          alamat?: string;
          kecamatan?: string;
          kabupaten?: string;
          provinsi?: string;
          sourceHost?: string;
        };
      };

      const cleanNpsn = normalizeNpsnInput(npsn || activeRegistry.activeNpsn);
      const npsnCheck = validateNpsnFormat(cleanNpsn);
      if (!npsnCheck.valid) {
        res.status(400).json({ ok: false, error: npsnCheck.error });
        return;
      }

      const check = validateLoginInput({ username, password, npsn: npsnCheck.clean });
      if (!check.valid) {
        res.status(400).json({ ok: false, error: check.error });
        return;
      }

      const targetNpsn = npsnCheck.clean;
      let loaded =
        targetNpsn === stateCache.dataset.school.npsn
          ? { dataset: stateCache.dataset, vaultMeta: stateCache.vaultMeta }
          : loadSchoolDataset(targetNpsn);
      let autoProvisioned = false;

      // Auto-provision new school vault + try live Dapodik pull when logging into a brand-new 8-digit NPSN
      if (!loaded) {
        const defaultHost = normalizeDapodikWebServiceUrl(
          resolvedSchool?.sourceHost || 'http://localhost:5774/WebService'
        );
        const [liveResult, kemdikbudMeta] = await Promise.all([
          fetchDapodikFromWebService({
            hostUrl: defaultHost,
            npsn: targetNpsn,
            fallbackSchoolName: resolvedSchool?.namaSekolah,
            fallbackAlamat: resolvedSchool?.alamat,
          }).catch(() => null),
          resolvedSchool?.namaSekolah
            ? Promise.resolve(null)
            : lookupKemdikbudByNpsn(targetNpsn),
        ]);

        const namaSekolah =
          liveResult?.detectedSchoolName ||
          resolvedSchool?.namaSekolah?.trim() ||
          kemdikbudMeta?.namaSekolah ||
          `Sekolah NPSN ${targetNpsn}`;
        const jenjang: SchoolJenjang =
          liveResult?.payload.school?.jenjang ||
          resolvedSchool?.jenjang ||
          kemdikbudMeta?.jenjang ||
          'SD';

        const createdDataset = createCleanSchoolDataset({
          npsn: targetNpsn,
          namaSekolah,
          jenjang,
          sourceHost: defaultHost,
          alamat:
            liveResult?.payload.school?.alamat ||
            resolvedSchool?.alamat ||
            kemdikbudMeta?.alamat ||
            '-',
          kecamatan: resolvedSchool?.kecamatan || kemdikbudMeta?.kecamatan || '-',
          kabupaten:
            resolvedSchool?.kabupaten ||
            kemdikbudMeta?.kabupaten ||
            'Kabupaten/Kota',
          provinsi:
            resolvedSchool?.provinsi ||
            kemdikbudMeta?.provinsi ||
            'Indonesia',
          initialPayload: liveResult?.payload,
        });

        const vaultMeta = saveSchoolDataset(createdDataset);
        saveSchoolConnSecret({
          npsn: targetNpsn,
          sourceHost: defaultHost,
          token: '',
          autoSyncEnabled: true,
          autoSyncIntervalSec: 30,
          bridgeKey: createBridgeKey(targetNpsn),
          lastLiveChannel: liveResult ? 'server_direct' : 'none',
          lastLiveCheckAt: new Date().toISOString(),
          lastLiveMessage: liveResult
            ? `Tersambung otomatis ke Dapodik (${liveResult.studentCount} siswa)`
            : `Siap sinkron otomatis Dapodik untuk NPSN ${targetNpsn}`,
        });
        activeRegistry = {
          activeNpsn: targetNpsn,
          registeredNpsns: Array.from(
            new Set([...activeRegistry.registeredNpsns, targetNpsn])
          ),
        };
        saveEncryptedJsonFile(REGISTRY_FILE, activeRegistry);
        loaded = { dataset: createdDataset, vaultMeta };
        autoProvisioned = true;
      }

      const authVault = loadOrInitSchoolAuth(loaded.dataset);
      const needle = check.normalized.username.toLowerCase();
      const matched = authVault.accounts.find(
        (acc) =>
          acc.username.toLowerCase() === needle ||
          (acc.nip && acc.nip !== '-' && acc.nip.toLowerCase() === needle)
      );

      if (!matched || !verifyPasswordScrypt(check.normalized.password, matched.saltHex, matched.passwordHashHex)) {
        res.status(401).json({
          ok: false,
          error: 'Username/NIP atau kata sandi tidak sesuai. Periksa kembali kredensial Anda.',
        });
        return;
      }

      if (expectedRole && matched.role !== expectedRole) {
        const expectedLabel = expectedRole === 'operator' ? 'Operator Sekolah' : 'Guru / Wali Kelas';
        const actualLabel = matched.role === 'operator' ? 'Operator Sekolah' : 'Guru / Wali Kelas';
        res.status(403).json({
          ok: false,
          error: `Akun "${matched.username}" terdaftar sebagai ${actualLabel}, bukan ${expectedLabel}. Silakan pindah tab peran login.`,
        });
        return;
      }

      // Switch active school cleanly to match logged-in school
      if (targetNpsn !== stateCache.dataset.school.npsn) {
        activeRegistry = { ...activeRegistry, activeNpsn: targetNpsn };
        saveEncryptedJsonFile(REGISTRY_FILE, activeRegistry);
        stateCache = loaded;
      }

      // Attempt automatic Dapodik live sync (GET Read-Only) for the logged-in NPSN
      let conn = loadSchoolConnSecret(targetNpsn, loaded.dataset.school.sourceHost);
      let dapodikSyncStatus: {
        synced: boolean;
        via?: 'server_direct';
        needsBrowserRelay?: boolean;
        sourceHost: string;
        studentCount?: number;
        rombelCount?: number;
        message: string;
      } = {
        synced: false,
        needsBrowserRelay: isLocalOrPrivateUrl(conn.sourceHost),
        sourceHost: conn.sourceHost,
        message: `Siap menyambungkan otomatis ke Dapodik NPSN ${targetNpsn}.`,
      };

      if (!autoProvisioned) {
        try {
          const live = await fetchDapodikFromWebService({
            hostUrl: conn.sourceHost,
            npsn: targetNpsn,
            token: conn.token,
            fallbackSchoolName: loaded.dataset.school.namaSekolah,
            fallbackAlamat: loaded.dataset.school.alamat,
            fallbackRombelId: loaded.dataset.rombels[0]?.id,
          });
          const { nextDataset } = reconcileDapodikSync(
            loaded.dataset,
            live.payload,
            'Auto-Connect Login Dapodik (Read-Only GET)'
          );
          persistActiveState(nextDataset);
          loaded = { dataset: stateCache.dataset, vaultMeta: stateCache.vaultMeta };
          conn = saveSchoolConnSecret({
            ...conn,
            autoSyncEnabled: true,
            lastLiveChannel: 'server_direct',
            lastLiveCheckAt: new Date().toISOString(),
            lastLiveMessage: `Tersambung otomatis saat login (${live.studentCount} siswa)`,
          });
          dapodikSyncStatus = {
            synced: true,
            via: 'server_direct',
            sourceHost: conn.sourceHost,
            studentCount: live.studentCount,
            rombelCount: live.rombelCount,
            message: `Tersambung otomatis ke Dapodik (${live.studentCount} siswa, ${live.rombelCount} rombel).`,
          };
        } catch {
          if (!conn.autoSyncEnabled) {
            conn = saveSchoolConnSecret({ ...conn, autoSyncEnabled: true });
          }
        }
      }

      const token = crypto.randomBytes(32).toString('hex');
      const user: AuthUserAccount = {
        username: matched.username,
        role: matched.role,
        displayName: matched.displayName,
        nip: matched.nip,
        schoolNpsn: targetNpsn,
        assignedRombelId: matched.assignedRombelId,
      };
      sessionStore[token] = {
        token,
        user,
        expiresAtMs: Date.now() + 1000 * 60 * 60 * 24 * 7, // 7 hari
      };
      persistSessionsStore();

      res.json({
        ok: true,
        token,
        user,
        dataset: loaded.dataset,
        vaultMeta: loaded.vaultMeta,
        activeNpsn: targetNpsn,
        schools: listAllSchoolSummaries(),
        connectionConfig: toPublicConnectionConfig(conn),
        autoProvisioned,
        dapodikSyncStatus,
      });
    } catch (err) {
      res.status(500).json({
        ok: false,
        error: err instanceof Error ? err.message : 'Gagal memproses login.',
      });
    }
  });

  app.get('/api/auth/me', (req: Request, res: Response) => {
    const token = extractAuthToken(req);
    const entry = token ? sessionStore[token] : undefined;
    if (!entry || entry.expiresAtMs <= Date.now()) {
      res.status(401).json({ ok: false, error: 'Sesi login telah berakhir atau tidak valid.' });
      return;
    }
    res.json({ ok: true, user: entry.user });
  });

  app.post('/api/auth/logout', (req: Request, res: Response) => {
    const token = extractAuthToken(req);
    if (token && sessionStore[token]) {
      delete sessionStore[token];
      persistSessionsStore();
    }
    res.json({ ok: true });
  });

  // Guru submits completed Rombel data -> enters Operator Inbox
  app.post('/api/submissions/submit', (req: Request, res: Response) => {
    try {
      const {
        schoolNpsn = stateCache.dataset.school.npsn,
        rombelId = '',
        submittedBy = 'Guru Kelas',
        submittedByNip = '-',
        notes = '',
      } = (req.body || {}) as {
        schoolNpsn?: string;
        rombelId?: string;
        submittedBy?: string;
        submittedByNip?: string;
        notes?: string;
      };

      const targetNpsn = schoolNpsn || stateCache.dataset.school.npsn;
      const isActive = targetNpsn === stateCache.dataset.school.npsn;
      const loaded = isActive
        ? { dataset: stateCache.dataset, vaultMeta: stateCache.vaultMeta }
        : loadSchoolDataset(targetNpsn);

      if (!loaded) {
        res.status(404).json({ ok: false, error: `Sekolah NPSN ${targetNpsn} tidak ditemukan.` });
        return;
      }

      const { nextDataset, submission } = createGuruSubmission(loaded.dataset, {
        rombelId,
        submittedBy,
        submittedByNip,
        notes,
      });

      let vaultMeta = loaded.vaultMeta;
      if (isActive) {
        persistActiveState(nextDataset);
        vaultMeta = stateCache.vaultMeta;
        broadcastSse('dataset_updated', {
          type: 'GURU_SUBMITTED_TO_OPERATOR',
          activeNpsn: targetNpsn,
          submission,
          dataset: nextDataset,
          schools: listAllSchoolSummaries(),
        });
      } else {
        vaultMeta = saveSchoolDataset(nextDataset);
      }

      res.json({
        ok: true,
        submission,
        dataset: nextDataset,
        vaultMeta,
      });
    } catch (err) {
      res.status(400).json({
        ok: false,
        error: err instanceof Error ? err.message : 'Gagal mengirim data ke akun operator.',
      });
    }
  });

  // Operator chooses: (1) Sinkronkan ke Dapodik OR (2) Langsung Print Rapor
  app.post('/api/submissions/operator-action', (req: Request, res: Response) => {
    try {
      const {
        schoolNpsn = stateCache.dataset.school.npsn,
        submissionId,
        rombelId,
        action,
        operatorName = 'Operator Sekolah',
      } = (req.body || {}) as {
        schoolNpsn?: string;
        submissionId?: string;
        rombelId?: string;
        action?: 'sync_dapodik' | 'print_rapor';
        operatorName?: string;
      };

      if (action !== 'sync_dapodik' && action !== 'print_rapor') {
        res.status(400).json({
          ok: false,
          error: 'Pilihan aksi operator harus "sync_dapodik" atau "print_rapor".',
        });
        return;
      }

      const targetNpsn = schoolNpsn || stateCache.dataset.school.npsn;
      const isActive = targetNpsn === stateCache.dataset.school.npsn;
      const loaded = isActive
        ? { dataset: stateCache.dataset, vaultMeta: stateCache.vaultMeta }
        : loadSchoolDataset(targetNpsn);

      if (!loaded) {
        res.status(404).json({ ok: false, error: `Sekolah NPSN ${targetNpsn} tidak ditemukan.` });
        return;
      }

      const { nextDataset, updatedSubmission } = applyOperatorSubmissionAction(
        loaded.dataset,
        {
          submissionId,
          rombelId,
          action,
          operatorName,
        }
      );

      let vaultMeta = loaded.vaultMeta;
      if (isActive) {
        persistActiveState(nextDataset);
        vaultMeta = stateCache.vaultMeta;
        broadcastSse('dataset_updated', {
          type: 'OPERATOR_SUBMISSION_ACTION',
          activeNpsn: targetNpsn,
          submission: updatedSubmission,
          dataset: nextDataset,
          schools: listAllSchoolSummaries(),
        });
      } else {
        vaultMeta = saveSchoolDataset(nextDataset);
      }

      res.json({
        ok: true,
        submission: updatedSubmission,
        dataset: nextDataset,
        vaultMeta,
      });
    } catch (err) {
      res.status(400).json({
        ok: false,
        error: err instanceof Error ? err.message : 'Gagal memproses pilihan aksi operator.',
      });
    }
  });

  app.post('/api/schools/test-connection', async (req: Request, res: Response) => {
    try {
      const {
        hostUrl = 'http://localhost:5774/WebService',
        npsn = '',
        token = '',
      } = (req.body || {}) as {
        hostUrl?: string;
        npsn?: string;
        token?: string;
      };

      const check = validateSchoolProfileInput({
        npsn,
        namaSekolah: 'Uji Koneksi Sekolah',
        sourceHost: normalizeDapodikWebServiceUrl(hostUrl),
      });
      if (!check.valid) {
        res.status(400).json({ ok: false, reachable: false, error: check.error });
        return;
      }

      const savedConn = loadSchoolConnSecret(check.normalized.npsn, check.normalized.sourceHost);
      const effectiveToken = token.trim() || savedConn.token;

      const result = await fetchDapodikFromWebService({
        hostUrl: check.normalized.sourceHost,
        npsn: check.normalized.npsn,
        token: effectiveToken,
      });

      res.json({
        ok: true,
        reachable: true,
        readOnlyVerified: true,
        detectedSchoolName: result.detectedSchoolName,
        rombelCount: result.rombelCount,
        studentCount: result.studentCount,
      });
    } catch (err) {
      const needsLocalBridge = isLocalOrPrivateUrl(
        String((req.body as { hostUrl?: string })?.hostUrl || '')
      );
      res.status(502).json({
        ok: false,
        reachable: false,
        needsLocalBridge,
        error:
          err instanceof Error
            ? needsLocalBridge
              ? `Server cloud tidak dapat menjangkau alamat lokal/LAN (${err.message}). Gunakan Sinkronisasi via Browser atau jalankan Dapodik Real-Time Bridge di komputer Dapodik sekolah.`
              : `Belum dapat menjangkau WebService Dapodik sekolah tersebut (${err.message}).`
            : 'Gagal menguji koneksi WebService Dapodik.',
      });
    }
  });

  app.post('/api/schools/register', async (req: Request, res: Response) => {
    try {
      const {
        npsn = '',
        namaSekolah = '',
        jenjang = 'SD',
        sourceHost = 'http://localhost:5774/WebService',
        token = '',
        alamat = '-',
        kabupaten = 'Kabupaten/Kota',
        provinsi = 'Indonesia',
        kepalaSekolah = 'Kepala Sekolah',
        nipKepalaSekolah = '-',
        semesterLabel = '2025/2026 Ganjil',
        kurikulum = 'Kurikulum Merdeka',
        mode = 'clean_template',
        importJson,
      } = (req.body || {}) as {
        npsn?: string;
        namaSekolah?: string;
        jenjang?: SchoolJenjang;
        sourceHost?: string;
        token?: string;
        alamat?: string;
        kabupaten?: string;
        provinsi?: string;
        kepalaSekolah?: string;
        nipKepalaSekolah?: string;
        semesterLabel?: string;
        kurikulum?: KurikulumType;
        mode?: 'live_dapodik' | 'import_json' | 'clean_template';
        importJson?: DapodikIncomingPayload;
      };

      const validation = validateSchoolProfileInput({
        npsn,
        namaSekolah,
        sourceHost: normalizeDapodikWebServiceUrl(sourceHost),
      });
      if (!validation.valid) {
        res.status(400).json({ ok: false, error: validation.error });
        return;
      }

      const norm = validation.normalized;
      let initialPayload: DapodikIncomingPayload | undefined;

      if (mode === 'live_dapodik') {
        try {
          const live = await fetchDapodikFromWebService({
            hostUrl: norm.sourceHost,
            npsn: norm.npsn,
            token,
            fallbackSchoolName: norm.namaSekolah,
            fallbackAlamat: alamat,
          });
          initialPayload = live.payload;
        } catch (err) {
          res.status(502).json({
            ok: false,
            error:
              err instanceof Error
                ? `Gagal menarik data langsung dari Dapodik ${norm.sourceHost} (${err.message}). Anda dapat memilih mode "Buat Profil Sekolah Bersih" terlebih dahulu atau "Impor Berkas JSON Dapodik".`
                : 'Gagal menarik data langsung dari Dapodik sekolah.',
          });
          return;
        }
      } else if (mode === 'import_json') {
        if (!importJson || (!Array.isArray(importJson.students) && !Array.isArray(importJson.rombels))) {
          res.status(400).json({
            ok: false,
            error: 'Data JSON Dapodik harus memiliki daftar "students" atau "rombels".',
          });
          return;
        }
        initialPayload = { ...importJson, sourceHost: norm.sourceHost };
      }

      const newDataset = createCleanSchoolDataset({
        npsn: norm.npsn,
        namaSekolah: norm.namaSekolah,
        jenjang,
        sourceHost: norm.sourceHost,
        alamat,
        kabupaten,
        provinsi,
        kepalaSekolah,
        nipKepalaSekolah,
        semesterLabel,
        kurikulum,
        initialPayload,
      });

      const vaultMeta = saveSchoolDataset(newDataset);
      const savedConn = saveSchoolConnSecret({
        npsn: newDataset.school.npsn,
        sourceHost: norm.sourceHost,
        token: token.trim(),
        autoSyncEnabled: false,
        autoSyncIntervalSec: 30,
        bridgeKey: createBridgeKey(newDataset.school.npsn),
        lastLiveChannel: mode === 'live_dapodik' ? 'server_direct' : 'none',
        lastLiveCheckAt: new Date().toISOString(),
      });
      activeRegistry = {
        activeNpsn: newDataset.school.npsn,
        registeredNpsns: Array.from(new Set([...activeRegistry.registeredNpsns, newDataset.school.npsn])),
      };
      saveEncryptedJsonFile(REGISTRY_FILE, activeRegistry);
      stateCache = { dataset: newDataset, vaultMeta };

      const connectionConfig = toPublicConnectionConfig(savedConn);
      const schools = listAllSchoolSummaries();
      broadcastSse('dataset_updated', {
        type: 'SCHOOL_SWITCHED',
        activeNpsn: newDataset.school.npsn,
        dataset: newDataset,
        schools,
        connectionConfig,
      });

      res.json({
        ok: true,
        dataset: newDataset,
        vaultMeta,
        activeNpsn: activeRegistry.activeNpsn,
        schools,
        connectionConfig,
      });
    } catch (err) {
      res.status(500).json({
        ok: false,
        error: err instanceof Error ? err.message : 'Gagal mendaftarkan profil sekolah.',
      });
    }
  });

  app.post('/api/schools/switch', (req: Request, res: Response) => {
    try {
      const { npsn } = (req.body || {}) as { npsn?: string };
      if (!npsn || !activeRegistry.registeredNpsns.includes(npsn)) {
        res.status(404).json({
          ok: false,
          error: 'Profil sekolah dengan NPSN tersebut belum terdaftar.',
        });
        return;
      }

      const loaded = loadSchoolDataset(npsn);
      if (!loaded) {
        res.status(404).json({
          ok: false,
          error: 'Brankas terenkripsi sekolah tidak ditemukan.',
        });
        return;
      }

      activeRegistry = { ...activeRegistry, activeNpsn: npsn };
      saveEncryptedJsonFile(REGISTRY_FILE, activeRegistry);
      stateCache = loaded;

      const conn = loadSchoolConnSecret(npsn, loaded.dataset.school.sourceHost);
      const connectionConfig = toPublicConnectionConfig(conn);
      const schools = listAllSchoolSummaries();
      broadcastSse('dataset_updated', {
        type: 'SCHOOL_SWITCHED',
        activeNpsn: npsn,
        dataset: loaded.dataset,
        schools,
        connectionConfig,
      });

      res.json({
        ok: true,
        dataset: loaded.dataset,
        vaultMeta: loaded.vaultMeta,
        activeNpsn: npsn,
        schools,
        connectionConfig,
      });
    } catch (err) {
      res.status(500).json({
        ok: false,
        error: err instanceof Error ? err.message : 'Gagal berpindah profil sekolah.',
      });
    }
  });

  app.get('/api/sync/events', (req: Request, res: Response) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    sseClients.add(res);
    res.write(
      `event: connected\ndata: ${JSON.stringify({
        activeNpsn: activeRegistry.activeNpsn,
        checksumSha256: stateCache.dataset.school.checksumSha256,
        lastSyncAt: stateCache.dataset.school.lastSyncAt,
      })}\n\n`
    );

    const keepAlive = setInterval(() => {
      try {
        res.write(': keepalive\n\n');
      } catch {
        clearInterval(keepAlive);
        sseClients.delete(res);
      }
    }, 25000);

    req.on('close', () => {
      clearInterval(keepAlive);
      sseClients.delete(res);
    });
  });

  // Persist per-school Dapodik WebService & Real-Time Auto-Sync configuration
  app.post('/api/dapodik/config', (req: Request, res: Response) => {
    try {
      const {
        npsn = stateCache.dataset.school.npsn,
        hostUrl,
        token,
        autoSyncEnabled,
        autoSyncIntervalSec,
      } = (req.body || {}) as {
        npsn?: string;
        hostUrl?: string;
        token?: string;
        autoSyncEnabled?: boolean;
        autoSyncIntervalSec?: number;
      };

      const existing = loadSchoolConnSecret(npsn, stateCache.dataset.school.sourceHost);
      const normalizedHost =
        hostUrl !== undefined ? normalizeDapodikWebServiceUrl(hostUrl) : existing.sourceHost;
      const nextSecret: StoredSchoolConnSecret = {
        ...existing,
        sourceHost: normalizedHost,
        token: token !== undefined && token.trim().length > 0 ? token.trim() : existing.token,
        autoSyncEnabled: autoSyncEnabled !== undefined ? Boolean(autoSyncEnabled) : existing.autoSyncEnabled,
        autoSyncIntervalSec:
          autoSyncIntervalSec !== undefined
            ? Math.max(10, Math.min(600, Number(autoSyncIntervalSec) || 20))
            : existing.autoSyncIntervalSec,
      };
      saveSchoolConnSecret(nextSecret);

      if (npsn === stateCache.dataset.school.npsn && nextSecret.sourceHost !== stateCache.dataset.school.sourceHost) {
        const updatedDataset: EraporDataset = {
          ...stateCache.dataset,
          school: { ...stateCache.dataset.school, sourceHost: nextSecret.sourceHost },
        };
        persistActiveState(updatedDataset);
      }

      res.json({
        ok: true,
        connectionConfig: toPublicConnectionConfig(nextSecret),
      });
    } catch (err) {
      res.status(400).json({
        ok: false,
        error: err instanceof Error ? err.message : 'Gagal menyimpan konfigurasi Dapodik.',
      });
    }
  });

  // Download pre-configured Windows .bat, PowerShell .ps1, or Node .mjs Bridge with saved encrypted token embedded
  app.get('/api/dapodik/bridge-script', (req: Request, res: Response) => {
    const npsn = String(req.query.npsn || stateCache.dataset.school.npsn).trim();
    const rawFormat = String(req.query.format || 'bat').toLowerCase();
    const format = rawFormat === 'mjs' ? 'mjs' : rawFormat === 'ps1' ? 'ps1' : 'bat';
    const loaded =
      npsn === stateCache.dataset.school.npsn
        ? { dataset: stateCache.dataset }
        : loadSchoolDataset(npsn);
    const schoolName = loaded?.dataset.school.namaSekolah || `Sekolah NPSN ${npsn}`;
    const conn = loadSchoolConnSecret(
      npsn,
      loaded?.dataset.school.sourceHost || 'http://localhost:5774/WebService'
    );

    const requestedHost = String(req.query.host || '').trim();
    const dapodikHost = normalizeDapodikWebServiceUrl(requestedHost || conn.sourceHost);

    const proto = String(req.headers['x-forwarded-proto'] || req.protocol || 'http').split(',')[0].trim();
    const hostHeader = String(req.headers['x-forwarded-host'] || req.headers.host || `localhost:${PORT}`).split(',')[0].trim();
    const fallbackOrigin = `${proto}://${hostHeader}`;
    const appOrigin = String(req.query.origin || fallbackOrigin).replace(/\/+$/, '');

    const params = {
      appOrigin,
      npsn,
      namaSekolah: schoolName,
      dapodikHost,
      dapodikToken: conn.token || '',
      bridgeKey: conn.bridgeKey,
      intervalSec: conn.autoSyncIntervalSec || 20,
    };

    res.setHeader('Cache-Control', 'no-store');

    if (format === 'mjs') {
      const script = buildNodeBridgeScript(params);
      res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="penyambung-dapodik-${npsn}.mjs"`);
      res.send(script);
      return;
    }

    if (format === 'ps1') {
      const psScript = buildWindowsPowerShellBridgeScript(params);
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="Sambung-Dapodik-${npsn}.ps1"`);
      res.send(`${psScript}\r\n`);
      return;
    }

    const bat = buildWindowsBridgeBatScript(params);
    res.setHeader('Content-Type', 'application/x-bat; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="Sambung-Dapodik-${npsn}.bat"`);
    res.send(bat);
  });

  // Real-Time Local Bridge Push Endpoint (authenticated per-school x-bridge-key)
  app.post('/api/dapodik/bridge-push', (req: Request, res: Response) => {
    try {
      const {
        npsn = '',
        sourceHost = 'http://localhost:5774/WebService',
        sekolahRaw,
        rombelRaw,
        pesertaDidikRaw,
        gtkRaw,
        payload: directPayload,
      } = (req.body || {}) as {
        npsn?: string;
        sourceHost?: string;
        sekolahRaw?: unknown;
        rombelRaw?: unknown;
        pesertaDidikRaw?: unknown;
        gtkRaw?: unknown;
        payload?: DapodikIncomingPayload;
      };

      const targetNpsn = String(npsn).trim();
      if (!targetNpsn || !activeRegistry.registeredNpsns.includes(targetNpsn)) {
        res.status(404).json({ ok: false, error: `NPSN ${targetNpsn} belum terdaftar di e-Rapor.` });
        return;
      }

      const conn = loadSchoolConnSecret(targetNpsn, sourceHost);
      const headerKey = String(req.headers['x-bridge-key'] || '').trim();
      if (!headerKey || headerKey !== conn.bridgeKey) {
        res.status(401).json({ ok: false, error: 'Bridge Key tidak valid atau kedaluwarsa.' });
        return;
      }

      const loadedTarget =
        targetNpsn === stateCache.dataset.school.npsn
          ? { dataset: stateCache.dataset, vaultMeta: stateCache.vaultMeta }
          : loadSchoolDataset(targetNpsn);

      if (!loadedTarget) {
        res.status(404).json({ ok: false, error: 'Brankas sekolah tidak ditemukan.' });
        return;
      }

      const parsed = directPayload
        ? {
            payload: directPayload,
            rombelCount: directPayload.rombels?.length ?? loadedTarget.dataset.rombels.length,
            studentCount: directPayload.students?.length ?? loadedTarget.dataset.students.length,
          }
        : parseDapodikWebServiceResponses({
            sourceHost,
            npsn: targetNpsn,
            sekolahRaw,
            rombelRaw,
            pesertaDidikRaw,
            gtkRaw,
            fallbackSchoolName: loadedTarget.dataset.school.namaSekolah,
            fallbackAlamat: loadedTarget.dataset.school.alamat,
            fallbackRombelId: loadedTarget.dataset.rombels[0]?.id,
          });

      const { nextDataset, diff } = reconcileDapodikSync(
        loadedTarget.dataset,
        parsed.payload,
        'Bridge Dapodik Real-Time (Read-Only GET)'
      );

      const changed = hasDapodikSyncChanges(diff);
      const savedConn = saveSchoolConnSecret({
        ...conn,
        sourceHost: sourceHost.trim().replace(/\/+$/, ''),
        lastLiveChannel: 'local_bridge',
        lastLiveCheckAt: new Date().toISOString(),
        lastLiveMessage: changed
          ? `Sinkron real-time: +${diff.addedStudents} baru, ${diff.updatedStudents} diubah`
          : 'Terhubung real-time (tidak ada perubahan baru)',
      });

      const finalDataset: EraporDataset = changed
        ? nextDataset
        : {
            ...loadedTarget.dataset,
            school: {
              ...loadedTarget.dataset.school,
              sourceHost: nextDataset.school.sourceHost,
              lastSyncAt: nextDataset.school.lastSyncAt,
              readOnlyVerified: true,
            },
          };

      if (targetNpsn === stateCache.dataset.school.npsn) {
        persistActiveState(finalDataset);
        const schools = listAllSchoolSummaries();
        broadcastSse('dataset_updated', {
          type: 'DAPODIK_BRIDGE_SYNC',
          activeNpsn: targetNpsn,
          diff,
          dataset: finalDataset,
          schools,
          connectionConfig: toPublicConnectionConfig(savedConn),
        });
      } else {
        saveSchoolDataset(finalDataset);
      }

      res.json({
        ok: true,
        changed,
        diff,
        studentCount: finalDataset.students.length,
        rombelCount: finalDataset.rombels.length,
        connectionConfig: toPublicConnectionConfig(savedConn),
      });
    } catch (err) {
      res.status(500).json({
        ok: false,
        error: err instanceof Error ? err.message : 'Gagal memproses dorongan Bridge Dapodik.',
      });
    }
  });

  // Strict Read-Only Dapodik WebService Sync (GET only)
  app.post('/api/dapodik/sync-live', async (req: Request, res: Response) => {
    try {
      const {
        hostUrl = stateCache.dataset.school.sourceHost,
        npsn = stateCache.dataset.school.npsn,
        token = '',
        mode = 'live',
      } = (req.body || {}) as {
        hostUrl?: string;
        npsn?: string;
        token?: string;
        mode?: 'live' | 'simulate_delta';
      };

      const cleanBase = normalizeDapodikWebServiceUrl(hostUrl);
      const targetUrl = `${cleanBase}/getPesertaDidik?npsn=${encodeURIComponent(npsn.trim())}`;

      // Enforce Read-Only Guard before any Dapodik request
      assertDapodikReadOnlyMethod('GET', targetUrl);

      if (mode === 'simulate_delta') {
        const current = stateCache.dataset;
        const nextNum = current.students.length + 1;
        const padId = String(nextNum).padStart(3, '0');
        const targetRombel = current.rombels[0]?.id || `rombel-${current.school.npsn}-1`;
        const newStudent: DapodikStudent = {
          id: `std-dapo-${current.school.npsn}-${padId}`,
          pesertaDidikId: `PD-${npsn}-${padId}`,
          nisn: `014829${String(1040 + nextNum)}`,
          nipd: `2122${padId}`,
          nama:
            nextNum % 2 === 0
              ? `I Gusti Agung Bagus Pratama ${nextNum}`
              : `Ni Luh Putu Ratna Dewi ${nextNum}`,
          jenisKelamin: nextNum % 2 === 0 ? 'L' : 'P',
          tempatLahir: current.school.kabupaten || 'Denpasar',
          tanggalLahir: '2013-04-18',
          agama: 'Islam',
          rombelId: targetRombel,
          namaOrangTua: 'Orang Tua / Wali Siswa',
          alamat: current.school.alamat || '-',
          statusAktif: 'Aktif',
        };

        const alreadyExists = current.students.some(
          (s) => s.pesertaDidikId === newStudent.pesertaDidikId
        );
        const updatedStudents = alreadyExists
          ? current.students
          : [...current.students, newStudent];

        const { nextDataset, diff } = reconcileDapodikSync(
          current,
          {
            sourceHost: cleanBase,
            students: updatedStudents,
          },
          'Simulasi Uji Mutasi Dapodik (Read-Only)'
        );
        persistActiveState(nextDataset);
        const schools = listAllSchoolSummaries();
        broadcastSse('dataset_updated', {
          type: 'DAPODIK_SYNC',
          activeNpsn: nextDataset.school.npsn,
          diff,
          dataset: nextDataset,
          schools,
        });
        res.json({
          ok: true,
          mode: 'simulate_delta',
          diff,
          dataset: nextDataset,
          vaultMeta: stateCache.vaultMeta,
          schools,
        });
        return;
      }

      const existingConn = loadSchoolConnSecret(npsn, cleanBase);
      const effectiveToken = token.trim() || existingConn.token;
      const updatedConnBase = saveSchoolConnSecret({
        ...existingConn,
        sourceHost: cleanBase,
        token: effectiveToken,
      });

      try {
        const liveResult = await fetchDapodikFromWebService({
          hostUrl: cleanBase,
          npsn,
          token: effectiveToken,
          fallbackSchoolName: stateCache.dataset.school.namaSekolah,
          fallbackAlamat: stateCache.dataset.school.alamat,
          fallbackRombelId: stateCache.dataset.rombels[0]?.id,
        });

        const { nextDataset, diff } = reconcileDapodikSync(
          stateCache.dataset,
          liveResult.payload,
          'WebService Dapodik Live (GET Read-Only)'
        );
        persistActiveState(nextDataset);
        const savedConn = saveSchoolConnSecret({
          ...updatedConnBase,
          lastLiveChannel: 'server_direct',
          lastLiveCheckAt: new Date().toISOString(),
          lastLiveMessage: `Berhasil menarik ${liveResult.studentCount} siswa & ${liveResult.rombelCount} rombel`,
        });
        const connectionConfig = toPublicConnectionConfig(savedConn);
        const schools = listAllSchoolSummaries();
        broadcastSse('dataset_updated', {
          type: 'DAPODIK_SYNC',
          activeNpsn: nextDataset.school.npsn,
          diff,
          dataset: nextDataset,
          schools,
          connectionConfig,
        });
        res.json({
          ok: true,
          mode: 'live',
          via: 'server_direct',
          diff,
          dataset: nextDataset,
          vaultMeta: stateCache.vaultMeta,
          schools,
          connectionConfig,
        });
      } catch (fetchErr) {
        const needsLocalBridge = isLocalOrPrivateUrl(cleanBase);
        const msg = fetchErr instanceof Error ? fetchErr.message : 'Koneksi gagal';
        saveSchoolConnSecret({
          ...updatedConnBase,
          lastLiveCheckAt: new Date().toISOString(),
          lastLiveMessage: msg,
        });
        res.status(502).json({
          ok: false,
          serverReachable: false,
          needsLocalBridge,
          error: needsLocalBridge
            ? `Server cloud belum dapat mengakses WebService lokal ${cleanBase} (${msg}).`
            : `Tidak dapat menjangkau server Dapodik di ${cleanBase} (${msg}).`,
        });
      }
    } catch (err) {
      res.status(400).json({
        ok: false,
        error: err instanceof Error ? err.message : 'Kesalahan validasi sinkronisasi Dapodik.',
      });
    }
  });

  app.post('/api/dapodik/import-json', (req: Request, res: Response) => {
    try {
      const payload = req.body as DapodikIncomingPayload & { syncChannel?: 'browser_direct' | 'file_import' };
      if (!payload || (!Array.isArray(payload.students) && !Array.isArray(payload.rombels))) {
        res.status(400).json({
          ok: false,
          error: 'Format JSON Dapodik tidak valid. Diperlukan daftar "students" atau "rombels".',
        });
        return;
      }
      const actor =
        payload.syncChannel === 'browser_direct'
          ? 'Browser-Direct WebService Dapodik (GET Read-Only)'
          : 'Impor Berkas Dapodik (Read-Only)';

      const { nextDataset, diff } = reconcileDapodikSync(
        stateCache.dataset,
        payload,
        actor
      );
      const changed = hasDapodikSyncChanges(diff);
      const finalDataset = changed
        ? nextDataset
        : {
            ...stateCache.dataset,
            school: {
              ...stateCache.dataset.school,
              sourceHost: nextDataset.school.sourceHost,
              lastSyncAt: nextDataset.school.lastSyncAt,
              readOnlyVerified: true,
            },
          };

      persistActiveState(finalDataset);

      const conn = loadSchoolConnSecret(finalDataset.school.npsn, finalDataset.school.sourceHost);
      const savedConn =
        payload.syncChannel === 'browser_direct'
          ? saveSchoolConnSecret({
              ...conn,
              sourceHost: finalDataset.school.sourceHost,
              lastLiveChannel: 'browser_direct',
              lastLiveCheckAt: new Date().toISOString(),
              lastLiveMessage: `Sinkron langsung browser: ${finalDataset.students.length} siswa`,
            })
          : conn;

      const connectionConfig = toPublicConnectionConfig(savedConn);
      const schools = listAllSchoolSummaries();
      broadcastSse('dataset_updated', {
        type: 'DAPODIK_IMPORT',
        activeNpsn: finalDataset.school.npsn,
        diff,
        dataset: finalDataset,
        schools,
        connectionConfig,
      });
      res.json({
        ok: true,
        diff,
        dataset: finalDataset,
        vaultMeta: stateCache.vaultMeta,
        schools,
        connectionConfig,
      });
    } catch (err) {
      res.status(500).json({
        ok: false,
        error: err instanceof Error ? err.message : 'Gagal memproses impor JSON Dapodik.',
      });
    }
  });

  app.post('/api/rapor/subject-kktp', (req: Request, res: Response) => {
    try {
      const {
        schoolNpsn,
        updates = [],
        actor = 'Guru Mata Pelajaran',
      } = (req.body || {}) as {
        schoolNpsn?: string;
        updates?: Array<{ mapelId: string; kktp: number }>;
        actor?: string;
      };

      const targetNpsn = schoolNpsn || stateCache.dataset.school.npsn;
      const isActiveTarget = targetNpsn === stateCache.dataset.school.npsn;
      const loadedTarget = isActiveTarget
        ? { dataset: stateCache.dataset, vaultMeta: stateCache.vaultMeta }
        : loadSchoolDataset(targetNpsn);

      if (!loadedTarget) {
        res.status(404).json({
          ok: false,
          error: `Sekolah dengan NPSN ${targetNpsn} tidak ditemukan.`,
        });
        return;
      }

      const { nextDataset, updatedSubjects, recalculatedGradesCount } =
        updateSubjectsKktp(loadedTarget.dataset, { updates, actor });

      let resultMeta: Omit<ServerEncryptedFile, 'ciphertextB64'>;
      if (isActiveTarget) {
        persistActiveState(nextDataset);
        resultMeta = stateCache.vaultMeta;
        broadcastSse('dataset_updated', {
          type: 'KKTP_UPDATED',
          activeNpsn: nextDataset.school.npsn,
          updatedSubjects: updatedSubjects.length,
          dataset: nextDataset,
          schools: listAllSchoolSummaries(),
        });
      } else {
        resultMeta = saveSchoolDataset(nextDataset);
      }

      res.json({
        ok: true,
        updatedSubjects,
        recalculatedGradesCount,
        dataset: nextDataset,
        vaultMeta: resultMeta,
      });
    } catch (err) {
      res.status(400).json({
        ok: false,
        error: err instanceof Error ? err.message : 'Gagal memperbarui KKTP mata pelajaran.',
      });
    }
  });

  app.post('/api/rapor/subject-mapping', (req: Request, res: Response) => {
    try {
      const {
        schoolNpsn,
        id,
        kode = '',
        nama = '',
        kelompok = 'Umum',
        kkm = 75,
        guruPengampu = '',
        nipGuru = '-',
        tingkatList,
        actor = 'Operator / Guru',
      } = (req.body || {}) as {
        schoolNpsn?: string;
        id?: string;
        kode?: string;
        nama?: string;
        kelompok?: 'Umum' | 'Muatan Lokal' | 'Pilihan';
        kkm?: number;
        guruPengampu?: string;
        nipGuru?: string;
        tingkatList?: number[];
        actor?: string;
      };

      const targetNpsn = schoolNpsn || stateCache.dataset.school.npsn;
      const isActiveTarget = targetNpsn === stateCache.dataset.school.npsn;
      const loadedTarget = isActiveTarget
        ? { dataset: stateCache.dataset, vaultMeta: stateCache.vaultMeta }
        : loadSchoolDataset(targetNpsn);

      if (!loadedTarget) {
        res.status(404).json({
          ok: false,
          error: `Sekolah dengan NPSN ${targetNpsn} tidak ditemukan.`,
        });
        return;
      }

      const { nextDataset, subject, created } = upsertSubjectMapping(loadedTarget.dataset, {
        id,
        kode,
        nama,
        kelompok,
        kkm: Number(kkm),
        guruPengampu,
        nipGuru,
        tingkatList,
        actor,
      });

      let resultMeta: Omit<ServerEncryptedFile, 'ciphertextB64'>;
      if (isActiveTarget) {
        persistActiveState(nextDataset);
        resultMeta = stateCache.vaultMeta;
        broadcastSse('dataset_updated', {
          type: 'SUBJECT_MAPPING_UPDATED',
          activeNpsn: nextDataset.school.npsn,
          dataset: nextDataset,
          schools: listAllSchoolSummaries(),
        });
      } else {
        resultMeta = saveSchoolDataset(nextDataset);
      }

      res.json({
        ok: true,
        subject,
        created,
        dataset: nextDataset,
        vaultMeta: resultMeta,
      });
    } catch (err) {
      res.status(400).json({
        ok: false,
        error: err instanceof Error ? err.message : 'Gagal menyimpan pemetaan mata pelajaran.',
      });
    }
  });

  app.post('/api/rapor/tp', (req: Request, res: Response) => {
    try {
      const {
        schoolNpsn,
        action = 'upsert',
        id,
        mapelId = '',
        tingkat = 6,
        kode = '',
        deskripsi = '',
        levelMendalam,
        dimensiProfil,
        actor = 'Guru Mata Pelajaran',
      } = (req.body || {}) as {
        schoolNpsn?: string;
        action?: 'upsert' | 'delete';
        id?: string;
        mapelId?: string;
        tingkat?: number;
        kode?: string;
        deskripsi?: string;
        levelMendalam?: DeepLearningLevel;
        dimensiProfil?: string[];
        actor?: string;
      };

      const targetNpsn = schoolNpsn || stateCache.dataset.school.npsn;
      const isActiveTarget = targetNpsn === stateCache.dataset.school.npsn;
      const loadedTarget = isActiveTarget
        ? { dataset: stateCache.dataset, vaultMeta: stateCache.vaultMeta }
        : loadSchoolDataset(targetNpsn);

      if (!loadedTarget) {
        res.status(404).json({
          ok: false,
          error: `Sekolah dengan NPSN ${targetNpsn} tidak ditemukan.`,
        });
        return;
      }

      let nextDataset: EraporDataset;
      if (action === 'delete') {
        if (!id) throw new Error('ID Tujuan Pembelajaran wajib disertakan untuk menghapus.');
        nextDataset = deleteTujuanPembelajaran(loadedTarget.dataset, id, actor);
      } else {
        nextDataset = upsertTujuanPembelajaran(loadedTarget.dataset, {
          id,
          mapelId,
          tingkat: Number(tingkat),
          kode,
          deskripsi,
          levelMendalam,
          dimensiProfil,
          actor,
        }).nextDataset;
      }

      let resultMeta: Omit<ServerEncryptedFile, 'ciphertextB64'>;
      if (isActiveTarget) {
        persistActiveState(nextDataset);
        resultMeta = stateCache.vaultMeta;
        broadcastSse('dataset_updated', {
          type: 'TP_UPDATED',
          activeNpsn: nextDataset.school.npsn,
          dataset: nextDataset,
          schools: listAllSchoolSummaries(),
        });
      } else {
        resultMeta = saveSchoolDataset(nextDataset);
      }

      res.json({
        ok: true,
        dataset: nextDataset,
        vaultMeta: resultMeta,
      });
    } catch (err) {
      res.status(400).json({
        ok: false,
        error: err instanceof Error ? err.message : 'Gagal memperbarui Tujuan Pembelajaran.',
      });
    }
  });

  app.post('/api/rapor/activate-kka', (req: Request, res: Response) => {
    try {
      const { schoolNpsn, actor = 'Operator / Kurikulum Sekolah' } = (req.body || {}) as {
        schoolNpsn?: string;
        actor?: string;
      };

      const targetNpsn = schoolNpsn || stateCache.dataset.school.npsn;
      const isActiveTarget = targetNpsn === stateCache.dataset.school.npsn;
      const loadedTarget = isActiveTarget
        ? { dataset: stateCache.dataset, vaultMeta: stateCache.vaultMeta }
        : loadSchoolDataset(targetNpsn);

      if (!loadedTarget) {
        res.status(404).json({
          ok: false,
          error: `Sekolah dengan NPSN ${targetNpsn} tidak ditemukan.`,
        });
        return;
      }

      const { nextDataset, alreadyActive, addedTpCount } = activateKkaElective(
        loadedTarget.dataset,
        actor
      );

      let resultMeta: Omit<ServerEncryptedFile, 'ciphertextB64'>;
      if (isActiveTarget) {
        persistActiveState(nextDataset);
        resultMeta = stateCache.vaultMeta;
        broadcastSse('dataset_updated', {
          type: 'KKA_ACTIVATED',
          activeNpsn: nextDataset.school.npsn,
          dataset: nextDataset,
          schools: listAllSchoolSummaries(),
        });
      } else {
        resultMeta = saveSchoolDataset(nextDataset);
      }

      res.json({
        ok: true,
        alreadyActive,
        addedTpCount,
        dataset: nextDataset,
        vaultMeta: resultMeta,
      });
    } catch (err) {
      res.status(400).json({
        ok: false,
        error:
          err instanceof Error
            ? err.message
            : 'Gagal mengaktifkan mata pelajaran pilihan KKA.',
      });
    }
  });

  app.post('/api/rapor/sync-batch', (req: Request, res: Response) => {
    try {
      const {
        schoolNpsn,
        grades = [],
        waliRecords = [],
        subjectKktpUpdates = [],
        actor = 'Guru / Wali Kelas',
      } = (req.body || {}) as {
        schoolNpsn?: string;
        grades?: StudentGradeRecord[];
        waliRecords?: WaliKelasRecord[];
        subjectKktpUpdates?: Array<{ mapelId: string; kktp: number }>;
        actor?: string;
      };

      const targetNpsn = schoolNpsn || stateCache.dataset.school.npsn;
      const isActiveTarget = targetNpsn === stateCache.dataset.school.npsn;
      const loadedTarget = isActiveTarget
        ? { dataset: stateCache.dataset, vaultMeta: stateCache.vaultMeta }
        : loadSchoolDataset(targetNpsn);

      if (!loadedTarget) {
        res.status(404).json({
          ok: false,
          error: `Sekolah dengan NPSN ${targetNpsn} tidak ditemukan.`,
        });
        return;
      }

      let workingDataset = loadedTarget.dataset;
      if (subjectKktpUpdates.length > 0) {
        workingDataset = updateSubjectsKktp(workingDataset, {
          updates: subjectKktpUpdates,
          actor,
        }).nextDataset;
      }

      const gradeMap = new Map(workingDataset.grades.map((g) => [g.id, g]));
      for (const g of grades) {
        gradeMap.set(g.id, { ...g, syncStatus: 'synced' });
      }

      const waliMap = new Map(workingDataset.waliRecords.map((w) => [w.id, w]));
      for (const w of waliRecords) {
        waliMap.set(w.id, { ...w, syncStatus: 'synced' });
      }

      const nextGrades = Array.from(gradeMap.values());
      const nextWali = Array.from(waliMap.values());
      const auditHash = computeDeterministicChecksum({
        gradesCount: grades.length,
        waliCount: waliRecords.length,
        kktpCount: subjectKktpUpdates.length,
        ts: Date.now(),
      }).slice(0, 16);

      const newAudit: AuditLogEntry = {
        id: `aud-sync-${Date.now()}`,
        timestamp: new Date().toISOString(),
        actor,
        action: 'SINKRON_NILAI_OFFLINE_KE_SERVER',
        target: `${grades.length} Nilai Mapel · ${waliRecords.length} Catatan Wali · ${subjectKktpUpdates.length} KKTP`,
        readOnlyGuardPassed: true,
        integrityHash: auditHash,
      };

      const nextDataset: EraporDataset = {
        ...workingDataset,
        grades: nextGrades,
        waliRecords: nextWali,
        auditLogs: [newAudit, ...workingDataset.auditLogs].slice(0, 40),
      };

      let resultMeta: Omit<ServerEncryptedFile, 'ciphertextB64'>;
      if (isActiveTarget) {
        persistActiveState(nextDataset);
        resultMeta = stateCache.vaultMeta;
        broadcastSse('dataset_updated', {
          type: 'RAPOR_SYNC',
          activeNpsn: nextDataset.school.npsn,
          syncedGrades: grades.length,
          syncedWali: waliRecords.length,
          dataset: nextDataset,
          schools: listAllSchoolSummaries(),
        });
      } else {
        resultMeta = saveSchoolDataset(nextDataset);
      }

      res.json({
        ok: true,
        syncedCount: grades.length + waliRecords.length + subjectKktpUpdates.length,
        dataset: nextDataset,
        vaultMeta: resultMeta,
      });
    } catch (err) {
      res.status(500).json({
        ok: false,
        error: err instanceof Error ? err.message : 'Gagal menyinkronkan batch nilai ke server.',
      });
    }
  });

  // Server-Side Gemini Pedagogical Analysis with ThinkingLevel.HIGH
  app.post('/api/ai/analyze', async (req: Request, res: Response) => {
    const { question = 'Berikan ringkasan eksekutif kesiapan rapor sekolah dan prioritas intervensi belajar.', rombelId = 'all' } =
      (req.body || {}) as { question?: string; rombelId?: string };

    const dataset = stateCache.dataset;
    const metrics = computePrincipalMetrics(dataset);
    const filteredIntervention =
      rombelId === 'all'
        ? metrics.interventionList
        : metrics.interventionList.filter((item) => {
            const rb = dataset.rombels.find((r) => r.nama === item.rombelName);
            return rb?.id === rombelId;
          });

    const ai = buildAiClient();
    if (!ai) {
      res.status(503).json({
        ok: false,
        code: 'GEMINI_NOT_CONFIGURED',
        error:
          'Kunci API Gemini belum dikonfigurasi di Secrets panel. Anda tetap dapat menggunakan Analisis Diagnostik Lokal (Offline).',
        metricsSummary: {
          overallCompletionPct: metrics.overallCompletionPct,
          schoolAverageScore: metrics.schoolAverageScore,
          interventionCount: filteredIntervention.length,
        },
      });
      return;
    }

    try {
      const readiness = computeDeepLearningReadiness(dataset);
      const promptContext = {
        sekolah: dataset.school.namaSekolah,
        npsn: dataset.school.npsn,
        semester: dataset.school.semesterLabel,
        kurikulum: dataset.school.kurikulum,
        ringkasan: {
          totalSiswa: metrics.totalStudents,
          totalRombel: metrics.totalRombels,
          persentaseInputNilai: metrics.overallCompletionPct,
          rataRataSekolah: metrics.schoolAverageScore,
          siswaPerluBimbingan: metrics.studentsBelowKkmCount,
        },
        kesiapanPembelajaranMendalam: readiness,
        progresRombel: metrics.rombelProgress,
        statistikMapel: metrics.subjectStats,
        daftarIntervensi: filteredIntervention.slice(0, 15),
      };

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: `Pertanyaan Kepala Sekolah / Guru:\n${question}\n\nData Terverifikasi Dapodik & e-Rapor (Kurikulum Pembelajaran Mendalam 2026):\n${JSON.stringify(promptContext, null, 2)}`,
        config: {
          systemInstruction:
            'Anda adalah Pengawas Sekolah & Konsultan Kurikulum Pembelajaran Mendalam Kemdikdasmen 2026 (Permendikdasmen No. 10 & No. 13 Tahun 2025, terinspirasi ketelitian e-Rapor Bapak Pasek di Bali). Berikan analisis pedagogis mendalam mencakup taksonomi Memahami-Mengaplikasi-Merefleksi, penguatan 8 Dimensi Profil Lulusan pada Kokurikuler lintas disiplin, kesiapan Mapel Pilihan Koding & Kecerdasan Artifisial (KKA), dan prioritas intervensi remedial bagi Kepala Sekolah, Wali Kelas, dan Guru Mapel dalam Bahasa Indonesia yang formal, lugas, dan berbasis angka.',
          thinkingConfig: {
            thinkingLevel: ThinkingLevel.HIGH,
          },
        },
      });

      res.json({
        ok: true,
        model: 'gemini-4-hydrogen',
        thinkingLevel: 'HIGH',
        analysis: response.text ?? 'Analisis tidak menghasilkan teks.',
        generatedAt: new Date().toISOString(),
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      res.status(502).json({
        ok: false,
        code: 'GEMINI_API_ERROR',
        error: `Gagal memanggil layanan analisis Gemini: ${msg}`,
      });
    }
  });

  // Guarantee /api/* never falls through to HTML SPA fallback or Express default HTML error pages
  app.use('/api', (_req: Request, res: Response) => {
    res.status(404).json({ ok: false, error: 'Endpoint API tidak ditemukan.' });
  });
  app.use(
    '/api',
    (err: unknown, _req: Request, res: Response, _next: express.NextFunction) => {
      const status =
        typeof (err as { status?: number })?.status === 'number'
          ? (err as { status: number }).status
          : 500;
      const msg =
        err instanceof Error ? err.message : 'Terjadi kesalahan pada server API.';
      res.status(status).json({ ok: false, error: msg });
    }
  );

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
        ws: false,
      },
      appType: 'spa',
    });
    app.get('/@vite/client', async (_req: Request, res: Response, next) => {
      try {
        const result = await vite.transformRequest('/@vite/client');
        if (!result) {
          next();
          return;
        }
        const patchedCode = result.code.replace(
          /let wsTransport = createWebSocketModuleRunnerTransport\([\s\S]*?\}\);/,
          'let wsTransport = { async connect() {}, async disconnect() {}, send() {} };'
        );
        res.type('application/javascript').send(patchedCode);
      } catch {
        next();
      }
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('/{*splat}', (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  // Server-side background real-time auto-poller (for locally hosted or tunnel-exposed Dapodik WebServices)
  let lastAutoPollMs = 0;
  let autoPollInFlight = false;
  setInterval(() => {
    if (autoPollInFlight) return;
    const activeNpsn = stateCache.dataset.school.npsn;
    const conn = loadSchoolConnSecret(activeNpsn, stateCache.dataset.school.sourceHost);
    if (!conn.autoSyncEnabled) return;
    const intervalMs = Math.max(10, conn.autoSyncIntervalSec || 30) * 1000;
    if (Date.now() - lastAutoPollMs < intervalMs) return;

    lastAutoPollMs = Date.now();
    autoPollInFlight = true;
    void (async () => {
      try {
        const live = await fetchDapodikFromWebService({
          hostUrl: conn.sourceHost,
          npsn: activeNpsn,
          token: conn.token,
          fallbackSchoolName: stateCache.dataset.school.namaSekolah,
          fallbackAlamat: stateCache.dataset.school.alamat,
          fallbackRombelId: stateCache.dataset.rombels[0]?.id,
        });
        const { nextDataset, diff } = reconcileDapodikSync(
          stateCache.dataset,
          live.payload,
          'Auto-Sync Server Dapodik (GET Read-Only)'
        );
        const changed = hasDapodikSyncChanges(diff);
        const savedConn = saveSchoolConnSecret({
          ...conn,
          lastLiveChannel: 'server_direct',
          lastLiveCheckAt: new Date().toISOString(),
          lastLiveMessage: changed
            ? `Auto-sync: +${diff.addedStudents} baru, ${diff.updatedStudents} diubah`
            : `Terhubung otomatis (${live.studentCount} siswa)`,
        });
        if (changed) {
          persistActiveState(nextDataset);
          const schools = listAllSchoolSummaries();
          broadcastSse('dataset_updated', {
            type: 'DAPODIK_AUTO_SYNC',
            activeNpsn,
            diff,
            dataset: nextDataset,
            schools,
            connectionConfig: toPublicConnectionConfig(savedConn),
          });
        }
      } catch {
        // Silently skip failed tick when Dapodik PC is unreachable from server (local/cloud split)
      } finally {
        autoPollInFlight = false;
      }
    })();
  }, 5000);

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`e-Rapor Dapodik Nusantara running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
