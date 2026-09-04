import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { QueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useLocation } from 'react-router';
import { useDependencies } from '../../../app/DependencyContext';
import type { StorefrontEntryPath } from '../../../route/EntryPath';
import { StorefrontQuery } from '../../../shared/api/Query';
import type { StorefrontQueryIdentity, StorefrontScopedQueryIdentity } from '../../../shared/api/Query';
import { useToasts } from '../../../shared/view/ToastState';
import { ReferralAttributionCoordinator } from '../../../feature/referral';
import { storefrontAuthHref } from '../../../config/storefrontAuth';
import { EndSession } from '../application/EndSession';
import type { StorefrontSession } from '../model/Session';
import type { StorefrontBootstrap } from '../model/Bootstrap';
import { publishedExperience } from '../model/PublishedExperience';
import type { SessionState } from './SessionContext';

interface BootstrapReader {
  read(signal?: AbortSignal): Promise<StorefrontBootstrap>;
}

export function deriveStorefrontSession(view: StorefrontBootstrap | undefined): StorefrontSession | null {
  const identity = view?.identity.data;
  if (!identity || identity.state === 'anonymous') return null;
  if (!identity.membership || !view?.binding.mall) throw new Error('AUTHENTICATED_SESSION_BINDING_INVALID');
  const accessVersion = Number(view.identity.version);
  if (!Number.isSafeInteger(accessVersion) || accessVersion < 0) throw new Error('SESSION_ACCESS_VERSION_INVALID');
  return Object.freeze({ membership: identity.membership, scope: { kind: 'mall' as const, id: view.binding.mall }, accessVersion, csrfToken: identity.csrf ?? null });
}

export function visibleNavigation(view: StorefrontBootstrap | undefined): SessionState['navigation'] {
  return Object.freeze([...(view?.navigation.data ?? [])]);
}
export function useBootstrapQuery(handle: string, home: BootstrapReader) {
  return useQuery({ queryKey: StorefrontQuery.bootstrap(handle), queryFn: ({ signal }) => home.read(signal) });
}
export function shouldRefreshAfterRestore(event: Pick<PageTransitionEvent, 'persisted'>): boolean {
  return event.persisted;
}
export function sessionFingerprint(session: StorefrontSession | null): string {
  return session ? `${session.scope.kind}:${session.scope.id}:${session.membership}:${session.accessVersion}` : 'guest';
}
export function storefrontQueryIdentity(view: StorefrontBootstrap | undefined, handle: string, session: StorefrontSession | null): StorefrontQueryIdentity {
  const unresolved = 'unresolved';
  const identityVersion = view?.identity.version ?? unresolved;
  const resourceVersion = [identityVersion, view?.benefit.version ?? unresolved, view?.orders.version ?? unresolved].join(':');
  return Object.freeze({
    scoped: Object.freeze({
      client: 'storefront' as const,
      scopeKind: 'mall' as const,
      scopeId: session?.scope.id ?? view?.binding.mall ?? unresolved,
      accessVersion: session?.accessVersion ?? 0,
      resourceVersion,
    }),
    public: Object.freeze({
      client: 'storefront' as const,
      handle,
      mall: view?.binding.mall ?? unresolved,
      releaseVersion: view?.binding.version ?? unresolved,
      catalogVersion: [view?.binding.pool ?? unresolved, view?.binding.version ?? unresolved].join(':'),
    }),
  });
}
export function isSessionScopeQuery(queryKey: readonly unknown[], identity: StorefrontScopedQueryIdentity): boolean {
  return queryKey[0] === identity.client && queryKey[1] === identity.scopeKind && queryKey[2] === identity.scopeId && queryKey[3] === identity.accessVersion;
}

export function shouldRefreshSessionScope(previous: string, current: string): boolean {
  return previous !== current && previous !== 'guest';
}

export async function refreshSessionScope(client: Pick<QueryClient, 'cancelQueries' | 'removeQueries' | 'invalidateQueries'>, identity: StorefrontScopedQueryIdentity, handle: string): Promise<void> {
  const scoped = { predicate: (query: { queryKey: readonly unknown[] }) => isSessionScopeQuery(query.queryKey, identity) };
  await client.cancelQueries(scoped);
  client.removeQueries(scoped);
  await client.invalidateQueries({ queryKey: StorefrontQuery.bootstrap(handle), exact: true });
}

export function useSessionViewModel(entry: StorefrontEntryPath): SessionState {
  const dependencies = useDependencies();
  const location = useLocation();
  const bootstrap = useBootstrapQuery(entry.handle, dependencies.home);
  const queryClient = useQueryClient();
  const toast = useToasts();
  const view = bootstrap.data;
  const scope = view?.binding.mall ?? '';
  const session = useMemo(() => deriveStorefrontSession(view), [view]);
  const experience = useMemo(() => publishedExperience(view), [view]);
  const csrfToken = view?.identity.data?.csrf ?? null;
  const query = useMemo(() => storefrontQueryIdentity(view, entry.handle, session), [entry.handle, session, view]);
  const fingerprint = sessionFingerprint(session);
  const fingerprintRef = useRef(fingerprint);
  const queryRef = useRef(query.scoped);
  const sessionRef = useRef(session);
  sessionRef.current = session;
  const referral = useRef(
    new ReferralAttributionCoordinator(async (token) => {
      const current = sessionRef.current;
      if (!current) throw new Error('AUTHENTICATION_REQUIRED');
      await dependencies.referral.bind(current, token);
    })
  );
  useEffect(() => {
    const refreshBootstrap = (event: PageTransitionEvent) => {
      if (shouldRefreshAfterRestore(event)) void queryClient.invalidateQueries({ queryKey: StorefrontQuery.bootstrap(entry.handle), exact: true });
    };
    window.addEventListener('pageshow', refreshBootstrap);
    return () => window.removeEventListener('pageshow', refreshBootstrap);
  }, [entry.handle, queryClient]);
  useEffect(() => {
    if (!scope || fingerprintRef.current === fingerprint) return;
    const previous = fingerprintRef.current;
    const previousQuery = queryRef.current;
    fingerprintRef.current = fingerprint;
    queryRef.current = query.scoped;
    if (!shouldRefreshSessionScope(previous, fingerprint)) return;
    void refreshSessionScope(queryClient, previousQuery, entry.handle);
  }, [entry.handle, fingerprint, query.scoped, queryClient, scope]);
  useEffect(() => {
    if (session) void referral.current.capture({ search: location.search, mallId: scope, memberId: session.membership });
  }, [location.search, scope, session]);
  const logout = useCallback(async () => {
    if (!session) return;
    await new EndSession(dependencies.session).execute(session);
    await queryClient.cancelQueries();
    queryClient.clear();
    window.location.assign(storefrontAuthHref());
  }, [dependencies.session, queryClient, session]);
  return useMemo(
    () =>
      Object.freeze({
        status: bootstrap.isPending ? ('checking' as const) : bootstrap.isError ? ('error' as const) : session ? ('authenticated' as const) : ('guest' as const),
        session,
        csrfToken,
        scope,
        query,
        entry: Object.freeze({ handle: view?.entry.handle ?? entry.handle, url: view?.entry.url ?? '' }),
        navigation: visibleNavigation(view),
        experience,
        toasts: toast.toasts,
        showToast: toast.showToast,
        removeToast: toast.removeToast,
        logout,
      }),
    [bootstrap.isError, bootstrap.isPending, csrfToken, entry.handle, experience, logout, query, scope, session, toast.removeToast, toast.showToast, toast.toasts, view]
  );
}
