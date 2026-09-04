import type { PreferenceAddress, PreferenceCodec } from './Preference';
import { preferenceKey } from './Preference';
import type { PreferencePort } from './PreferencePort';

interface StoredPreference {
  readonly version: number;
  readonly value: unknown;
}

const STORAGE_KEY = 'zhudatuan.console.preferences';

export class BrowserPreference implements PreferencePort {
  private readonly listeners = new Map<string, Set<() => void>>();
  private readonly cache = new Map<string, unknown>();

  constructor(private readonly storage: Pick<Storage, 'getItem' | 'setItem'> | undefined = browserStorage()) {
    if (typeof window !== 'undefined') window.addEventListener('storage', this.onStorage);
  }

  read<Value>(address: PreferenceAddress, codec: PreferenceCodec<Value>): Value {
    const key = preferenceKey(address);
    if (this.cache.has(key)) return this.cache.get(key) as Value;
    const record = this.records()[key];
    const value = record?.version === codec.version ? codec.parse(record.value) : codec.fallback;
    this.cache.set(key, value);
    return value;
  }

  write<Value>(address: PreferenceAddress, codec: PreferenceCodec<Value>, value: Value): void {
    const key = preferenceKey(address);
    const parsed = codec.parse(codec.serialize(value));
    const records = this.records();
    try {
      this.storage?.setItem(STORAGE_KEY, JSON.stringify({ ...records, [key]: { version: codec.version, value: codec.serialize(parsed) } }));
    } catch {
      // Preference persistence must never block the business workflow.
    }
    this.cache.set(key, parsed);
    this.notify(key);
  }

  subscribe(address: PreferenceAddress, listener: () => void): () => void {
    const key = preferenceKey(address);
    const listeners = this.listeners.get(key) ?? new Set();
    listeners.add(listener);
    this.listeners.set(key, listeners);
    return () => {
      listeners.delete(listener);
      if (listeners.size === 0) this.listeners.delete(key);
    };
  }

  private records(): Readonly<Record<string, StoredPreference>> {
    try {
      const value: unknown = JSON.parse(this.storage?.getItem(STORAGE_KEY) ?? '{}');
      return typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as Readonly<Record<string, StoredPreference>>) : {};
    } catch {
      return {};
    }
  }

  private readonly onStorage = (event: StorageEvent) => {
    if (event.key !== STORAGE_KEY) return;
    this.cache.clear();
    for (const key of this.listeners.keys()) this.notify(key);
  };

  private notify(key: string) {
    for (const listener of this.listeners.get(key) ?? []) listener();
  }
}

function browserStorage(): Storage | undefined {
  try {
    return typeof window === 'undefined' ? undefined : window.localStorage;
  } catch {
    return undefined;
  }
}
