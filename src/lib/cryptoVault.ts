// Client-side AES-256-GCM Encryption & SHA-256 Integrity Engine using Web Crypto API

export interface EncryptedEnvelope {
  version: 'ERAPOR-AES256-GCM-V1';
  algorithm: 'AES-256-GCM';
  kdf: 'PBKDF2-SHA256';
  iterations: number;
  saltB64: string;
  ivB64: string;
  ciphertextB64: string;
  integritySha256: string;
  encryptedAt: string;
}

const DEFAULT_DEVICE_VAULT_KEY = 'ERAPOR-DAPODIK-NUSANTARA-LOCAL-VAULT-2026';

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export async function sha256Hex(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const hashBuf = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

async function deriveAesKey(passphrase: string, salt: Uint8Array): Promise<CryptoKey> {
  const rawKey = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(passphrase),
    'PBKDF2',
    false,
    ['deriveKey']
  );

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt as BufferSource,
      iterations: 100000,
      hash: 'SHA-256',
    },
    rawKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

export async function encryptPayload<T>(
  payload: T,
  passphrase: string = DEFAULT_DEVICE_VAULT_KEY
): Promise<EncryptedEnvelope> {
  const plaintext = JSON.stringify(payload);
  const integritySha256 = await sha256Hex(plaintext);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveAesKey(passphrase || DEFAULT_DEVICE_VAULT_KEY, salt);

  const encryptedBuffer = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv as BufferSource },
    key,
    new TextEncoder().encode(plaintext)
  );

  return {
    version: 'ERAPOR-AES256-GCM-V1',
    algorithm: 'AES-256-GCM',
    kdf: 'PBKDF2-SHA256',
    iterations: 100000,
    saltB64: bytesToBase64(salt),
    ivB64: bytesToBase64(iv),
    ciphertextB64: bytesToBase64(new Uint8Array(encryptedBuffer)),
    integritySha256,
    encryptedAt: new Date().toISOString(),
  };
}

export async function decryptPayload<T>(
  envelope: EncryptedEnvelope,
  passphrase: string = DEFAULT_DEVICE_VAULT_KEY
): Promise<T> {
  const salt = base64ToBytes(envelope.saltB64);
  const iv = base64ToBytes(envelope.ivB64);
  const ciphertext = base64ToBytes(envelope.ciphertextB64);
  const key = await deriveAesKey(passphrase || DEFAULT_DEVICE_VAULT_KEY, salt);

  const decryptedBuffer = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: iv as BufferSource },
    key,
    ciphertext as BufferSource
  );

  const plaintext = new TextDecoder().decode(decryptedBuffer);
  const actualHash = await sha256Hex(plaintext);
  if (actualHash !== envelope.integritySha256) {
    throw new Error('Integritas data terenkripsi tidak cocok (SHA-256 mismatch).');
  }
  return JSON.parse(plaintext) as T;
}
