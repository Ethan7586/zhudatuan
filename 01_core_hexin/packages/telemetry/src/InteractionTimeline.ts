import type { Metrics } from './Metrics';
import type { TelemetryContext } from './Context';

export interface InteractionTimingEvent<Stage extends string> {
  readonly name: string;
  readonly interactionId: string;
  readonly resourceKey: string;
  readonly stage: Stage;
  readonly startedAt: number;
  readonly time: number;
  readonly elapsedMs: number;
}

export interface InteractionTimelineOptions<Stage extends string> {
  readonly name: string;
  readonly now?: () => number;
  readonly onRecord?: (event: InteractionTimingEvent<Stage>) => void;
  readonly metrics?: Metrics;
  readonly context?: (event: InteractionTimingEvent<Stage>) => TelemetryContext;
}

export interface InteractionTimeline<Stage extends string> {
  readonly begin: (resourceKey: string, stage: Stage) => string;
  readonly record: (stage: Stage, resourceKey: string, interactionId?: string) => InteractionTimingEvent<Stage> | undefined;
  readonly finish: (stage: Stage, resourceKey: string, interactionId?: string) => InteractionTimingEvent<Stage> | undefined;
  readonly cancel: (resourceKey: string) => void;
}

interface ActiveInteraction {
  readonly id: string;
  readonly startedAt: number;
}

export function createInteractionTimeline<Stage extends string>(options: InteractionTimelineOptions<Stage>): InteractionTimeline<Stage> {
  const active = new Map<string, ActiveInteraction>();
  const now = options.now ?? defaultNow;
  let sequence = 0;

  const emit = (stage: Stage, resourceKey: string, interactionId?: string) => {
    const current = active.get(resourceKey);
    const id = interactionId ?? current?.id;
    if (!id || !current || current.id !== id) return undefined;
    const time = now();
    const event: InteractionTimingEvent<Stage> = {
      name: options.name,
      interactionId: id,
      resourceKey,
      stage,
      startedAt: current.startedAt,
      time,
      elapsedMs: Math.max(0, time - current.startedAt),
    };
    options.onRecord?.(event);
    if (options.metrics) {
      const context = options.context?.(event) ?? {
        requestId: id,
        traceId: id,
        phase: stage,
        resourceId: resourceKey,
      };
      options.metrics.duration(`${options.name}.${stage}`, event.elapsedMs, context);
    }
    return event;
  };

  return {
    begin(resourceKey, stage) {
      const id = `${resourceKey}:${++sequence}`;
      active.set(resourceKey, { id, startedAt: now() });
      emit(stage, resourceKey, id);
      return id;
    },
    record: emit,
    finish(stage, resourceKey, interactionId) {
      const event = emit(stage, resourceKey, interactionId);
      if (event) active.delete(resourceKey);
      return event;
    },
    cancel(resourceKey) {
      active.delete(resourceKey);
    },
  };
}

function defaultNow(): number {
  const candidate = (globalThis as { performance?: { now: () => number } }).performance;
  return candidate?.now() ?? Date.now();
}
