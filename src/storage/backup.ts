// Backup files are plain JSON, encrypted with the PIN when one is set.
// They are saved to and read from files the owner chooses; nothing is uploaded.

import type { TrackerData } from '../domain/types';
import { decryptJSON, deriveKey, encryptJSON, newKdfParams, type EncryptedBlob, type KdfParams } from './crypto';
import { validateData } from './validate';

const APP = 'period-tracker-backup';

type BackupFile =
  | { app: typeof APP; format: 1; encrypted: false; data: TrackerData }
  | { app: typeof APP; format: 1; encrypted: true; kdf: KdfParams; blob: EncryptedBlob };

export async function makeBackup(data: TrackerData, pin?: string, iterations?: number): Promise<string> {
  let file: BackupFile;
  if (pin) {
    const kdf = newKdfParams(iterations);
    const blob = await encryptJSON(await deriveKey(pin, kdf), data);
    file = { app: APP, format: 1, encrypted: true, kdf, blob };
  } else {
    file = { app: APP, format: 1, encrypted: false, data };
  }
  return JSON.stringify(file);
}

export class BackupNeedsPinError extends Error {
  constructor() {
    super('This backup is protected with a PIN');
  }
}

export async function readBackup(text: string, pin?: string): Promise<TrackerData> {
  let file: BackupFile;
  try {
    file = JSON.parse(text);
  } catch {
    throw new Error('This file is not a tracker backup');
  }
  if (!file || file.app !== APP || file.format !== 1) throw new Error('This file is not a tracker backup');
  if (!file.encrypted) return validateData(file.data);
  if (!pin) throw new BackupNeedsPinError();
  try {
    return validateData(await decryptJSON(await deriveKey(pin, file.kdf), file.blob));
  } catch {
    throw new Error('Wrong PIN for this backup');
  }
}

export function backupFilename(todayISO: string): string {
  return `period-tracker-backup-${todayISO}.json`;
}
