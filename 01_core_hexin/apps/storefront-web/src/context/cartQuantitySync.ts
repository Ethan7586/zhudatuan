import { createKeyedMutationQueue } from '@shop/interaction';

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

/** Cart-specific adapter around the shared per-resource mutation queue. */
export function createCartQuantitySync(write: (update: CartQuantityUpdate) => Promise<void>, handlers: CartQuantitySyncHandlers, delayMs = 180): CartQuantitySync {
  const queue = createKeyedMutationQueue((update: CartQuantityUpdate) => write(update), {
    keyOf: (update) => update.cartItemId,
    initialConfirmedValue: (update) => update.previousQuantity,
    confirmedValue: (update) => update.quantity,
    onCommitted: (update) => handlers.onCommitted?.(update),
    onError: (cause, failure) =>
      handlers.onError(cause, {
        update: failure.update,
        rollbackQuantity: failure.rollbackValue,
      }),
    delayMs,
  });

  return {
    schedule(update) {
      queue.schedule(update);
    },
    flush: queue.flush,
    cancel: queue.cancel,
    hasPending: queue.hasPending,
  };
}
