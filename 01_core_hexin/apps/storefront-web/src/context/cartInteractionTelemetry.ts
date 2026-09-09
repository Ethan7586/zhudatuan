export type CartInteractionStage =
  | 'pointerdown'
  | 'button-feedback-frame'
  | 'local-cart-updated'
  | 'request-start'
  | 'server-response'
  | 'rollback';

const activeInteractions = new Map<string, string>();
let interactionSequence = 0;

export function beginCartInteraction(listingId: string): string {
  const interactionId = `${listingId}:${++interactionSequence}`;
  activeInteractions.set(listingId, interactionId);
  recordCartInteraction('pointerdown', listingId, interactionId);
  return interactionId;
}

export function recordCartInteraction(stage: CartInteractionStage, listingId: string, interactionId = activeInteractions.get(listingId)): void {
  if (typeof window === 'undefined' || typeof performance === 'undefined') return;
  window.dispatchEvent(new CustomEvent('storefront:cart-timing', {
    detail: { interactionId: interactionId ?? null, listingId, stage, time: performance.now() },
  }));
}
