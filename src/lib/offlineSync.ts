import type { EraporDataset, StudentGradeRecord, WaliKelasRecord } from './eraporCore';
import { decryptPayload, encryptPayload, type EncryptedEnvelope } from './cryptoVault';

export interface SubjectKktpMutationPayload {
  updates: Array<{ mapelId: string; kktp: number }>;
  actor?: string;
}

export interface OutboxMutation {
  id: string;
  schoolNpsn: string;
  type: 'UPSERT_GRADE' | 'UPSERT_WALI' | 'UPDATE_SUBJECT_KKTP';
  payload: StudentGradeRecord | WaliKelasRecord | SubjectKktpMutationPayload;
  createdAt: string;
}

const DB_NAME = 'erapor-dapodik-vault-db';
const DB_VERSION = 1;
const STORE_SNAPSHOT = 'encrypted_snapshot';
const STORE_OUTBOX = 'sync_outbox';

function getSnapshotKey(npsn: string): string {
  return `snapshot_${npsn}`;
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_SNAPSHOT)) {
        db.createObjectStore(STORE_SNAPSHOT);
      }
      if (!db.objectStoreNames.contains(STORE_OUTBOX)) {
        db.createObjectStore(STORE_OUTBOX, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveEncryptedSnapshotOffline(
  dataset: EraporDataset,
  passphrase?: string
): Promise<EncryptedEnvelope> {
  const envelope = await encryptPayload(dataset, passphrase);
  const db = await openDatabase();
  const key = getSnapshotKey(dataset.school.npsn);
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_SNAPSHOT, 'readwrite');
    tx.objectStore(STORE_SNAPSHOT).put(envelope, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
  return envelope;
}

export async function loadEncryptedSnapshotOffline(
  npsn: string,
  passphrase?: string
): Promise<{ dataset: EraporDataset; envelope: EncryptedEnvelope } | null> {
  const db = await openDatabase();
  const key = getSnapshotKey(npsn);
  const envelope = await new Promise<EncryptedEnvelope | undefined>((resolve, reject) => {
    const tx = db.transaction(STORE_SNAPSHOT, 'readonly');
    const req = tx.objectStore(STORE_SNAPSHOT).get(key);
    req.onsuccess = () => resolve(req.result as EncryptedEnvelope | undefined);
    req.onerror = () => reject(req.error);
  });
  db.close();

  if (!envelope) return null;
  const dataset = await decryptPayload<EraporDataset>(envelope, passphrase);
  return { dataset, envelope };
}

export async function enqueueOfflineMutation(mutation: OutboxMutation): Promise<void> {
  const db = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_OUTBOX, 'readwrite');
    tx.objectStore(STORE_OUTBOX).put(mutation);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

export async function getOfflineOutbox(schoolNpsn?: string): Promise<OutboxMutation[]> {
  const db = await openDatabase();
  const items = await new Promise<OutboxMutation[]>((resolve, reject) => {
    const tx = db.transaction(STORE_OUTBOX, 'readonly');
    const req = tx.objectStore(STORE_OUTBOX).getAll();
    req.onsuccess = () => resolve((req.result as OutboxMutation[]) ?? []);
    req.onerror = () => reject(req.error);
  });
  db.close();
  const filtered = schoolNpsn
    ? items.filter((item) => !item.schoolNpsn || item.schoolNpsn === schoolNpsn)
    : items;
  return filtered.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export async function clearOfflineOutboxIds(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const db = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_OUTBOX, 'readwrite');
    const store = tx.objectStore(STORE_OUTBOX);
    for (const id of ids) {
      store.delete(id);
    }
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}
