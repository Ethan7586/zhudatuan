import { useQueryClient } from '@tanstack/react-query';
import { lazy, Suspense, useEffect, useState } from 'react';
import { Outlet, useLoaderData, useLocation, useMatches, useNavigate, useNavigation } from 'react-router';
import { selectConsoleNavigationItems } from '../entity/navigation/ConsoleNavigation';
import { ConsoleContextProvider } from '../entity/session/ConsoleContext';
import type { ConsoleContext } from '../entity/session/ConsoleSession';
import { scopeDisplayName, scopeKindLabel } from '../entity/session/ScopePresentation';
import { consoleModuleById, consoleModules, selectConsoleModuleByEntryPath } from '../route/ConsoleModuleRegistry';
import { deepestConsoleRouteHandle, resolveConsoleRoutePresentation } from '../route/ConsoleModuleRoutes';
import { scopeSuffix } from '../route/ProfessionalRouteCatalog';
import { buildInfo } from '../shared/config/BuildInfo';
import { scopePath } from '../shared/url/ScopePath';

const LazyHeader = lazy(async () => {
  const { Header } = await import('../components/Header');
  await new Promise<void>((resolve) => window.setTimeout(resolve, import.meta.env.PROD ? 200 : 0));
  return { default: Header };
});

const LazySidebar = lazy(async () => {
  const { Sidebar } = await import('../components/Sidebar');
  return { default: Sidebar };
});

const LazyAccessDeniedActionsProvider = lazy(async () => {
  const { AccessDeniedActionsProvider } = await import('@shop/design/access-denied');
  return { default: AccessDeniedActionsProvider };
});

