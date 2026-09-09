export type PreloadLoader = () => Promise<unknown>;
export type PreloadScheduler = (work: () => void) => () => void;

export interface PreloadRegistry<Key extends string> {
  readonly preload: (key: Key) => Promise<unknown> | undefined;
  readonly schedule: (keys: readonly Key[], scheduler: PreloadScheduler) => () => void;
  readonly has: (key: Key) => boolean;
  readonly clear: (key?: Key) => void;
}

export function preloadOnce<Key extends string>(loaders: Readonly<Partial<Record<Key, PreloadLoader>>>, tasks: Map<Key, Promise<unknown>>, key: Key): Promise<unknown> | undefined {
  const current = tasks.get(key);
  if (current) return current;
  const loader = loaders[key];
  if (!loader) return undefined;
  const task = Promise.resolve()
    .then(loader)
    .catch((cause: unknown) => {
      if (tasks.get(key) === task) tasks.delete(key);
      throw cause;
    });
  tasks.set(key, task);
  return task;
}

export function createPreloadRegistry<Key extends string>(loaders: Readonly<Partial<Record<Key, PreloadLoader>>>): PreloadRegistry<Key> {
  const tasks = new Map<Key, Promise<unknown>>();

  const preload = (key: Key) => preloadOnce(loaders, tasks, key);

  return {
    preload,
    schedule(keys, scheduler) {
      return scheduler(() => {
        for (const key of keys) void preload(key)?.catch(() => undefined);
      });
    },
    has: (key) => tasks.has(key),
    clear(key) {
      if (key === undefined) tasks.clear();
      else tasks.delete(key);
    },
  };
}
