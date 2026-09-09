export interface ResourceReadStorage {
  readonly getItem: (key: string) => string | null;
}

export interface ResourceWriteStorage {
  readonly setItem: (key: string, value: string) => void;
  readonly removeItem?: (key: string) => void;
}

export interface ResourceCacheOptions<Value> {
  readonly namespace: string;
  readonly schema: string;
  readonly validate: (value: unknown) => value is Value;
  readonly encode?: (value: Value) => unknown;
  readonly decode?: (record: unknown) => Value | undefined;
}

export interface ResourceCache<Value> {
  readonly read: (key: string, storage?: ResourceReadStorage) => Value | undefined;
  readonly write: (key: string, value: Value, storage?: ResourceWriteStorage) => void;
  readonly remove: (key: string, storage?: ResourceWriteStorage) => void;
  readonly revalidate: (key: string, loader: (signal: AbortSignal) => Promise<Value>, storage?: ResourceWriteStorage) => Promise<Value>;
  readonly dispose: () => void;
}

interface PersistedResource {
  readonly schema: string;
  readonly value: unknown;
}

interface ActiveLoad<Value> {
  readonly controller: AbortController;
  readonly promise: Promise<Value>;
}

export function readStoredResource<Value>(storage: ResourceReadStorage | undefined, key: string, decode: (record: unknown) => Value | undefined): Value | undefined {
  if (!storage) return undefined;
  try {
    const raw = storage.getItem(key);
    return raw ? decode(JSON.parse(raw) as unknown) : undefined;
  } catch {
    return undefined;
  }
}

export function writeStoredResource<Value>(storage: ResourceWriteStorage | undefined, key: string, value: Value, encode: (value: Value) => unknown): void {
  if (!storage) return;
  try {
    storage.setItem(key, JSON.stringify(encode(value)));
  } catch {
    // Persistence is optional; callers keep their in-memory state.
  }
}

export function createResourceCache<Value>(options: ResourceCacheOptions<Value>): ResourceCache<Value> {
  const memory = new Map<string, Value>();
  const activeLoads = new Map<string, ActiveLoad<Value>>();
  let disposed = false;
  const storageKey = (key: string) => `${options.namespace}:${key}`;

  function read(key: string, storage?: ResourceReadStorage): Value | undefined {
    const memoryValue = memory.get(key);
    if (memoryValue !== undefined) return memoryValue;
    if (!storage) return undefined;
    try {
      const raw = storage.getItem(storageKey(key));
      if (!raw) return undefined;
      const parsed: unknown = JSON.parse(raw);
      const value = options.decode ? options.decode(parsed) : decodeDefaultRecord(parsed, options);
      if (value === undefined) return undefined;
      memory.set(key, value);
      return value;
    } catch {
      return undefined;
    }
  }

  function write(key: string, value: Value, storage?: ResourceWriteStorage): void {
    if (disposed) return;
    memory.set(key, value);
    if (!storage) return;
    try {
      const record = options.encode?.(value) ?? { schema: options.schema, value };
      storage.setItem(storageKey(key), JSON.stringify(record));
    } catch {
      // Persistence is optional; the in-memory value remains available.
    }
  }

  return {
    read,
    write,
    remove(key, storage) {
      memory.delete(key);
      try {
        storage?.removeItem?.(storageKey(key));
      } catch {
        // An unavailable persistence adapter must not block the application.
      }
    },
    revalidate(key, loader, storage) {
      const current = activeLoads.get(key);
      if (current) return current.promise;
      if (disposed) return Promise.reject(new Error('RESOURCE_CACHE_DISPOSED'));
      const controller = new AbortController();
      const promise = loader(controller.signal)
        .then((value) => {
          if (!controller.signal.aborted && !disposed) write(key, value, storage);
          return value;
        })
        .finally(() => {
          if (activeLoads.get(key)?.promise === promise) activeLoads.delete(key);
        });
      activeLoads.set(key, { controller, promise });
      return promise;
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      for (const load of activeLoads.values()) load.controller.abort();
      activeLoads.clear();
      memory.clear();
    },
  };
}

function decodeDefaultRecord<Value>(record: unknown, options: ResourceCacheOptions<Value>): Value | undefined {
  if (!record || typeof record !== 'object') return undefined;
  const candidate = record as Partial<PersistedResource>;
  if (candidate.schema !== options.schema || !options.validate(candidate.value)) return undefined;
  return candidate.value;
}