export function ScopeShell() {
  const context = useLoaderData<ConsoleContext>();
  const location = useLocation();
  const matches = useMatches();
  const navigate = useNavigate();
  const navigation = useNavigation();
  const queryClient = useQueryClient();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [logoutState, setLogoutState] = useState<'idle' | 'pending' | 'error'>('idle');
  const handle = deepestConsoleRouteHandle(matches);
  const activeModule = handle === undefined ? undefined : consoleModuleById.get(handle.moduleId);
  const presentation = handle === undefined
    ? undefined
    : resolveConsoleRoutePresentation(handle.presentation, context.scope.kind);
  const currentSuffix = scopeSuffix(location.pathname);
  const profileRoute = currentSuffix === 'settings/profile';
  const routeTitle = profileRoute ? '个人信息' : presentation?.title ?? '页面不存在';
  const routeSummary = profileRoute ? '查看当前账户、身份、权限与管理范围' : presentation?.summary ?? '该地址不属于 Console 路由清单';
  const brandName = context.scope.kind === 'platform' ? 'zdt-next' : scopeDisplayName(context.scope);
  const brandSubtitle = context.scope.kind === 'mall' ? '商城运营后台' : '经营与权限管理';
  const activeRoute = profileRoute ? 'profile' : activeModule?.id;
  const navigationItems = selectConsoleNavigationItems(consoleModules, context.scope.kind, context.session.capabilities);
  const mainNavigationItems = navigationItems.filter(({ placement }) => placement === 'main');
  const bottomNavigationItems = navigationItems.filter(({ placement }) => placement === 'bottom');
  const logout = async () => {
    setLogoutState('pending');
    try {
      const [{ consoleCommand, identitySessionDelete }, { appConfig }] = await Promise.all([
        import('../shared/api/Client'),
        import('../shared/config/AppConfig'),
      ]);
      await identitySessionDelete({}, consoleCommand(undefined, {
        accessVersion: context.session.accessVersion,
        ...(context.session.csrf === undefined ? {} : { csrfToken: context.session.csrf }),
      }));
      queryClient.clear();
      window.location.assign(appConfig.identityEntryUrl);
    } catch {
      setLogoutState('error');
    }
  };

  useEffect(() => {
    document.title = `${routeTitle} · ${brandName}`;
    setMobileOpen(false);
    let observer: MutationObserver | undefined;
    const focusRouteHeading = () => {
      const heading = document.querySelector<HTMLElement>('.workspacebody h1');
      if (heading === null) return false;
      heading.setAttribute('tabindex', '-1');
      heading.focus();
      return true;
    };
    const frame = requestAnimationFrame(() => {
      if (focusRouteHeading()) return;
      const workspace = document.querySelector<HTMLElement>('.workspacebody');
      if (workspace === null) return;
      observer = new MutationObserver(() => {
        if (focusRouteHeading()) observer?.disconnect();
      });
      observer.observe(workspace, { childList: true, subtree: true });
    });
    return () => {
      cancelAnimationFrame(frame);
      observer?.disconnect();
    };
  }, [brandName, location.pathname, routeTitle]);

  const navigateAfterCancel = (target: string) => {
    void queryClient.cancelQueries({ queryKey: ['console'] });
    void navigate(target);
  };
  const openRoute = (suffix: string) => {
    setMobileOpen(false);
    const preferredScopeKind = selectConsoleModuleByEntryPath(suffix)?.navigation.preferredScopeKind;
    const targetScope = preferredScopeKind !== undefined && context.scope.kind !== preferredScopeKind
      ? context.scopes.find((scope) => scope.kind === preferredScopeKind) ?? context.scope
      : context.scope;
    navigateAfterCancel(scopePath(targetScope, suffix));
  };
  const selectScope = (value: string) => {
    const next = context.scopes.find((scope) => `${scope.kind}:${scope.id}` === value);
    if (next !== undefined) navigateAfterCancel(`${scopePath(next, currentSuffix || 'cockpit')}${location.search}`);
  };
  const scopeLabel = `${scopeKindLabel(context.scope.kind)} · ${scopeDisplayName(context.scope)}`;
  const selectedPeriod = new URLSearchParams(location.search).get('period') ?? '30days';
  const selectPeriod = (period: string) => {
    const search = new URLSearchParams(location.search);
    search.set('period', period);
    navigateAfterCancel(`${location.pathname}?${search.toString()}${location.hash}`);
  };
  const controlContext = activeModule?.id === 'control';
  const showScopePicker = () => {
    const picker = document.querySelector<HTMLSelectElement>('#consolescope');
    picker?.focus();
    if (picker !== null && typeof picker.showPicker === 'function') picker.showPicker();
  };
  const accessDeniedActions = {
    ...(context.scopes.length > 1 ? { onSwitchScope: showScopePicker } : {}),
    onReturnToWorkspace: () => navigateAfterCancel(scopePath(context.scope, 'cockpit')),
    onRelogin: () => {
      void import('../shared/config/AppConfig').then(({ appConfig }) => {
        window.location.assign(appConfig.identityEntryUrl);
      });
    },
  };

  return (
    <ConsoleContextProvider value={context}>
      <div className="consolelayout" data-visual-theme="admin-web-v1" data-route={activeRoute}
        data-sidebar={collapsed ? 'collapsed' : 'expanded'} data-mobile-nav={mobileOpen ? 'open' : 'closed'}>
        <Suspense fallback={<aside className={`consolesidebar${collapsed ? ' iscollapsed' : ''}`} aria-hidden="true" />}>
          <LazySidebar active={activeRoute} collapsed={collapsed} mainItems={mainNavigationItems} bottomItems={bottomNavigationItems}
            displayName={context.profile.display_name} roleLabel={scopeLabel} brandName={brandName} brandSubtitle={brandSubtitle}
            onNavigate={openRoute}
            onOpenProfile={() => openRoute('settings/profile')}
            onToggle={() => setCollapsed((value) => !value)} />
        </Suspense>
        <button className="mobilebackdrop" type="button" onClick={() => setMobileOpen(false)} aria-label="关闭主导航" />
        <div className="consoleworkspace">
          <Suspense fallback={<header className="consoleheader" aria-hidden="true" />}>
            <LazyHeader title={routeTitle} summary={routeSummary} scopeLabel={scopeLabel}
              displayName={context.profile.display_name} assuranceLevel={context.session.assurance.level} syncedAt={context.session.syncedAt}
              loggingOut={logoutState === 'pending'} onLogout={() => { void logout(); }}
              onOpenNavigation={() => setMobileOpen(true)}
              onOpenProfile={() => openRoute('settings/profile')}
              {...(logoutState === 'error' ? { logoutError: '退出失败，请重试。' } : {})} />
          </Suspense>
          <div className="scopebar">
            <div className="scopecontext">
              {controlContext ? <span>{context.scope.id === 'platform:preview' ? '本地预览' : scopeKindLabel(context.scope.kind)}</span> : null}
              {controlContext ? <i aria-hidden="true">·</i> : null}
              <label className="sr-only" htmlFor="consolescope">当前数据范围</label>
              <select id="consolescope" value={`${context.scope.kind}:${context.scope.id}`} onChange={(event) => selectScope(event.target.value)}>
              {context.scopes.map((scope) => <option key={`${scope.kind}:${scope.id}`} value={`${scope.kind}:${scope.id}`}>
                {scopeDisplayName(scope)} / 全部商城
              </option>)}
              </select>
              <span className="scopedivider" aria-hidden="true">|</span>
              {controlContext ? <span>AAL{context.session.assurance.level}</span> : <>
                <label className="sr-only" htmlFor="consoleperiod">统计周期</label>
                <select id="consoleperiod" value={selectedPeriod} onChange={(event) => selectPeriod(event.target.value)}>
                  <option value="7days">近 7 天</option><option value="30days">近 30 天</option><option value="90days">近 90 天</option>
                </select>
              </>}
            </div>
            <div className="scopestatus">
              {navigation.state === 'idle' ? null : <span role="status">正在切换…</span>}
              <span>{controlContext ? '状态评估于' : '数据更新于'} {formatRailTime(context.session.syncedAt)}</span>
            </div>
          </div>
          <main className="workspacebody" aria-busy={navigation.state !== 'idle'}>
            {activeModule?.id === 'cockpit' ? <Outlet /> : (
              <Suspense fallback={<span role="status">正在加载…</span>}>
                <LazyAccessDeniedActionsProvider actions={accessDeniedActions}><Outlet /></LazyAccessDeniedActionsProvider>
              </Suspense>
            )}
          </main>
          <footer className="consolefooter">
            <span data-testid="console-build-info" title={buildInfo.detailLabel}>{buildInfo.footerLabel} · © 2026 {brandName}运营系统 · 节点: {context.scope.id === 'platform:preview' ? 'LOCAL-PREVIEW' : 'BJ-01-PROD'}</span>
            <span className="consolefooterstatus"><i aria-hidden="true" />服务运行正常</span>
            <code>AI 调用需服务端授权</code>
          </footer>
        </div>
      </div>
    </ConsoleContextProvider>
  );
}

function formatRailTime(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '--:--'
    : `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}
