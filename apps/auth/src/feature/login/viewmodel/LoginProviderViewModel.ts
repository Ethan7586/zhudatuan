import { presentError, type FailureView } from '@shop/presentation';
import { useCallback, useEffect, useState } from 'react';
import type { Dependencies } from '../../../app/Dependencies';
import type { SessionRequest } from '../../../shared/security/ReturnTarget';
import type { Provider } from '../../federation';
import type { Bootstrap } from '../../bootstrap';
import { providerCatalog } from '../model/ProviderCatalog';

export const NO_LOGIN_METHODS: Bootstrap['methods'] = Object.freeze([]);

export function useLoginProviderViewModel(dependencies: Dependencies, session: SessionRequest, methods: Bootstrap['methods']) {
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
    if (!methods.includes('federation')) return;
    const controller = new AbortController();
    setLoading(true);
    void dependencies.federationView
      .read(session, controller.signal)
      .then(setProviders, (cause: unknown) => {
        if (!controller.signal.aborted) setFailure(presentError(cause));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [attempt, clear, dependencies.federationView, methods, session]);
  return Object.freeze({ catalog: providerCatalog(methods, providers), failure, loading, clear, retry: () => setAttempt((value) => value + 1) });
}
