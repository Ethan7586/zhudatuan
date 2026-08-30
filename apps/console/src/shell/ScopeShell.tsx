import { AccessDeniedActionsProvider, ContextualAccessDenied } from '@shop/design';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Outlet, useLoaderData, useLocation, useMatches, useNavigate, useNavigation } from 'react-router';
import { Header } from '../components/Header';
import { Sidebar } from '../components/Sidebar';
import { selectConsoleNavigationItems } from '../entity/navigation/ConsoleNavigation';
import { ConsoleContextProvider } from '../entity/session/ConsoleContext';
import type { ConsoleContext } from '../entity/session/ConsoleSession';
import { professionalRouteFromPath, professionalRoutes, scopeSuffix } from '../route/ProfessionalRouteCatalog';
import { canAccessNavigationTarget } from '../route/NavigationAccess';
import { consoleCommand, identitySessionDelete } from '../shared/api/Client';
import { appConfig } from '../shared/config/AppConfig';
import { scopePath } from '../shared/url/ScopePath';

const scopeLabels = Object.freeze({ platform: '平台', distributor: '分销', tenant: '租户', enterprise: '集团', mall: '商城' });
const financeProfessionalFeatures = new Set(['entries', 'statements', 'reconciliations', 'settlements', 'withdrawals', 'invoices']);
const accessProfessionalFeatures = new Set(['access', 'members']);
const governanceProfessionalFeatures = new Set(['qualification', 'notification']);
const referralProfessionalFeatures = new Set(['referralsettings', 'referralproducts', 'referralreview', 'referralbindings', 'referralwithdrawals', 'referralpromotion']);

export function ScopeShell() {
  const context = useLoaderData<ConsoleContext>();
  const location = useLocation();
  const matches = useMatches();
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
            : professional !== undefined && referralProfessionalFeatures.has(professional.featureKey) ? 'referral'
              : professional?.featureKey ?? workstation?.key;
  const routeAccessKey = professional?.featureKey === 'productdetail' ? 'products'
    : professional?.featureKey === 'orderdetail' ? 'orders'
      : professional?.featureKey ?? workstation?.key;
  const routeAvailable = canAccessNavigationTarget(
    routeAccessKey,
    context.session.permissions,
    context.session.capabilities,
  );
  const logout = useMutation({
    mutationFn: () => identitySessionDelete({}, consoleCommand(undefined, {
      accessVersion: context.session.accessVersion,
      ...(context.session.csrf === undefined ? {} : { csrfToken: context.session.csrf }),
    })),
    onSuccess: () => {
      queryClient.clear();
      window.location.assign(`${appConfig.authBaseUrl}/login?client=console`);
    },
  });

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
    const preferredScopeKind = selectConsoleModuleByEntryPath(suffix)?.navigation.preferredScopeKind;
    const targetScope = preferredScopeKind !== undefined && context.scope.kind !== preferredScopeKind
      ? context.scopes.find((scope) => scope.kind === preferredScopeKind) ?? context.scope
      : context.scope;
    navigateAfterCancel(scopePath(targetScope, suffix));
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
    navigateAfterCancel(`${location.pathname}?${search.toString()}${location.hash}`);
  };
  const controlContext = workstation?.key === 'control';
  const showScopePicker = () => {
    const picker = document.querySelector<HTMLSelectElement>('#consolescope');
    picker?.focus();
    if (picker !== null && typeof picker.showPicker === 'function') picker.showPicker();
  };
  const accessDeniedActions = {
    ...(context.scopes.length > 1 ? { onSwitchScope: showScopePicker } : {}),
    onReturnToWorkspace: () => navigateAfterCancel(scopePath(context.scope, 'cockpit')),
    onRelogin: () => window.location.assign(`${appConfig.authBaseUrl}/login?client=console`),
  };

  return (
    <AccessDeniedActionsProvider actions={accessDeniedActions}>
      <ConsoleContextProvider value={context}>
      <div className="consolelayout" data-visual-theme="admin-web-v1" data-route={activeRoute}
        data-sidebar={collapsed ? 'collapsed' : 'expanded'} data-mobile-nav={mobileOpen ? 'open' : 'closed'}>
        <Sidebar active={activeRoute} collapsed={collapsed} mainItems={mainNavigationItems} bottomItems={bottomNavigationItems}
          displayName={context.profile.display_name} roleLabel={scopeLabel}
          scopeKind={context.scope.kind}
          permissions={context.session.permissions} capabilities={context.session.capabilities}
          workstations={workstations} onNavigate={openRoute}
          onToggle={() => setCollapsed((value) => !value)} />
        <button className="mobilebackdrop" type="button" onClick={() => setMobileOpen(false)} aria-label="关闭主导航" />
        <div className="consoleworkspace">
          <Header title={routeTitle} summary={routeSummary} scopeLabel={scopeLabel}
            displayName={context.profile.display_name} assuranceLevel={context.session.assurance.level} syncedAt={context.session.syncedAt}
            loggingOut={logout.isPending} onLogout={() => logout.mutate()}
            onOpenNavigation={() => setMobileOpen(true)}
            {...(logout.isError ? { logoutError: '退出失败，请重试。' } : {})} />
          <div className="scopebar">
            <div className="scopecontext">
              {controlContext ? <span>{context.scope.id === 'platform:preview' ? '本地预览' : scopeTypeLabel(context.scope.kind)}</span> : null}
              {controlContext ? <i aria-hidden="true">·</i> : null}
              <label className="sr-only" htmlFor="consolescope">当前数据范围</label>
              <select id="consolescope" value={`${context.scope.kind}:${context.scope.id}`} onChange={(event) => selectScope(event.target.value)}>
              {context.scopes.map((scope) => <option key={`${scope.kind}:${scope.id}`} value={`${scope.kind}:${scope.id}`}>
                {scope.name ?? scope.id} / 全部商城
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
            {routeAvailable ? <Outlet /> : <ContextualAccessDenied resourceLabel={routeTitle} />}
          </main>
          <footer className="consolefooter">
            <span>© 2026 ZHUDATUAN 运营系统 · 节点: {context.scope.id === 'platform:preview' ? 'LOCAL-PREVIEW' : 'BJ-01-PROD'}</span>
            <span className="consolefooterstatus"><i aria-hidden="true" />服务运行正常</span>
            <code>AI 调用需服务端授权</code>
          </footer>
        </div>
      </div>
      </ConsoleContextProvider>
    </AccessDeniedActionsProvider>
  );
}

function scopeTypeLabel(kind: ConsoleContext['scope']['kind']): string {
  return kind in scopeLabels ? scopeLabels[kind as keyof typeof scopeLabels] : kind;
}

function formatRailTime(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '--:--' : date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
}
