import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Outlet, useLoaderData, useLocation, useNavigate, useNavigation } from 'react-router';
import { Header } from '../components/Header';
import { Sidebar } from '../components/Sidebar';
import { applicationScopePresentation } from '../feature/application/ApplicationScope';
import { ConsoleContextProvider } from '../entity/session/ConsoleContext';
import type { ConsoleContext } from '../entity/session/ConsoleSession';
import { professionalRouteFromPath, professionalRoutes, scopeSuffix } from '../route/ProfessionalRouteCatalog';
import { consoleCommand, identitySessionDelete } from '../shared/api/Client';
import { appConfig } from '../shared/config/AppConfig';
import { buildInfo } from '../shared/config/BuildInfo';
import { scopePath } from '../shared/url/ScopePath';
import { workstationFromPath, workstations } from './Workstation';

const scopeLabels = Object.freeze({ platform: '平台', distributor: '分销', tenant: '租户', enterprise: '集团', mall: '商城' });
const financeProfessionalFeatures = new Set(['entries', 'statements', 'reconciliations', 'settlements', 'withdrawals', 'invoices']);
const accessProfessionalFeatures = new Set(['access', 'members']);
const governanceProfessionalFeatures = new Set(['qualification', 'notification']);

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
  const navigate = useNavigate();
  const navigation = useNavigation();
  const queryClient = useQueryClient();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const workstation = workstationFromPath(location.pathname);
  const professional = professionalRouteFromPath(location.pathname);
  const commercePresentation = professional?.featureKey === 'applications'
    ? applicationScopePresentation(context.scope.kind)
    : undefined;
  const routeTitle = commercePresentation?.title ?? professional?.title ?? workstation?.title ?? '页面不存在';
  const routeSummary = commercePresentation?.description ?? professional?.summary ?? workstation?.summary ?? '该地址不属于 Console 路由清单';
  const activeRoute = professional?.featureKey === 'productdetail' ? 'products'
    : professional?.featureKey === 'orderdetail' ? 'orders'
      : professional !== undefined && financeProfessionalFeatures.has(professional.featureKey) ? 'finance'
        : professional !== undefined && accessProfessionalFeatures.has(professional.featureKey) ? 'access'
          : professional !== undefined && governanceProfessionalFeatures.has(professional.featureKey) ? 'qualification'
            : professional?.featureKey ?? workstation?.key;
  const logout = useMutation({
    mutationFn: () => identitySessionDelete({}, consoleCommand(undefined, { accessVersion: context.session.accessVersion })),
    onSuccess: () => {
      queryClient.clear();
      window.location.assign(`${appConfig.authBaseUrl}/login?client=console`);
    } catch {
      setLogoutState('error');
    }
  };

  useEffect(() => {
    document.title = `${routeTitle} · 主打团`;
    setMobileOpen(false);
    const frame = requestAnimationFrame(() => {
      const heading = document.querySelector<HTMLElement>('.workspacebody h1');
      heading?.setAttribute('tabindex', '-1');
      heading?.focus();
    });
    return () => cancelAnimationFrame(frame);
  }, [location.pathname, routeTitle]);

  const navigateAfterCancel = (target: string) => {
    void queryClient.cancelQueries({ queryKey: ['console'] });
    void navigate(target);
  };
  const openRoute = (suffix: string) => {
    setMobileOpen(false);
    navigateAfterCancel(scopePath(context.scope, suffix));
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
  const controlContext = workstation?.key === 'control';

  return (
    <ConsoleContextProvider value={context}>
      <div className="consolelayout" data-visual-theme="admin-web-v1" data-route={activeRoute}
        data-sidebar={collapsed ? 'collapsed' : 'expanded'} data-mobile-nav={mobileOpen ? 'open' : 'closed'}>
        <Sidebar active={activeRoute} collapsed={collapsed} professionalRoutes={professionalRoutes}
          displayName={context.profile.display_name} roleLabel={scopeLabel}
          scopeKind={context.scope.kind}
          workstations={workstations} onNavigate={openRoute}
          onToggle={() => setCollapsed((value) => !value)} />
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
            <span>© 2026 主打团运营系统 · 节点: {context.scope.id === 'platform:preview' ? 'LOCAL-PREVIEW' : 'BJ-01-PROD'}</span>
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
