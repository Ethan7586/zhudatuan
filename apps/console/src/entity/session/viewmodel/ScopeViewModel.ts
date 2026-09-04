import type { ConsoleScopeKind } from '@shop/authz';
import { chineseReference, presentError } from '@shop/presentation';
import { useMutation, useQueryClient, type Query } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLoaderData, useLocation, useNavigate, useNavigation } from 'react-router';
import { useDependencies } from '../../../app/DependencyContext';
import { transitionConsoleRoute } from '../../../route/RouteTransition';
import type { RouteRegistryContract } from '../../../shared/manifest/ComponentManifest';
import { clearConsoleNavigation, retainConsoleNavigation } from '../../../shared/navigation/NavigationQuery';
import { flattenNavigation, navigationPath } from '../../../shared/url/NavigationPath';
import { consoleAuthUrl } from '../../../shared/url/AuthUrl';
import { scopeRoutePath } from '../../../shared/url/ScopePath';
import { resolveRoutePath } from '../../../generated/RouteBinding';
import type { ConsoleContext } from '../ConsoleSession';

const scopeLabels: Readonly<Record<ConsoleScopeKind, string>> = Object.freeze({ platform: '平台', distributor: '分销', enterprise: '集团', mall: '商城' });

export function useScopeViewModel(registry: RouteRegistryContract) {
  const context = useLoaderData<ConsoleContext>();
  const location = useLocation();
  const navigate = useNavigate();
  const navigation = useNavigation();
  const queryClient = useQueryClient();
  const dependencies = useDependencies();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [stepupOpen, setStepupOpen] = useState(false);
  const logoutIdentity = useRef(dependencies.session.createIdentity());
  const disableIdentity = useRef(dependencies.session.createIdentity());
  const logoutRunning = useRef(false);
  const disableRunning = useRef(false);
  if (context.navigation === undefined) throw new Error('CONSOLE_NAVIGATION_MISSING');

  const manifest = registry.match(location.pathname);
  const nodes = context.navigation.nodes;
  const currentNode = flattenNavigation(nodes).find((node) => node.component === manifest?.component);
  const activeNode = nodes.find((node) => node.component === currentNode?.component || flattenNavigation(node.children).some((child) => child.component === currentNode?.component));
  const routeTitle = currentNode?.title ?? '页面不存在';
  const routeSummary = currentNode === undefined ? '该地址没有已授权组件' : `${context.scope.name ?? chineseReference('组织范围', context.scope.id)} · 已授权工作区`;
  const routeFeatures = currentNode?.children ?? [];
  const identity = `${context.session.actor}|${context.session.membership}|${context.scope.kind}|${context.scope.id}|${context.session.accessVersion}`;
  const previousIdentity = useRef(identity);

  useEffect(() => {
    document.title = `${routeTitle} · 智慧翼`;
    setMobileOpen(false);
    return focusRouteHeading();
  }, [location.pathname, routeTitle]);

  useEffect(() => {
    if (previousIdentity.current === identity) return;
    previousIdentity.current = identity;
    const stale = (query: Query) => staleConsoleQuery(query, context);
    void queryClient.cancelQueries({ predicate: stale }).then(() => queryClient.removeQueries({ predicate: stale }));
    retainConsoleNavigation(context.session, context.scope);
  }, [context, identity, queryClient]);

  const logout = useMutation({
    mutationFn: () => dependencies.session.delete.execute(sessionCommand(context, logoutIdentity.current)),
    onSettled: () => {
      clearConsoleNavigation();
      queryClient.clear();
      window.location.assign(consoleAuthUrl());
    },
  });
  const disableStepup = useMutation({
    mutationFn: () => dependencies.session.disableStepup.execute(sessionCommand(context, disableIdentity.current)),
    onSuccess: () => window.location.reload(),
    onSettled: () => {
      disableRunning.current = false;
    },
  });
  const logoutSession = logout.mutate;
  const disableSessionAssurance = disableStepup.mutate;
  const performLogout = useCallback(() => {
    if (logoutRunning.current) return;
    logoutRunning.current = true;
    logoutSession();
  }, [logoutSession]);
  const performDisableStepup = useCallback(() => {
    if (disableRunning.current) return;
    disableRunning.current = true;
    disableSessionAssurance();
  }, [disableSessionAssurance]);
  const navigateAfterCancel = useCallback((target: string) => void transitionConsoleRoute(queryClient, navigate, target), [navigate, queryClient]);
  const openRoute = useCallback(
    (route: string) => {
      setMobileOpen(false);
      navigateAfterCancel(navigationPath({ route }, context.scope));
    },
    [context.scope, navigateAfterCancel]
  );
  const selectScope = useCallback(
    (value: string) => {
      const next = context.scopes.find((scope) => `${scope.kind}:${scope.id}` === value);
      if (next === undefined) return;
      const current = registry.resolve(location.pathname);
      const path = current === undefined ? scopeRoutePath(next, 'consolecockpit') : resolveRoutePath(current.routeid, { ...current.parameters, scopeKind: next.kind, scopeId: next.id });
      navigateAfterCancel(`${path}${location.search}`);
    },
    [context.scopes, location.pathname, location.search, navigateAfterCancel, registry]
  );
  const selectPeriod = useCallback(
    (period: string) => {
      const search = new URLSearchParams(location.search);
      search.set('period', period);
      navigateAfterCancel(`${location.pathname}?${search.toString()}`);
    },
    [location.pathname, location.search, navigateAfterCancel]
  );
  const actions = useMemo(
    () =>
      Object.freeze({
        openRoute,
        selectScope,
        selectPeriod,
        toggleNavigation: () => setCollapsed((value) => !value),
        openMobileNavigation: () => setMobileOpen(true),
        closeMobileNavigation: () => setMobileOpen(false),
        requestStepup: () => setStepupOpen(true),
        closeStepup: () => setStepupOpen(false),
        completeStepup: () => window.location.reload(),
        logout: performLogout,
        disableStepup: performDisableStepup,
      }),
    [openRoute, performDisableStepup, performLogout, selectPeriod, selectScope]
  );
  const stepupController = useMemo(() => Object.freeze({ request: actions.requestStepup }), [actions]);
  return Object.freeze({
    context,
    nodes,
    routeFeatures,
    activeRoute: activeNode?.component,
    routeTitle,
    routeSummary,
    scopeLabel: `${scopeTypeLabel(context.scope.kind)} · ${context.scope.name ?? chineseReference('组织范围', context.scope.id)}`,
    scopeType: scopeTypeLabel(context.scope.kind),
    selectedPeriod: new URLSearchParams(location.search).get('period') ?? '30days',
    controlContext: manifest?.component === 'control',
    collapsed,
    mobileOpen,
    stepupOpen,
    navigating: navigation.state !== 'idle',
    loggingOut: logout.isPending,
    disablingStepup: disableStepup.isPending,
    logoutError: logout.error === null ? undefined : presentError(logout.error).message,
    stepupError: disableStepup.error === null ? undefined : presentError(disableStepup.error).message,
    stepupController,
    registeredComponents: registry.all().map((item) => item.component),
    actions,
  });
}

export type ScopeViewModel = ReturnType<typeof useScopeViewModel>;

function scopeTypeLabel(kind: ConsoleContext['scope']['kind']): string {
  return scopeLabels[kind];
}

function staleConsoleQuery(query: Query, context: ConsoleContext): boolean {
  const [surface, kind, id, accessVersion] = query.queryKey;
  return surface === 'console' && (kind !== context.scope.kind || id !== context.scope.id || accessVersion !== context.session.accessVersion);
}

function focusRouteHeading(): () => void {
  let frame = 0;
  let attempts = 0;
  const focus = () => {
    const heading = document.querySelector<HTMLElement>('.workspacebody h1');
    if (heading !== null) {
      heading.setAttribute('tabindex', '-1');
      heading.focus();
      return;
    }
    attempts += 1;
    if (attempts < 30) frame = requestAnimationFrame(focus);
  };
  frame = requestAnimationFrame(focus);
  return () => cancelAnimationFrame(frame);
}

function sessionCommand(context: ConsoleContext, idempotencyKey: string) {
  return {
    accessVersion: context.session.accessVersion,
    idempotencyKey,
    ...(context.session.csrf === undefined ? {} : { csrf: context.session.csrf }),
  };
}
