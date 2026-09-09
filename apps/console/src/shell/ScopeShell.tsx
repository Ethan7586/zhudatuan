import { RouteScroll } from '@shop/design';
import { lazy, Suspense } from 'react';
import { Outlet, useLocation } from 'react-router';
import { useDependencies } from '../app/DependencyContext';
import { ConsoleContextProvider } from '../entity/session/ConsoleContext';
import { StepupProvider } from '../entity/session/StepupContext';
import { useScopeViewModel } from '../entity/session/viewmodel/ScopeViewModel';
import { useTaskIndicatorViewModel } from '../feature/task/viewmodel/TaskIndicatorViewModel';
import type { RouteRegistryContract } from '../shared/manifest/ComponentManifest';
import { TaskCenter } from '../shared/task/TaskCenter';
import { Header } from './Header';
import { NavigationTree } from './NavigationTree';
import { RouteTitleProvider } from '../shared/ui/RouteTitle';

const Stepup = lazy(() => import('../entity/session/Stepup').then((module) => ({ default: module.Stepup })));

export function ScopeShell({ registry }: Readonly<{ registry: RouteRegistryContract }>) {
  const location = useLocation();
  const model = useScopeViewModel(registry);
  const { context, actions } = model;
  const taskCenter = useTaskIndicatorViewModel(context, useDependencies().task);

  return (
    <ConsoleContextProvider value={context}>
      <StepupProvider controller={model.stepupController}>
        <RouteScroll entry={location.key} />
        <div className="consolelayout" data-visual-theme="console-v1" data-route={model.activeRoute} data-sidebar={model.collapsed ? 'collapsed' : 'expanded'} data-mobile-nav={model.mobileOpen ? 'open' : 'closed'}>
          <NavigationTree active={model.activeRoute} collapsed={model.collapsed} nodes={model.nodes} displayName={context.profile.display_name} roleLabel={model.scopeLabel} onNavigate={actions.openRoute} onDismiss={actions.closeMobileNavigation} onToggle={actions.toggleNavigation} />
          <button className="mobilebackdrop" type="button" onClick={actions.closeMobileNavigation} aria-label="点击页面空白处关闭主导航" />
          <div className="consoleworkspace">
            <Header
              title={model.routeTitle}
              summary={model.routeSummary}
              scopeLabel={model.scopeLabel}
              displayName={context.profile.display_name}
              assuranceLevel={context.session.assurance.level}
              syncedAt={context.session.syncedAt}
              loggingOut={model.loggingOut}
              disablingStepup={model.disablingStepup}
              taskCenter={<TaskCenter model={taskCenter} />}
              destinations={model.destinations}
              {...(model.notification === undefined ? {} : { notification: model.notification })}
              {...(model.support === undefined ? {} : { support: model.support })}
              {...(model.logoutError === undefined ? {} : { logoutError: model.logoutError })}
              {...(model.stepupError === undefined ? {} : { stepupError: model.stepupError })}
              onLogout={actions.logout}
              onNavigate={actions.openRoute}
              onStepup={actions.requestStepup}
              onDisableStepup={actions.disableStepup}
              onOpenNavigation={actions.openMobileNavigation}
            />
            <div className="scopebar">
              <div className="scopecontext">
                <ol className="scopepath" aria-label="当前管理范围">
                  {model.scopeTrail.map((scope) => (
                    <li key={scope.key} aria-current={scope.current ? 'page' : undefined}>
                      {scope.label}
                    </li>
                  ))}
                </ol>
                <i aria-hidden="true">·</i>
                <label className="sr-only" htmlFor="consolescope">
                  切换管理范围
                </label>
                <select id="consolescope" value={`${context.scope.kind}:${context.scope.id}`} onChange={(event) => actions.selectScope(event.target.value)} aria-label="切换管理范围">
                  {model.scopeChoices.map((scope) => (
                    <option key={scope.value} value={scope.value}>
                      {scope.label}
                    </option>
                  ))}
                </select>
                <span className="scopedivider" aria-hidden="true">
                  |
                </span>
                {model.controlContext ? (
                  <span>安全等级 {context.session.assurance.level}</span>
                ) : (
                  <>
                    <label className="sr-only" htmlFor="consoleperiod">
                      统计周期
                    </label>
                    <select id="consoleperiod" value={model.selectedPeriod} onChange={(event) => actions.selectPeriod(event.target.value)}>
                      <option value="realtime">实时</option>
                      <option value="yesterday">昨天</option>
                      <option value="7days">近 7 天</option>
                      <option value="30days">近 30 天</option>
                    </select>
                  </>
                )}
              </div>
              <div className="scopestatus">
                {model.navigating ? <span role="status">正在切换…</span> : null}
                <span>
                  {model.controlContext ? '状态评估于' : '数据更新于'} {formatRailTime(context.session.syncedAt)}
                </span>
              </div>
            </div>
            <main className="workspacebody" aria-busy={model.navigating}>
              <RouteTitleProvider title={model.routeTitle}>
                <Outlet context={{ nodes: model.routeFeatures, scope: context.scope }} />
              </RouteTitleProvider>
            </main>
            {model.stepupOpen ? (
              <Suspense fallback={null}>
                <Stepup
                  open
                  accessVersion={context.session.accessVersion}
                  phoneMasked={context.session.security.phoneMasked}
                  {...(context.session.csrf === undefined ? {} : { csrf: context.session.csrf })}
                  onClose={actions.closeStepup}
                  onComplete={actions.completeStepup}
                />
              </Suspense>
            ) : null}
            <footer className="consolefooter">
              <span className="consolefooterscope">© 2026 智慧翼运营系统 · 当前数据范围：{context.scope.name ?? model.scopeType}</span>
              <span className="consolefooterstatus">
                <i aria-hidden="true" />
                服务运行正常
              </span>
              <code className="consolefooterhint">智能助手调用需服务端授权</code>
            </footer>
          </div>
        </div>
      </StepupProvider>
    </ConsoleContextProvider>
  );
}

function formatRailTime(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '--:--' : date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
}
