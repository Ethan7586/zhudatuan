import { presentError, type FailureView } from '@shop/presentation';
import { useCallback, useEffect, useState } from 'react';
import type { Dependencies } from '../../../app/Dependencies';
import type { AuthRequest } from '../../../shared/security/ReturnTarget';
import type { Provider } from '../../federation';

export function useLoginProviderViewModel(dependencies: Dependencies, target: AuthRequest['target'], enabled: boolean) {
  const [providers, setProviders] = useState<readonly Provider[]>([]);
  const [failure, setFailure] = useState<FailureView>();
  const [loading, setLoading] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const clear = useCallback(() => {
    setProviders([]);
    setFailure(undefined);
    setLoading(false);
  }, []);
  useEffect(() => {
    clear();
    if (!enabled) return;
    const controller = new AbortController();
    setLoading(true);
    void dependencies.federationView
      .read(target, controller.signal)
      .then(setProviders, (cause: unknown) => {
        if (!controller.signal.aborted) setFailure(presentError(cause));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [attempt, clear, dependencies.federationView, enabled, target]);
  return Object.freeze({ providers, failure, loading, clear, retry: () => setAttempt((value) => value + 1) });
}
