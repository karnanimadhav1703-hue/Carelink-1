import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createUserProfile, savePatientMode, saveUserLanguage, watchUserProfile, watchPatientRecords } from './database';
import { onSnapshot, runTransaction, updateDoc } from 'firebase/firestore';

vi.mock('./firebase', () => ({ db: {}, auth: { currentUser: { uid: 'meena' } } }));
vi.mock('firebase/firestore', () => ({
  doc: vi.fn((db, name, id) => `${name}/${id}`), collection: vi.fn(), query: vi.fn(), where: vi.fn(),
  onSnapshot: vi.fn(), runTransaction: vi.fn(), updateDoc: vi.fn(),
}));
beforeEach(() => vi.clearAllMocks());

describe('profile data integrity', () => {
  it('saves only the owner’s supported language field', async () => {
    await saveUserLanguage('meena', 'hi');
    expect(updateDoc).toHaveBeenCalledWith('users/meena', { language: 'hi' });
    await expect(saveUserLanguage('son', 'en')).rejects.toThrow('own profile');
    await expect(saveUserLanguage('meena', 'fr')).rejects.toThrow('English or Hindi');
    expect(updateDoc).toHaveBeenCalledTimes(1);
  });
  it('updates only mode fields and rejects writes to someone else’s profile', async () => {
    await savePatientMode('meena', 'elderly');
    expect(updateDoc).toHaveBeenCalledWith('users/meena', { mode: 'elderly', modeSelected: true });
    await expect(savePatientMode('son', 'standard')).rejects.toThrow('own profile');
    await expect(savePatientMode('meena', 'unknown')).rejects.toThrow('Choose');
    expect(updateDoc).toHaveBeenCalledTimes(1);
  });
  it('does not replace an existing profile during registration recovery', async () => {
    const transaction = { get: vi.fn().mockResolvedValue({ exists: () => true }), set: vi.fn() };
    runTransaction.mockImplementation(async (_, callback) => callback(transaction));
    await createUserProfile('meena', { name: 'Replacement', role: 'family' });
    expect(transaction.set).not.toHaveBeenCalled();
  });
  it('creates new patients with mode selection outstanding', async () => {
    const transaction = { get: vi.fn().mockResolvedValue({ exists: () => false }), set: vi.fn() };
    runTransaction.mockImplementation(async (_, callback) => callback(transaction));
    await createUserProfile('meena', { name: ' Meena ', role: 'patient' });
    expect(transaction.set).toHaveBeenCalledWith('users/meena', { name: 'Meena', role: 'patient', mode: 'standard', modeSelected: false, language: 'en' });
  });
  it('waits for acknowledged snapshots and returns listener cleanup', () => {
    const unsubscribe = vi.fn();
    onSnapshot.mockReturnValue(unsubscribe);
    const changed = vi.fn();
    const failed = vi.fn();
    expect(watchUserProfile('meena', changed, failed)).toBe(unsubscribe);
    const [, options, receive, onError] = onSnapshot.mock.calls[0];
    expect(options.includeMetadataChanges).toBe(true);
    const snapshot = { metadata: { hasPendingWrites: true }, exists: () => true, data: () => ({ mode: 'elderly' }) };
    receive(snapshot);
    expect(changed).not.toHaveBeenCalled();
    receive({ ...snapshot, metadata: { hasPendingWrites: false } });
    expect(changed).toHaveBeenCalledWith({ mode: 'elderly' });
    onError({ code: 'permission-denied' });
    expect(failed).toHaveBeenCalledWith({ code: 'permission-denied' });
  });
  it('rejects collection names and IDs that would query unintended data', () => {
    expect(() => watchPatientRecords('users', 'meena', vi.fn(), vi.fn())).toThrow('collection');
    expect(() => watchUserProfile('users/another', vi.fn(), vi.fn())).toThrow('document ID');
    expect(onSnapshot).not.toHaveBeenCalled();
  });
});
