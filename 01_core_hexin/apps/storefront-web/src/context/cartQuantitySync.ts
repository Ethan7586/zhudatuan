export interface CartQuantityUpdate {
  cartItemId: string;
  listingId: string;
  quantity: number;
  previousQuantity: number;
}

export interface CartQuantityFailure {
  update: CartQuantityUpdate;
  rollbackQuantity: number;
}

export interface CartQuantitySyncHandlers {
  onCommitted?: (update: CartQuantityUpdate) => void;
  onError: (cause: unknown, failure: CartQuantityFailure) => void;
}

export interface CartQuantitySync {
  schedule: (update: CartQuantityUpdate) => void;
  flush: () => Promise<void>;
  cancel: () => void;
  hasPending: () => boolean;
}

interface ItemQueue {
  confirmedQuantity: number;
  pending: CartQuantityUpdate | null;
  active: Promise<void> | null;
  timer: ReturnType<typeof setTimeout> | null;
}

/**
 * Coalesces rapid absolute-quantity writes per listing while allowing unrelated
 * products to sync concurrently. Failed writes report the last confirmed value.
 */
export function createCartQuantitySync(
  write: (update: CartQuantityUpdate) => Promise<void>,
  handlers: CartQuantitySyncHandlers,
  delayMs = 180,
): CartQuantitySync {
  const queues = new Map<string, ItemQueue>();
  let generation = 0;

  const queueFor = (update: CartQuantityUpdate): ItemQueue => {
    const current = queues.get(update.cartItemId);
    if (current) return current;
    const created: ItemQueue = {
      confirmedQuantity: update.previousQuantity,
      pending: null,
      active: null,
      timer: null,
    };
    queues.set(update.cartItemId, created);
    return created;
  };

  const scheduleCommit = (cartItemId: string, waitMs: number) => {
    const queue = queues.get(cartItemId);
    if (!queue || queue.active) return;
    if (queue.timer) clearTimeout(queue.timer);
    queue.timer = setTimeout(() => {
      queue.timer = null;
      void commit(cartItemId).catch(() => undefined);
    }, waitMs);
  };

  const commit = (cartItemId: string): Promise<void> => {
    const queue = queues.get(cartItemId);
    if (!queue) return Promise.resolve();
    if (queue.active) return queue.active;
    if (queue.timer) {
      clearTimeout(queue.timer);
      queue.timer = null;
    }
    const update = queue.pending;
    if (!update) return Promise.resolve();
    queue.pending = null;
    const requestGeneration = generation;
    let succeeded = false;
    const request = write(update)
      .then(() => {
        if (requestGeneration !== generation) return;
        succeeded = true;
        queue.confirmedQuantity = update.quantity;
        handlers.onCommitted?.(update);
      })
      .catch((cause) => {
        if (requestGeneration === generation) {
          if (queue.timer) clearTimeout(queue.timer);
          queue.timer = null;
          queue.pending = null;
          handlers.onError(cause, { update, rollbackQuantity: queue.confirmedQuantity });
        }
        throw cause;
      })
      .finally(() => {
        if (queue.active === request) queue.active = null;
        if (requestGeneration !== generation) return;
        if (succeeded && queue.pending) scheduleCommit(cartItemId, 0);
        else if (!queue.pending && !queue.active) queues.delete(cartItemId);
      });
    queue.active = request;
    return request;
  };

  const flushItem = async (cartItemId: string): Promise<void> => {
    while (true) {
      const queue = queues.get(cartItemId);
      if (!queue) return;
      if (queue.timer) {
        clearTimeout(queue.timer);
        queue.timer = null;
      }
      if (queue.active) {
        await queue.active;
        continue;
      }
      if (!queue.pending) return;
      await commit(cartItemId);
    }
  };

  return {
    schedule(update) {
      const queue = queueFor(update);
      queue.pending = update;
      if (!queue.active) scheduleCommit(update.cartItemId, delayMs);
    },
    async flush() {
      await Promise.all([...queues.keys()].map(flushItem));
    },
    cancel() {
      generation += 1;
      for (const queue of queues.values()) {
        if (queue.timer) clearTimeout(queue.timer);
      }
      queues.clear();
    },
    hasPending() {
      return [...queues.values()].some((queue) => Boolean(queue.pending || queue.active));
    },
  };
}
