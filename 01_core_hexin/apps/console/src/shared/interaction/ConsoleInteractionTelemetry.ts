import { createInteractionTimeline, type InteractionTimingEvent } from '@shop/telemetry';

export type ConsoleInteractionStage =
  | 'module-load-start'
  | 'module-load-complete'
  | 'module-load-error';

export interface ConsoleInteractionTiming {
  readonly moduleId: string;
  readonly actionId: string;
  readonly stage: ConsoleInteractionStage;
  readonly elapsedMs: number;
  readonly time: number;
}

export interface ConsoleInteractionTelemetry {
  readonly begin: (moduleId: string, actionId: string, stage: ConsoleInteractionStage) => string;
  readonly finish: (moduleId: string, actionId: string, stage: ConsoleInteractionStage, interactionId: string) => void;
  readonly cancel: (moduleId: string, actionId: string) => void;
}

export function createConsoleInteractionTelemetry(options: Readonly<{
  now?: () => number;
  onRecord?: (event: ConsoleInteractionTiming) => void;
}> = {}): ConsoleInteractionTelemetry {
  const descriptors = new Map<string, Readonly<{ moduleId: string; actionId: string }>>();
  const activeIds = new Map<string, string>();
  const timeline = createInteractionTimeline<ConsoleInteractionStage>({
    name: 'console.module-navigation',
    ...(options.now === undefined ? {} : { now: options.now }),
    onRecord(event) {
      const descriptor = descriptors.get(event.interactionId);
      if (descriptor === undefined) return;
      options.onRecord?.(toTiming(event, descriptor));
    },
  });

  return {
    begin(moduleId, actionId, stage) {
      const key = interactionKey(moduleId, actionId);
      const previousId = activeIds.get(key);
      if (previousId !== undefined) descriptors.delete(previousId);
      const interactionId = timeline.begin(key, stage);
      descriptors.set(interactionId, { moduleId, actionId });
      activeIds.set(key, interactionId);
      timeline.record(stage, key, interactionId);
      return interactionId;
    },
    finish(moduleId, actionId, stage, interactionId) {
      const key = interactionKey(moduleId, actionId);
      const event = timeline.finish(stage, key, interactionId);
      if (event !== undefined) {
        descriptors.delete(interactionId);
        activeIds.delete(key);
      }
    },
    cancel(moduleId, actionId) {
      const key = interactionKey(moduleId, actionId);
      const interactionId = activeIds.get(key);
      timeline.cancel(key);
      activeIds.delete(key);
      if (interactionId !== undefined) descriptors.delete(interactionId);
    },
  };
}

function interactionKey(moduleId: string, actionId: string): string {
  return `${moduleId}\u001f${actionId}`;
}

function toTiming(
  event: InteractionTimingEvent<ConsoleInteractionStage>,
  descriptor: Readonly<{ moduleId: string; actionId: string }>,
): ConsoleInteractionTiming {
  return {
    ...descriptor,
    stage: event.stage,
    elapsedMs: event.elapsedMs,
    time: event.time,
  };
}

export const consoleInteractionTelemetry = createConsoleInteractionTelemetry({
  onRecord(event) {
    if (typeof window === 'undefined' || typeof CustomEvent === 'undefined') return;
    window.dispatchEvent(new CustomEvent('console:interaction-timing', { detail: event }));
  },
});
