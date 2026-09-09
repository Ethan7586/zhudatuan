export interface MutationCommitContext<Key> {
  readonly key: Key;
  readonly revision: number;
  readonly signal: AbortSignal;
}

export interface KeyedMutationFailure<Update, Confirmed> {
  readonly update: Update;
  readonly rollbackValue: Confirmed;
  readonly revision: number;
}

export interface KeyedMutationQueueOptions<Update, Key, Confirmed> {
  readonly keyOf: (update: Update) => Key;
  readonly initialConfirmedValue: (update: Update) => Confirmed;
  readonly confirmedValue: (update: Update) => Confirmed;
  readonly onCommitted?: (update: Update, context: Readonly<{ revision: number; isLatest: boolean }>) => void;
  readonly onError: (cause: unknown, failure: KeyedMutationFailure<Update, Confirmed>) => void;
  readonly delayMs?: number;
}

export interface KeyedMutationQueue<Update> {
  readonly schedule: (update: Update) => number | null;
  readonly flush: () => Promise<void>;
  readonly cancel: () => void;
  readonly dispose: () => void;
  readonly hasPending: () => boolean;
}

interface QueuedUpdate<Update> {
  readonly update: Update;
  readonly revision: number;
}

interface ActiveMutation {
  promise: Promise<void>;
  readonly controller: AbortController;
}

interface ResourceQueue<Update, Confirmed> {
  confirmed: Confirmed;
  pending: QueuedUpdate<Update> | null;
  active: ActiveMutation | null;
  timer: ReturnType<typeof setTimeout> | null;
}

/**
 * Keeps writes serial for one resource key while unrelated resources run in
 * parallel. Rapid updates are collapsed to the latest absolute state.
 */
export function createKeyedMutationQueue<Update, Key, Confirmed>(write: (update: Update, context: MutationCommitContext<Key>) => Promise<void>, options: KeyedMutationQueueOptions<Update, Key, Confirmed>): KeyedMutationQueue<Update> {
  const queues = new Map<Key, ResourceQueue<Update, Confirmed>>();
  const delayMs = options.delayMs ?? 180;
  let generation = 0;
  let nextRevision = 0;
  let disposed = false;

  function queueFor(update: Update, key: Key): ResourceQueue<Update, Confirmed> {
    const current = queues.get(key);
    if (current) return current;
    const created: ResourceQueue<Update, Confirmed> = {
      confirmed: options.initialConfirmedValue(update),
      pending: null,
      active: null,
      timer: null,
    };
    queues.set(key, created);
    return created;
  }

  function scheduleCommit(key: Key, waitMs: number): void {
    const queue = queues.get(key);
    if (!queue || queue.active || disposed) return;
    if (queue.timer) clearTimeout(queue.timer);
    queue.timer = setTimeout(() => {
      queue.timer = null;
      void commit(key).catch(() => undefined);
    }, waitMs);
  }

  function commit(key: Key): Promise<void> {
    const queue = queues.get(key);
    if (!queue || disposed) return Promise.resolve();
    if (queue.active) return queue.active.promise;
    if (queue.timer) {
      clearTimeout(queue.timer);
      queue.timer = null;
    }
    const queued = queue.pending;
    if (!queued) return Promise.resolve();
    queue.pending = null;
    const requestGeneration = generation;
    const controller = new AbortController();
    const activeMutation: ActiveMutation = { promise: Promise.resolve(), controller };
    const request = (async () => {
      try {
        await write(queued.update, { key, revision: queued.revision, signal: controller.signal });
        if (requestGeneration !== generation || disposed) return;
        queue.confirmed = options.confirmedValue(queued.update);
        options.onCommitted?.(queued.update, {
          revision: queued.revision,
          isLatest: queue.pending === null,
        });
      } catch (cause) {
        if (requestGeneration === generation && !disposed) {
          if (queue.timer) clearTimeout(queue.timer);
          queue.timer = null;
          queue.pending = null;
          options.onError(cause, {
            update: queued.update,
            rollbackValue: queue.confirmed,
            revision: queued.revision,
          });
        }
        throw cause;
      } finally {
        if (queue.active === activeMutation) queue.active = null;
        if (requestGeneration !== generation || disposed) return;
        if (queue.pending) scheduleCommit(key, 0);
        else if (!queue.pending && !queue.active) queues.delete(key);
      }
    })();
    activeMutation.promise = request;
    queue.active = activeMutation;
    return request;
  }

  async function flushKey(key: Key): Promise<void> {
    while (true) {
      const queue = queues.get(key);
      if (!queue) return;
      if (queue.timer) {
        clearTimeout(queue.timer);
        queue.timer = null;
      }
      if (queue.active) {
        await queue.active.promise;
        continue;
      }
      if (!queue.pending) return;
      await commit(key);
    }
  }

  function cancel(): void {
    generation += 1;
    for (const queue of queues.values()) {
      if (queue.timer) clearTimeout(queue.timer);
      queue.active?.controller.abort();
    }
    queues.clear();
  }

  return {
    schedule(update) {
      if (disposed) return null;
      const key = options.keyOf(update);
      const queue = queueFor(update, key);
      const revision = ++nextRevision;
      queue.pending = { update, revision };
      if (!queue.active) scheduleCommit(key, delayMs);
      return revision;
    },
    async flush() {
      if (disposed) return;
      await Promise.all([...queues.keys()].map(flushKey));
    },
    cancel,
    dispose() {
      if (disposed) return;
      cancel();
      disposed = true;
    },
    hasPending() {
      return [...queues.values()].some((queue) => Boolean(queue.pending || queue.active));
    },
  };
}
