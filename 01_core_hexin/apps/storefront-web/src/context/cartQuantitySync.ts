export interface CartQuantityUpdate {
  cartItemId: string;
  listingId: string;
  quantity: number;
}

export interface CartQuantitySync {
  schedule: (update: CartQuantityUpdate) => void;
  flush: () => Promise<void>;
  cancel: () => void;
}

export function createCartQuantitySync(
  write: (update: CartQuantityUpdate) => Promise<void>,
  onError: (cause: unknown) => void,
  delayMs = 350,
  retryBaseDelayMs = 1_000
): CartQuantitySync {
  const pending = new Map<string, CartQuantityUpdate>();
  const timers = new Map<string, ReturnType<typeof setTimeout>>();
  const active = new Map<string, Promise<void>>();
  const retryAttempts = new Map<string, number>();

  const scheduleCommit = (cartItemId: string, waitMs: number) => {
    const timer = timers.get(cartItemId);
    if (timer) clearTimeout(timer);
    timers.set(cartItemId, setTimeout(() => {
      timers.delete(cartItemId);
      void commit(cartItemId);
    }, waitMs));
  };

  function commit(cartItemId: string): Promise<void> {
    const update = pending.get(cartItemId);
    if (!update) return active.get(cartItemId) ?? Promise.resolve();
    pending.delete(cartItemId);

    const previous = active.get(cartItemId) ?? Promise.resolve();
    const current = previous.catch(() => undefined).then(() => write(update));
    active.set(cartItemId, current);
    current.then(
      () => {
        if (active.get(cartItemId) === current) {
          active.delete(cartItemId);
          retryAttempts.delete(cartItemId);
        }
      },
      (cause) => {
        if (active.get(cartItemId) === current) {
          active.delete(cartItemId);
          if (!pending.has(cartItemId)) pending.set(cartItemId, update);
          const attempt = (retryAttempts.get(cartItemId) ?? 0) + 1;
          retryAttempts.set(cartItemId, attempt);
          if (!timers.has(cartItemId)) scheduleCommit(cartItemId, Math.min(retryBaseDelayMs * 2 ** (attempt - 1), 8_000));
        }
        onError(cause);
      }
    );
    return current;
  }

  return {
    schedule(update) {
      pending.set(update.cartItemId, update);
      retryAttempts.delete(update.cartItemId);
      scheduleCommit(update.cartItemId, delayMs);
    },
    async flush() {
      for (const timer of timers.values()) clearTimeout(timer);
      timers.clear();
      const ids = new Set([...pending.keys(), ...active.keys()]);
      await Promise.all([...ids].map(commit));
    },
    cancel() {
      for (const timer of timers.values()) clearTimeout(timer);
      timers.clear();
      pending.clear();
      retryAttempts.clear();
    },
  };
}
