import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { ConsoleScopeKind } from '@shop/authz';
import { lazy, Suspense, useEffect, useState } from 'react';
import { Outlet, useLoaderData, useLocation, useNavigate, useNavigation } from 'react-router';
import { ConsoleContextProvider } from '../entity/session/ConsoleContext';
import { StepupProvider } from '../entity/session/StepupContext';
import type { ConsoleContext } from '../entity/session/ConsoleSession';
import { appConfig } from '../shared/config/AppConfig';
import type { RouteRegistryContract } from '../shared/manifest/ComponentManifest';
import { clearConsoleNavigation } from '../shared/navigation/NavigationQuery';
import { scopePath } from '../shared/url/ScopePath';
import { flattenNavigation, navigationPath } from '../shared/url/NavigationPath';
import { transitionConsoleRoute } from '../route/RouteTransition';
import { Header } from './Header';
import { NavigationTree } from './NavigationTree';
import { RouteTitleProvider } from '../shared/ui/RouteTitle';

const StepupDialog = lazy(() => import('./StepupDialog').then((module) => ({ default: module.StepupDialog })));

const scopeLabels: Readonly<Record<ConsoleScopeKind, string>> = Object.freeze({ platform: '平台', distributor: '分销', enterprise: '集团', mall: '商城' });
export function ScopeShell({ registry }: Readonly<{ registry: RouteRegistryContract }>) {
  const context = useLoaderData<ConsoleContext>();
  const location = useLocation();
  const navigate = useNavigate();
  const navigation = useNavigation();
  const queryClient = useQueryClient();
  if (context.navigation === undefined) throw new Error('CONSOLE_NAVIGATION_MISSING');
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [stepupOpen, setStepupOpen] = useState(false);
  const manifest = registry.match(location.pathname);
  const navigationFeatures = context.navigation.nodes;
  const allNodes = flattenNavigation(navigationFeatures);
  const currentNode = allNodes.find((node) => node.component === manifest?.component);
  const activeNode = navigationFeatures.find((node) => node.component === currentNode?.component || flattenNavigation(node.children).some((child) => child.component === currentNode?.component));
  const routeTitle = currentNode?.title ?? '页面不存在';
  const routeSummary = currentNode === undefined ? '该地址没有已授权组件' : `${context.scope.name ?? context.scope.id} · 已授权工作区`;
  const activeRoute = activeNode?.component;
  const routeFeatures = currentNode?.children ?? [];
  const logout = useMutation({
    mutationFn: async () => {
      const { consoleCommand, identitySessionDelete } = await import('../shared/api/Client');
      return identitySessionDelete(
        { body: {} },
        consoleCommand(undefined, {
          accessVersion: context.session.accessVersion,
          ...(context.session.csrf === undefined ? {} : { csrfToken: context.session.csrf }),
        })
      );
    },
    onSettled: () => {
      clearConsoleNavigation();
      queryClient.clear();
      window.location.assign(`${appConfig.authBaseUrl}/login?target=console`);
    },
  });
  const disableStepup = useMutation({
    mutationFn: async () => {
      const { consoleCommand, identityStepupDisable } = await import('../shared/api/Client');
      const result = await identityStepupDisable(
        { body: {} },
        consoleCommand(undefined, {
          accessVersion: context.session.accessVersion,
          ...(context.session.csrf === undefined ? {} : { csrfToken: context.session.csrf }),
        })
      );
      if (result.assurance > 2) throw new Error('STEPUP_DISABLE_INVALID');
      return result;
    },
    onSuccess: () => window.location.reload(),
  });

  useEffect(() => {
    document.title = `${routeTitle} · 智慧翼`;
    setMobileOpen(false);
    let frame = 0;
    let attempts = 0;
    const focusHeading = () => {
      const heading = document.querySelector<HTMLElement>('.workspacebody h1');
      if (heading !== null) {
        heading.setAttribute('tabindex', '-1');
        heading.focus();
        return;
      }
      attempts += 1;
      if (attempts < 30) frame = requestAnimationFrame(focusHeading);
    };
    frame = requestAnimationFrame(focusHeading);
    return () => cancelAnimationFrame(frame);
  }, [location.pathname, routeTitle]);

  const navigateAfterCancel = (target: string) => {
    void transitionConsoleRoute(queryClient, navigate, target);
  };
  const openRoute = (route: string) => {
    setMobileOpen(false);
    navigateAfterCancel(navigationPath({ route }, context.scope));
  };
  const selectScope = (value: string) => {
    const next = context.scopes.find((scope) => `${scope.kind}:${scope.id}` === value);
    if (next !== undefined) navigateAfterCancel(`${scopePath(next, scopeSuffix(location.pathname) || 'cockpit')}${location.search}`);
  };
  const scopeLabel = `${scopeTypeLabel(context.scope.kind)} · ${context.scope.name ?? context.scope.id}`;
  const selectedPeriod = new URLSearchParams(location.search).get('period') ?? '30days';
  const selectPeriod = (period: string) => {
    const search = new URLSearchParams(location.search);
    search.set('period', period);
    navigateAfterCancel(`${location.pathname}?${search.toString()}`);
  };
  const controlContext = manifest?.component === 'control';
  const stepupController = { request: () => setStepupOpen(true) } as const;

  return (
    <ConsoleContextProvider value={context}>
      <StepupProvider controller={stepupController}>
        <div className="consolelayout" data-visual-theme="console-v1" data-route={activeRoute} data-sidebar={collapsed ? 'collapsed' : 'expanded'} data-mobile-nav={mobileOpen ? 'open' : 'closed'}>
          <NavigationTree active={activeRoute} collapsed={collapsed} nodes={navigationFeatures} displayName={context.profile.display_name} roleLabel={scopeLabel} onNavigate={openRoute} onToggle={() => setCollapsed((value) => !value)} />
          <button className="mobilebackdrop" type="button" onClick={() => setMobileOpen(false)} aria-label="关闭主导航" />
          <div className="consoleworkspace">
            <Header
              title={routeTitle}
              summary={routeSummary}
              scopeLabel={scopeLabel}
              displayName={context.profile.display_name}
              assuranceLevel={context.session.assurance.level}
              syncedAt={context.session.syncedAt}
              loggingOut={logout.isPending}
              disablingStepup={disableStepup.isPending}
              {...(disableStepup.error === null ? {} : { stepupError: safeStepupError(disableStepup.error) })}
              onLogout={() => logout.mutate()}
              onStepup={() => setStepupOpen(true)}
              onDisableStepup={() => disableStepup.mutate()}
              onOpenNavigation={() => setMobileOpen(true)}
            />
            <div className="scopebar">
              <div className="scopecontext">
                {controlContext ? <span>{scopeTypeLabel(context.scope.kind)}</span> : null}
                {controlContext ? <i aria-hidden="true">·</i> : null}
                <label className="sr-only" htmlFor="consolescope">
                  当前数据范围
                </label>
                <select id="consolescope" value={`${context.scope.kind}:${context.scope.id}`} onChange={(event) => selectScope(event.target.value)}>
                  {context.scopes.map((scope) => (
                    <option key={`${scope.kind}:${scope.id}`} value={`${scope.kind}:${scope.id}`}>
                      {scope.name ?? scope.id} / 全部商城
                    </option>
                  ))}
                </select>
                <span className="scopedivider" aria-hidden="true">
                  |
                </span>
                {controlContext ? (
                  <span>安全等级 {context.session.assurance.level}</span>
                ) : (
                  <>
                    <label className="sr-only" htmlFor="consoleperiod">
                      统计周期
                    </label>
                    <select id="consoleperiod" value={selectedPeriod} onChange={(event) => selectPeriod(event.target.value)}>
                      <option value="realtime">实时</option>
                      <option value="yesterday">昨天</option>
                      <option value="7days">近 7 天</option>
                      <option value="30days">近 30 天</option>
                    </select>
                  </>
                )}
              </div>
              <div className="scopestatus">
                {navigation.state === 'idle' ? null : <span role="status">正在切换…</span>}
                <span>
                  {controlContext ? '状态评估于' : '数据更新于'} {formatRailTime(context.session.syncedAt)}
                </span>
              </div>
            </div>
            <main className="workspacebody" aria-busy={navigation.state !== 'idle'}>
              <RouteTitleProvider title={routeTitle}>
                <Outlet context={{ nodes: routeFeatures, scope: context.scope }} />
              </RouteTitleProvider>
            </main>
            {stepupOpen ? (
              <Suspense fallback={null}>
                <StepupDialog
                  open
                  accessVersion={context.session.accessVersion}
                  phoneMasked={context.session.security.phoneMasked}
                  {...(context.session.csrf === undefined ? {} : { csrf: context.session.csrf })}
                  onClose={() => setStepupOpen(false)}
                  onComplete={() => window.location.reload()}
                />
              </Suspense>
            ) : null}
            <footer className="consolefooter">
              <span>© 2026 Smart Wing 运营系统 · Scope: {context.scope.id}</span>
              <span className="consolefooterstatus">
                <i aria-hidden="true" />
                服务运行正常
              </span>
              <code>AI 调用需服务端授权</code>
            </footer>
          </div>
        </div>
      </StepupProvider>
    </ConsoleContextProvider>
  );
}

function scopeTypeLabel(kind: ConsoleContext['scope']['kind']): string {
  return scopeLabels[kind];
}

function formatRailTime(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '--:--' : date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
}

function scopeSuffix(pathname: string): string {
  return pathname.split('/').filter(Boolean).slice(3).join('/');
}

function safeStepupError(cause: Error): string {
  return cause.message === 'STEPUP_DISABLE_INVALID' ? '二次验证状态未能关闭，请重试。' : '关闭二次验证失败，请重试。';
}
