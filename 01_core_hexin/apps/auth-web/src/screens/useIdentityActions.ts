import { useKeyedActionCoordinator } from '@shop/interaction/react';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  beginAuthInteraction,
  cancelAuthInteraction,
  finishAuthInteraction,
  recordAuthInteraction,
  type AuthInteractionStage,
} from '../services/authInteractionTelemetry';

interface IdentityActionHandlers<Result> {
  readonly onSuccess: (result: Result) => void;
  readonly onError: (reason: unknown) => void;
  readonly completionStages?:
    | readonly Extract<AuthInteractionStage, 'server-response' | 'session-exchange' | 'redirect'>[]
    | ((result: Result) => readonly Extract<AuthInteractionStage, 'server-response' | 'session-exchange' | 'redirect'>[]);
}

export function useIdentityActions<Key extends string>() {
  const coordinator = useKeyedActionCoordinator<Key>();
  const interactionIds = useRef(new Map<Key, string>());
  const mounted = useRef(false);
  const [busyKeys, setBusyKeys] = useState<ReadonlySet<Key>>(() => new Set());

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const markBusy = useCallback((key: Key, busy: boolean) => {
    setBusyKeys((current) => {
      const next = new Set(current);
      if (busy) next.add(key);
      else next.delete(key);
      return next;
    });
  }, []);

  const pointerDown = useCallback((key: Key) => {
    if (coordinator.isRunning(key)) return;
    interactionIds.current.set(key, beginAuthInteraction(key));
  }, [coordinator]);

  const run = useCallback(<Result,>(
    key: Key,
    action: (signal: AbortSignal) => Promise<Result>,
    handlers: IdentityActionHandlers<Result>,
  ) => {
    const interactionId = interactionIds.current.get(key) ?? beginAuthInteraction(key);
    interactionIds.current.set(key, interactionId);
    const attempt = coordinator.start(key, ({ signal }) => {
      recordAuthInteraction('request-start', key, interactionId);
      return action(signal);
    });
    if (!attempt.started) return false;

    markBusy(key, true);
    const frame = typeof requestAnimationFrame === 'function'
      ? requestAnimationFrame(() => recordAuthInteraction('button-feedback', key, interactionId))
      : undefined;

    void attempt.promise
      .then((result) => {
        if (!mounted.current || !coordinator.isLatest(key, attempt.revision)) return;
        const stages = typeof handlers.completionStages === 'function'
          ? handlers.completionStages(result)
          : handlers.completionStages ?? ['server-response'];
        for (let index = 0; index < stages.length; index += 1) {
          const stage = stages[index];
          if (index === stages.length - 1) finishAuthInteraction(stage, key, interactionId);
          else recordAuthInteraction(stage, key, interactionId);
        }
        handlers.onSuccess(result);
      })
      .catch((reason: unknown) => {
        if (!mounted.current || !coordinator.isLatest(key, attempt.revision)) return;
        recordAuthInteraction('rollback', key, interactionId);
        handlers.onError(reason);
        finishAuthInteraction('error', key, interactionId);
      })
      .finally(() => {
        if (frame !== undefined && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(frame);
        if (!mounted.current || !coordinator.isLatest(key, attempt.revision)) return;
        interactionIds.current.delete(key);
        markBusy(key, false);
      });
    return true;
  }, [coordinator, markBusy]);

  const cancel = useCallback((key?: Key) => {
    if (key === undefined) {
      for (const activeKey of interactionIds.current.keys()) cancelAuthInteraction(activeKey);
      interactionIds.current.clear();
      coordinator.cancel();
      setBusyKeys(new Set());
      return;
    }
    cancelAuthInteraction(key);
    interactionIds.current.delete(key);
    coordinator.cancel(key);
    markBusy(key, false);
  }, [coordinator, markBusy]);

  const isBusy = useCallback((key: Key) => busyKeys.has(key), [busyKeys]);
  return { cancel, isBusy, pointerDown, run };
}
