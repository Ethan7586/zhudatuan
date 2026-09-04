import type { FailureView } from '@shop/presentation';
import { presentError } from '@shop/presentation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Dependencies } from '../../../app/Dependencies';
import type { SessionRequest } from '../../../shared/security/ReturnTarget';
import type { Provider } from '../../federation';
import type { IdentityLink } from '../model/Link';

export type LinkPhase = 'loading' | 'ready' | 'redirecting' | 'conflict';

export function useLinkViewModel(dependencies: Dependencies, session: SessionRequest, conflict: boolean) {
  const [phase, setPhase] = useState<LinkPhase>(conflict ? 'conflict' : 'loading');
  const [links, setLinks] = useState<readonly IdentityLink[]>([]);
  const [providers, setProviders] = useState<readonly Provider[]>([]);
  const [selected, setSelected] = useState('');
  const [pending, setPending] = useState<IdentityLink>();
  const [failure, setFailure] = useState<FailureView>();
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const active = useRef<AbortController | undefined>(undefined);

  const load = useCallback(() => {
    if (conflict) return;
    active.current?.abort();
    const request = new AbortController();
    active.current = request;
    setPhase('loading');
    setFailure(undefined);
    void Promise.all([dependencies.readLinks.execute(session, request.signal), dependencies.providers.execute(session, request.signal)]).then(
      ([snapshot, catalog]) => {
        if (request.signal.aborted) return;
        setLinks(snapshot.links);
        setProviders(catalog);
        setSelected(availableProviders(catalog, snapshot.links)[0]?.id ?? '');
        setPhase('ready');
      },
      (cause: unknown) => {
        if (request.signal.aborted) return;
        setFailure(presentError(cause));
        setPhase('ready');
      }
    );
  }, [conflict, dependencies.providers, dependencies.readLinks, session]);

  useEffect(() => {
    load();
    return () => active.current?.abort();
  }, [load]);

  const available = useMemo(() => availableProviders(providers, links), [links, providers]);
  const create = () => {
    if (busy || !selected || !available.some(({ id }) => id === selected)) return;
    active.current?.abort();
    const request = new AbortController();
    active.current = request;
    setBusy(true);
    setFailure(undefined);
    setNotice('');
    void dependencies.createLink
      .execute(selected, session, request.signal)
      .then(
        ({ redirectUrl }) => {
          if (request.signal.aborted) return;
          setPhase('redirecting');
          dependencies.navigation.assignExternal(redirectUrl);
        },
        (cause: unknown) => {
          if (!request.signal.aborted) setFailure(presentError(cause));
        }
      )
      .finally(() => {
        if (!request.signal.aborted) setBusy(false);
      });
  };
  const revoke = () => {
    if (busy || pending === undefined) return;
    active.current?.abort();
    const request = new AbortController();
    active.current = request;
    const target = pending;
    setBusy(true);
    setFailure(undefined);
    setNotice('');
    void dependencies.revokeLink
      .execute(target.id, session, request.signal)
      .then(
        () => {
          if (request.signal.aborted) return;
          const remaining = links.filter(({ id }) => id !== target.id);
          setLinks(remaining);
          setPending(undefined);
          setNotice('身份绑定已解除。账号和其他登录方式没有变化。');
          setSelected(availableProviders(providers, remaining)[0]?.id ?? '');
        },
        (cause: unknown) => {
          if (!request.signal.aborted) setFailure(presentError(cause));
        }
      )
      .finally(() => {
        if (!request.signal.aborted) setBusy(false);
      });
  };

  return Object.freeze({
    phase,
    links,
    providers,
    available,
    selected,
    pending,
    failure,
    notice,
    busy,
    select: setSelected,
    askRevoke: setPending,
    cancelRevoke: () => setPending(undefined),
    load,
    create,
    revoke,
  });
}

export type LinkViewModel = ReturnType<typeof useLinkViewModel>;

function availableProviders(providers: readonly Provider[], links: readonly IdentityLink[]): readonly Provider[] {
  const active = new Set(links.filter(({ status }) => status === 'active').map(({ provider }) => provider));
  return Object.freeze(providers.filter(({ id }) => !active.has(id)));
}
