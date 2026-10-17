// The vault is the only place data is stored: one IndexedDB database on this
// device. With a PIN set, the stored data is ciphertext only.

import { emptyData, type TrackerData } from '../domain/types';
import {
  decryptJSON,
  deriveKey,
  encryptJSON,
  isValidPin,
  newKdfParams,
  PBKDF2_ITERATIONS,
  type EncryptedBlob,
  type KdfParams,
} from './crypto';
import { validateData } from './validate';

const DB_NAME = 'period-tracker';
const STORE = 'kv';

export const FREE_ATTEMPTS = 5;
const BASE_LOCKOUT_MS = 30_000;
const MAX_LOCKOUT_MS = 60 * 60_000;

interface Meta {
  kdf?: KdfParams;
  failedAttempts: number;
  lockedUntil: number;
}

type Stored = { encrypted: false; data: TrackerData } | { encrypted: true; blob: EncryptedBlob };

function req<T>(r: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

function openDB(idb: IDBFactory): Promise<IDBDatabase> {
  const r = idb.open(DB_NAME, 1);
  r.onupgradeneeded = () => r.result.createObjectStore(STORE);
  return req(r);
}

export class WrongPinError extends Error {
  constructor(public lockedUntil: number) {
    super('Wrong PIN');
  }
}

export class LockedOutError extends Error {
  constructor(public lockedUntil: number) {
    super('Too many attempts');
  }
}

export class Vault {
  private key: CryptoKey | null = null;
  private meta: Meta = { failedAttempts: 0, lockedUntil: 0 };

  private constructor(
    private db: IDBDatabase,
    private iterations: number,
  ) {}

  static async open(idb: IDBFactory = indexedDB, iterations = PBKDF2_ITERATIONS): Promise<Vault> {
    const v = new Vault(await openDB(idb), iterations);
    v.meta = (await v.get<Meta>('meta')) ?? v.meta;
    return v;
  }

  private async get<T>(k: string): Promise<T | undefined> {
    return req(this.db.transaction(STORE).objectStore(STORE).get(k)) as Promise<T | undefined>;
  }

  private async put(entries: Record<string, unknown>): Promise<void> {
    const tx = this.db.transaction(STORE, 'readwrite');
    for (const [k, v] of Object.entries(entries)) tx.objectStore(STORE).put(v, k);
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  }

  get hasPin(): boolean {
    return !!this.meta.kdf;
  }

  get lockedUntil(): number {
    return this.meta.lockedUntil;
  }

  /** Loads data when no PIN is set. Returns null when a PIN is required. */
  async loadUnlocked(): Promise<TrackerData | null> {
    if (this.hasPin) return null;
    const s = await this.get<Stored>('data');
    return s && !s.encrypted ? validateData(s.data) : emptyData();
  }

  async unlock(pin: string, now = Date.now()): Promise<TrackerData> {
    if (!this.meta.kdf) throw new Error('No PIN set');
    if (now < this.meta.lockedUntil) throw new LockedOutError(this.meta.lockedUntil);
    const s = await this.get<Stored>('data');
    const key = await deriveKey(pin, this.meta.kdf);
    try {
      const data = s?.encrypted ? validateData(await decryptJSON(key, s.blob)) : emptyData();
      this.key = key;
      this.meta.failedAttempts = 0;
      this.meta.lockedUntil = 0;
      await this.put({ meta: this.meta });
      return data;
    } catch {
      const n = ++this.meta.failedAttempts;
      if (n >= FREE_ATTEMPTS) {
        this.meta.lockedUntil = now + Math.min(BASE_LOCKOUT_MS * 2 ** (n - FREE_ATTEMPTS), MAX_LOCKOUT_MS);
      }
      await this.put({ meta: this.meta });
      throw new WrongPinError(this.meta.lockedUntil);
    }
  }

  lock(): void {
    this.key = null;
  }

  async save(data: TrackerData): Promise<void> {
    if (this.hasPin && !this.key) throw new Error('Vault is locked');
    const stored: Stored = this.key
      ? { encrypted: true, blob: await encryptJSON(this.key, data) }
      : { encrypted: false, data };
    await this.put({ data: stored });
  }

  /** Sets or changes the PIN and re-encrypts the data with it. */
  async setPin(pin: string, data: TrackerData): Promise<void> {
    if (!isValidPin(pin)) throw new Error('PIN must be 5 digits');
    if (this.hasPin && !this.key) throw new Error('Vault is locked');
    const kdf = newKdfParams(this.iterations);
    const key = await deriveKey(pin, kdf);
    const blob = await encryptJSON(key, data);
    const meta: Meta = { kdf, failedAttempts: 0, lockedUntil: 0 };
    await this.put({ meta, data: { encrypted: true, blob } satisfies Stored });
    this.meta = meta;
    this.key = key;
  }

  async removePin(data: TrackerData): Promise<void> {
    if (this.hasPin && !this.key) throw new Error('Vault is locked');
    const meta: Meta = { failedAttempts: 0, lockedUntil: 0 };
    await this.put({ meta, data: { encrypted: false, data } satisfies Stored });
    this.meta = meta;
    this.key = null;
  }

  /** Erases everything, including the PIN. */
  async wipe(): Promise<void> {
    const tx = this.db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).clear();
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    this.meta = { failedAttempts: 0, lockedUntil: 0 };
    this.key = null;
  }

  /** Raw stored record, for tests that check nothing readable is at rest. */
  async rawData(): Promise<unknown> {
    return this.get('data');
  }
}
