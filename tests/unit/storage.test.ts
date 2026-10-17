import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { beforeEach, describe, expect, it } from 'vitest';
import { emptyData, type TrackerData } from '../../src/domain/types';
import { FREE_ATTEMPTS, LockedOutError, Vault, WrongPinError } from '../../src/storage/vault';
import { BackupNeedsPinError, makeBackup, readBackup } from '../../src/storage/backup';
import { validateData } from '../../src/storage/validate';

const FAST = 1000; // PBKDF2 iterations for tests; the app uses 1,000,000

function sample(): TrackerData {
  const d = emptyData();
  d.days['2026-10-01'] = { date: '2026-10-01', flow: 'heavy', symptoms: ['cramps', 'my tag'], note: 'ouch' };
  d.customSymptoms = ['my tag'];
  return d;
}

let idb: IDBFactory;
beforeEach(() => {
  idb = new IDBFactory();
});

describe('vault without PIN', () => {
  it('starts empty and round-trips data', async () => {
    const v = await Vault.open(idb, FAST);
    expect(await v.loadUnlocked()).toEqual(emptyData());
    await v.save(sample());
    const v2 = await Vault.open(idb, FAST);
    expect(await v2.loadUnlocked()).toEqual(sample());
  });
});

describe('vault with PIN', () => {
  it('stores only ciphertext and unlocks with the right PIN', async () => {
    const v = await Vault.open(idb, FAST);
    await v.setPin('12345', sample());
    const raw = JSON.stringify(await v.rawData());
    expect(raw).not.toContain('ouch');
    expect(raw).not.toContain('cramps');
    expect(raw).not.toContain('2026-10-01');

    const v2 = await Vault.open(idb, FAST);
    expect(v2.hasPin).toBe(true);
    expect(await v2.loadUnlocked()).toBeNull();
    expect(await v2.unlock('12345')).toEqual(sample());
  });

  it('rejects a wrong PIN and locks out after repeated failures', async () => {
    const v = await Vault.open(idb, FAST);
    await v.setPin('12345', sample());
    const now = 1_000_000;
    for (let i = 1; i < FREE_ATTEMPTS; i++) {
      await expect(v.unlock('00000', now)).rejects.toBeInstanceOf(WrongPinError);
    }
    await expect(v.unlock('00000', now)).rejects.toMatchObject({ lockedUntil: now + 30_000 });
    await expect(v.unlock('12345', now + 1000)).rejects.toBeInstanceOf(LockedOutError);
    // Lockout survives reopening the app.
    const v2 = await Vault.open(idb, FAST);
    await expect(v2.unlock('12345', now + 1000)).rejects.toBeInstanceOf(LockedOutError);
    expect(await v2.unlock('12345', now + 31_000)).toEqual(sample());
  });

  it('refuses to save while locked', async () => {
    const v = await Vault.open(idb, FAST);
    await v.setPin('12345', sample());
    v.lock();
    await expect(v.save(emptyData())).rejects.toThrow('locked');
  });

  it('changes and removes the PIN', async () => {
    const v = await Vault.open(idb, FAST);
    await v.setPin('12345', sample());
    await v.setPin('54321', sample());
    const v2 = await Vault.open(idb, FAST);
    await expect(v2.unlock('12345')).rejects.toBeInstanceOf(WrongPinError);
    await v2.unlock('54321');
    await v2.removePin(sample());
    const v3 = await Vault.open(idb, FAST);
    expect(v3.hasPin).toBe(false);
    expect(await v3.loadUnlocked()).toEqual(sample());
  });

  it('only accepts 5-digit PINs', async () => {
    const v = await Vault.open(idb, FAST);
    await expect(v.setPin('1234', sample())).rejects.toThrow();
    await expect(v.setPin('12a45', sample())).rejects.toThrow();
  });

  it('wipes everything', async () => {
    const v = await Vault.open(idb, FAST);
    await v.setPin('12345', sample());
    await v.wipe();
    const v2 = await Vault.open(idb, FAST);
    expect(v2.hasPin).toBe(false);
    expect(await v2.loadUnlocked()).toEqual(emptyData());
  });
});

describe('backup', () => {
  it('round-trips a plain backup', async () => {
    expect(await readBackup(await makeBackup(sample()))).toEqual(sample());
  });
  it('round-trips an encrypted backup', async () => {
    const text = await makeBackup(sample(), '12345', FAST);
    expect(text).not.toContain('ouch');
    await expect(readBackup(text)).rejects.toBeInstanceOf(BackupNeedsPinError);
    await expect(readBackup(text, '11111')).rejects.toThrow('Wrong PIN');
    expect(await readBackup(text, '12345')).toEqual(sample());
  });
  it('rejects files that are not backups', async () => {
    await expect(readBackup('hello')).rejects.toThrow('not a tracker backup');
    await expect(readBackup('{"app":"other"}')).rejects.toThrow('not a tracker backup');
  });
  it('drops malformed entries', () => {
    const d = validateData({
      version: 1,
      days: { '2026-13-01': { symptoms: [] }, '2026-10-02': { flow: 'gushing', symptoms: ['x', 3], mood: 'happy' } },
    });
    expect(d.days).toEqual({ '2026-10-02': { date: '2026-10-02', symptoms: ['x'], mood: 'happy' } });
  });
});
