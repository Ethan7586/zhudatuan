import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useRef, type ReactNode } from 'react';
import { StorefrontQuery } from '../shared/api/Query';
import type { StorefrontSession } from '../shared/api/Session';
import { useToasts } from '../shared/ui/ToastState';
import { storefrontClient } from '../shared/api/Client';
import { NAVIGATION_IDS } from '../generated/NavigationBinding';
import { ReferralAttributionCoordinator } from '../feature/referral/ReferralAttribution';
import { ReferralGateway } from '../feature/referral/infrastructure/ReferralGateway';
import { HomeGateway } from '../feature/home/infrastructure/HomeGateway';
import { SessionProvider, type SessionState } from '../shared/runtime/SessionContext';
import { storefrontAuthHref } from '../config/storefrontAuth';
import type { StorefrontEntryPath } from '../route/EntryPath';

export interface BootstrapView {
  readonly entry: Readonly<{ handle: string; url: string }>;
  readonly binding: Readonly<{ mall: string }>;
  readonly identity: Readonly<{ version: string; data: Readonly<{ state: 'anonymous' | 'member'; membership: string | null; csrf?: string }> | null }>;
  readonly navigation: Readonly<{ data: readonly Readonly<{ id: string; title: string; icon: string; route: string; order: number }>[] | null }>;
}

export function deriveStorefrontSession(view: BootstrapView | undefined): StorefrontSession | null {
  const identity = view?.identity.data;
  if (!identity || identity.state === 'anonymous') return null;
  if (!identity.membership || !view?.binding.mall) throw new Error('AUTHENTICATED_SESSION_BINDING_INVALID');
  const accessVersion = Number(view.identity.version);
  if (!Number.isSafeInteger(accessVersion) || accessVersion < 0) throw new Error('SESSION_ACCESS_VERSION_INVALID');
  return Object.freeze({ membership: identity.membership, scope: { kind: 'mall' as const, id: view.binding.mall }, accessVersion, csrfToken: identity.csrf ?? null });
}

export function visibleNavigation(view: BootstrapView | undefined): SessionState['navigation'] {
  return Object.freeze((view?.navigation.data ?? []).filter(({ id }) => (NAVIGATION_IDS as readonly string[]).includes(id)));
}

export function useBootstrapQuery(handle: string) {
  return useQuery({
    queryKey: StorefrontQuery.bootstrap(handle),
    queryFn: ({ signal }) => HomeGateway.read(signal),
  });
}

export function shouldRefreshAfterRestore(event: Pick<PageTransitionEvent, 'persisted'>): boolean {
  return event.persisted;
}

export function sessionFingerprint(session: StorefrontSession | null): string {
  return session ? `${session.membership}:${session.accessVersion}` : 'guest';
}

export function isSessionScopeQuery(queryKey: readonly unknown[], scope: string): boolean {
  return queryKey[0] === 'storefront' && queryKey[1] === scope;
}

export function SessionRuntime({ entry, children }: { readonly entry: StorefrontEntryPath; readonly children: ReactNode }) {
  const bootstrap = useBootstrapQuery(entry.handle);
  const queryClient = useQueryClient();
  const toast = useToasts();
  const view = bootstrap.data as unknown as BootstrapView | undefined;
  const scope = view?.binding.mall ?? '';
  const session = useMemo(() => deriveStorefrontSession(view), [view]);
  const fingerprint = sessionFingerprint(session);
  const fingerprintRef = useRef(fingerprint);
  const sessionRef = useRef(session);
  sessionRef.current = session;
  const referral = useRef(
    new ReferralAttributionCoordinator(async (token) => {
      const current = sessionRef.current;
      if (!current) throw new Error('AUTHENTICATION_REQUIRED');
      await ReferralGateway.bind(current, token);
    })
  );
  useEffect(() => {
    if (!scope) return;
    void queryClient.cancelQueries({ predicate: (query) => query.queryKey[0] === 'storefront' && query.queryKey[1] !== scope && query.queryKey[1] !== 'bootstrap' });
  }, [queryClient, scope]);
  useEffect(() => {
    const refreshBootstrap = (event: PageTransitionEvent) => {
      if (!shouldRefreshAfterRestore(event)) return;
      void queryClient.invalidateQueries({ queryKey: StorefrontQuery.bootstrap(entry.handle), exact: true });
    };
    window.addEventListener('pageshow', refreshBootstrap);
    return () => window.removeEventListener('pageshow', refreshBootstrap);
  }, [entry.handle, queryClient]);
  useEffect(() => {
    if (!scope || fingerprintRef.current === fingerprint) return;
    fingerprintRef.current = fingerprint;
    void queryClient.invalidateQueries({ predicate: (query) => isSessionScopeQuery(query.queryKey, scope) });
  }, [fingerprint, queryClient, scope]);
  useEffect(() => {
    if (!session) return;
    void referral.current.capture({ search: window.location.search, mallId: scope, memberId: session.membership });
  }, [scope, session]);
  const logout = useCallback(async () => {
    if (!session) return;
    await storefrontClient.commerce.identity.sessionDelete({ body: {} }, storefrontClient.context(session, { write: true, includeScope: false, idempotencyKey: crypto.randomUUID(), expectedVersion: session.accessVersion }));
    await queryClient.cancelQueries();
    queryClient.clear();
    window.location.assign(storefrontAuthHref());
  }, [queryClient, session]);
  const state = useMemo<SessionState>(
    () => ({
      status: bootstrap.isPending ? 'checking' : bootstrap.isError ? 'error' : session ? 'authenticated' : 'guest',
      session,
      scope,
      entry: Object.freeze({ handle: view?.entry.handle ?? entry.handle, url: view?.entry.url ?? '' }),
      navigation: visibleNavigation(view),
      toasts: toast.toasts,
      showToast: toast.showToast,
      removeToast: toast.removeToast,
      logout,
    }),
    [bootstrap.isError, bootstrap.isPending, entry.handle, logout, scope, session, toast.removeToast, toast.showToast, toast.toasts, view]
  );
  return <SessionProvider value={state}>{children}</SessionProvider>;
}

export { useSession } from '../shared/runtime/SessionContext';
