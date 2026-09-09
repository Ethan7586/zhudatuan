import { createInteractionTimeline } from '@shop/telemetry';

export type CartInteractionStage = 'pointerdown' | 'button-feedback-frame' | 'local-cart-updated' | 'request-start' | 'server-response' | 'rollback';

const timeline = createInteractionTimeline<CartInteractionStage>({
  name: 'storefront.cart',
  onRecord: (event) => {
    if (typeof window === 'undefined') return;
    window.dispatchEvent(
      new CustomEvent('storefront:cart-timing', {
        detail: {
          interactionId: event.interactionId,
          listingId: event.resourceKey,
          stage: event.stage,
          time: event.time,
        },
      })
    );
  },
});

export function beginCartInteraction(listingId: string): string {
  return timeline.begin(listingId, 'pointerdown');
}

export function recordCartInteraction(stage: CartInteractionStage, listingId: string, interactionId?: string): void {
  timeline.record(stage, listingId, interactionId);
}
