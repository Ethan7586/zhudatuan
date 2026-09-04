import { describe, expect, it, vi } from 'vitest';
import { BrowserPreference } from './BrowserPreference';
import { stringListPreference, type PreferenceAddress } from './Preference';

const address: PreferenceAddress = Object.freeze({
  actor: 'actor:one',
  membership: 'membership:one',
  scope: Object.freeze({ kind: 'mall', id: 'mall:one' }),
  view: 'products',
  name: 'columns',
});
const codec = stringListPreference(['category', 'status'], ['category', 'status']);

describe('BrowserPreference', () => {
  it('persists one validated and scoped preference record', () => {
    const values = new Map<string, string>();
    const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value) };
    const first = new BrowserPreference(storage);
    first.write(address, codec, ['status', 'unknown' as 'status']);
    const restored = new BrowserPreference(storage).read(address, codec);
    expect(restored).toEqual(['status']);
    expect([...values.keys()]).toEqual(['zhudatuan.console.preferences']);
  });

  it('uses the schema fallback for damaged records and notifies subscribers', () => {
    const listener = vi.fn();
    const storage = { getItem: () => '{damaged', setItem: vi.fn() };
    const preference = new BrowserPreference(storage);
    const unsubscribe = preference.subscribe(address, listener);
    expect(preference.read(address, codec)).toEqual(['category', 'status']);
    preference.write(address, codec, ['category']);
    expect(listener).toHaveBeenCalledOnce();
    unsubscribe();
  });

  it('allows every optional column to be hidden without restoring defaults', () => {
    const values = new Map<string, string>();
    const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value) };
    const preference = new BrowserPreference(storage);
    preference.write(address, codec, []);
    expect(preference.read(address, codec)).toEqual([]);
  });
});
