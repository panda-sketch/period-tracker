// Encryption uses only the browser's built-in Web Crypto API.
// AES-GCM 256 with a key derived from the PIN via PBKDF2-SHA-256.

export const PBKDF2_ITERATIONS = 1_000_000;

export interface KdfParams {
  salt: string; // base64
  iterations: number;
}

export interface EncryptedBlob {
  iv: string; // base64
  ct: string; // base64
}

export function toB64(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}

export function fromB64(s: string): Uint8Array<ArrayBuffer> {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function isValidPin(pin: string): boolean {
  return /^\d{5}$/.test(pin);
}

export function newKdfParams(iterations = PBKDF2_ITERATIONS): KdfParams {
  return { salt: toB64(crypto.getRandomValues(new Uint8Array(16))), iterations };
}

export async function deriveKey(pin: string, params: KdfParams): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, [
    'deriveKey',
  ]);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt: fromB64(params.salt), iterations: params.iterations },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

export async function encryptJSON(key: CryptoKey, value: unknown): Promise<EncryptedBlob> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const pt = new TextEncoder().encode(JSON.stringify(value));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, pt));
  return { iv: toB64(iv), ct: toB64(ct) };
}

/** Throws if the key is wrong or the data was tampered with (GCM authentication). */
export async function decryptJSON<T>(key: CryptoKey, blob: EncryptedBlob): Promise<T> {
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromB64(blob.iv) }, key, fromB64(blob.ct));
  return JSON.parse(new TextDecoder().decode(pt)) as T;
}
