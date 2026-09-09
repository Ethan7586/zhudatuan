export interface KeyedActionContext<Key> {
  readonly key: Key;
  readonly revision: number;
  readonly signal: AbortSignal;
}

export interface KeyedActionAttempt<Result> {
  readonly started: boolean;
  readonly revision: number;
  readonly promise: Promise<Result>;
}

export interface KeyedActionCoordinator<Key> {
  readonly start: <Result>(
    key: Key,
    action: (context: KeyedActionContext<Key>) => Promise<Result>,
  ) => KeyedActionAttempt<Result>;
  readonly isRunning: (key: Key) => boolean;
  readonly isLatest: (key: Key, revision: number) => boolean;
  readonly cancel: (key?: Key) => void;
  readonly dispose: () => void;
}

interface ActiveAction {
  readonly revision: number;
  readonly controller: AbortController;
  readonly promise: Promise<unknown>;
}

/**
 * Coordinates authoritative async actions without inventing optimistic success.
 * Repeated starts for one key share the active request while unrelated keys run
 * independently. Revisions let consumers ignore responses after cancel/restart.
 */
export function createKeyedActionCoordinator<Key>(): KeyedActionCoordinator<Key> {
  const active = new Map<Key, ActiveAction>();
  const revisions = new Map<Key, number>();
  let disposed = false;

  const nextRevision = (key: Key) => {
    const revision = (revisions.get(key) ?? 0) + 1;
    revisions.set(key, revision);
    return revision;
  };

  const cancelKey = (key: Key) => {
    nextRevision(key);
    active.get(key)?.controller.abort();
    active.delete(key);
  };

  return {
    start<Result>(key: Key, action: (context: KeyedActionContext<Key>) => Promise<Result>) {
      if (disposed) throw new Error('KEYED_ACTION_COORDINATOR_DISPOSED');
      const current = active.get(key);
      if (current) {
        return {
          started: false,
          revision: current.revision,
          promise: current.promise as Promise<Result>,
        };
      }

      const revision = nextRevision(key);
      const controller = new AbortController();
      const promise = Promise.resolve()
        .then(() => action({ key, revision, signal: controller.signal }))
        .finally(() => {
          if (active.get(key)?.revision === revision) active.delete(key);
        });
      active.set(key, { revision, controller, promise });
      return { started: true, revision, promise };
    },
    isRunning: (key) => active.has(key),
    isLatest: (key, revision) => !disposed && revisions.get(key) === revision,
    cancel(key) {
      if (disposed) return;
      if (key !== undefined) {
        cancelKey(key);
        return;
      }
      for (const activeKey of [...active.keys()]) cancelKey(activeKey);
    },
    dispose() {
      if (disposed) return;
      for (const current of active.values()) current.controller.abort();
      active.clear();
      revisions.clear();
      disposed = true;
    },
  };
}
