import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useLocation } from 'react-router';
import { useDependencies } from '../../../app/DependencyContext';
import type { StorefrontEntryPath } from '../../../route/EntryPath';
import { StorefrontQuery } from '../../../shared/api/Query';
import { useToasts } from '../../../shared/view/ToastState';
import { NAVIGATION_IDS } from '../../../generated/NavigationBinding';
import { ReferralAttributionCoordinator } from '../../../feature/referral/ReferralAttribution';
import type { HomeGateway } from '../../../feature/home/infrastructure/HomeGateway';
import { storefrontAuthHref } from '../../../config/storefrontAuth';
import { EndSession } from '../application/EndSession';
import type { StorefrontSession } from '../model/Session';
import type { SessionState } from './SessionContext';

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
export function useBootstrapQuery(handle: string, home: Pick<HomeGateway, 'read'>) {
  return useQuery({ queryKey: StorefrontQuery.bootstrap(handle), queryFn: ({ signal }) => home.read(signal) });
}
export function shouldRefreshAfterRestore(event: Pick<PageTransitionEvent, 'persisted'>): boolean { return event.persisted; }
export function sessionFingerprint(session: StorefrontSession | null): string { return session ? `${session.membership}:${session.accessVersion}` : 'guest'; }
export function isSessionScopeQuery(queryKey: readonly unknown[], scope: string): boolean { return queryKey[0] === 'storefront' && queryKey[1] === scope; }

export function useSessionViewModel(entry: StorefrontEntryPath): SessionState {
  const dependencies = useDependencies();
  const location = useLocation();
  const bootstrap = useBootstrapQuery(entry.handle, dependencies.home);
  const queryClient = useQueryClient();
  const toast = useToasts();
  const view = bootstrap.data as unknown as BootstrapView | undefined;
  const scope = view?.binding.mall ?? '';
  const session = useMemo(() => deriveStorefrontSession(view), [view]);
  const fingerprint = sessionFingerprint(session);
  const fingerprintRef = useRef(fingerprint);
  const sessionRef = useRef(session);
  sessionRef.current = session;
  const referral = useRef(new ReferralAttributionCoordinator(async (token) => {
    const current = sessionRef.current;
    if (!current) throw new Error('AUTHENTICATION_REQUIRED');
    await dependencies.referral.bind(current, token);
  }));
  useEffect(() => {
    if (!scope) return;
    void queryClient.cancelQueries({ predicate: (query) => query.queryKey[0] === 'storefront' && query.queryKey[1] !== scope && query.queryKey[1] !== 'bootstrap' });
  }, [queryClient, scope]);
  useEffect(() => {
    const refreshBootstrap = (event: PageTransitionEvent) => { if (shouldRefreshAfterRestore(event)) void queryClient.invalidateQueries({ queryKey: StorefrontQuery.bootstrap(entry.handle), exact: true }); };
    window.addEventListener('pageshow', refreshBootstrap);
    return () => window.removeEventListener('pageshow', refreshBootstrap);
  }, [entry.handle, queryClient]);
  useEffect(() => {
    if (!scope || fingerprintRef.current === fingerprint) return;
    fingerprintRef.current = fingerprint;
    void queryClient.cancelQueries({ predicate: (query) => isSessionScopeQuery(query.queryKey, scope) });
    queryClient.removeQueries({ predicate: (query) => isSessionScopeQuery(query.queryKey, scope) });
    void queryClient.invalidateQueries({ queryKey: StorefrontQuery.bootstrap(entry.handle), exact: true });
  }, [entry.handle, fingerprint, queryClient, scope]);
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
  return useMemo(() => Object.freeze({
    status: bootstrap.isPending ? 'checking' as const : bootstrap.isError ? 'error' as const : session ? 'authenticated' as const : 'guest' as const,
    session,
    scope,
    entry: Object.freeze({ handle: view?.entry.handle ?? entry.handle, url: view?.entry.url ?? '' }),
    navigation: visibleNavigation(view),
    toasts: toast.toasts,
    showToast: toast.showToast,
    removeToast: toast.removeToast,
    logout,
  }), [bootstrap.isError, bootstrap.isPending, entry.handle, logout, scope, session, toast.removeToast, toast.showToast, toast.toasts, view]);
}
