import { createInteractionTimeline } from '@shop/telemetry';

export type AuthInteractionStage =
  | 'pointerdown'
  | 'button-feedback'
  | 'request-start'
  | 'server-response'
  | 'session-exchange'
  | 'redirect'
  | 'rollback'
  | 'error';

const timeline = createInteractionTimeline<AuthInteractionStage>({
  name: 'auth.identity',
  onRecord: (event) => {
    if (typeof window === 'undefined') return;
    window.dispatchEvent(new CustomEvent('auth:interaction-timing', {
      detail: {
        interactionId: event.interactionId,
        resourceKey: event.resourceKey,
        stage: event.stage,
        time: event.time,
      },
    }));
  },
});

export function beginAuthInteraction(resourceKey: string): string {
  return timeline.begin(resourceKey, 'pointerdown');
}

export function recordAuthInteraction(stage: AuthInteractionStage, resourceKey: string, interactionId: string): void {
  timeline.record(stage, resourceKey, interactionId);
}

export function finishAuthInteraction(stage: AuthInteractionStage, resourceKey: string, interactionId: string): void {
  timeline.finish(stage, resourceKey, interactionId);
}

export function cancelAuthInteraction(resourceKey: string): void {
  timeline.cancel(resourceKey);
}
