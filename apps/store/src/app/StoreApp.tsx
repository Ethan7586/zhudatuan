import { OperatorWorkspace, RouteScroll, useBrowserPath, useResourceQuery } from '@shop/design';
import type { OperationOutputFor } from '@shop/contract';
import { hasFailureCode, presentError, projectRecords } from '@shop/presentation';
import { actionField, requiredText, type ActionInput, type OperatorAction } from '@shop/presentation/actions';
import { preloadSurfaceRoutes, selectSurfaceScope, SurfaceAccessRuntime, surfaceNavigationNodes, surfaceRequestContext, type SurfaceNavigation } from '@shop/sdk/session';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { createStoreDependencies, type StoreDependencies } from './Dependencies';
import { STORE_ROUTES } from './RouteRegistry';
import { NAVIGATION_CATALOG_HASH } from '../generated/NavigationBinding';
import { matchRoutePath, resolveRoutePath, type RouteId, type RouteMatch } from '../generated/RouteBinding';
import { commandContext } from '../shared/Command';
import type { StoreFeatureViewModel } from '../shared/FeatureViewModel';

interface StoreSnapshot {
  readonly scopeLabel: string;
  readonly title: string;
  readonly description: string;
  readonly items: readonly Readonly<{ id: string; path: string; title: string }>[];
  readonly employeeLabel: string;
  readonly raw: unknown;
  readonly route: RouteMatch;
  readonly context: ReturnType<typeof surfaceRequestContext>;
  readonly viewModel: StoreFeatureViewModel;
}

interface StepupState {
  readonly action: string;
  readonly selectedKey?: string;
  readonly challenge: string;
}

export function StoreApp({ dependencies: supplied }: Readonly<{ dependencies?: StoreDependencies }>) {
  const dependencies = useMemo(() => supplied ?? createStoreDependencies(), [supplied]);
  const access = useMemo(() => new SurfaceAccessRuntime(dependencies.client, dependencies.environment, 'store', NAVIGATION_CATALOG_HASH), [dependencies]);
  const location = useBrowserPath();
  const load = useCallback((signal: AbortSignal) => loadStore(dependencies, access, location.pathname, location.navigate, signal), [access, dependencies, location.pathname, location.navigate]);
  const query = useResourceQuery(location.pathname, load);
  const retry = useCallback(() => {
    access.clear();
    query.reload();
  }, [access, query.reload]);
  const [selectedKey, setSelectedKey] = useState<string>();
  const [replacement, setReplacement] = useState<unknown>();
  const [stepup, setStepup] = useState<StepupState>();
  const authenticationRequired = hasFailureCode(query.error, 'AUTHENTICATION_REQUIRED');
  useEffect(() => {
    if (!authenticationRequired) return;
    access.clear();
    window.location.replace(authHref(dependencies.environment.authOrigin, location.pathname));
  }, [access, authenticationRequired, dependencies.environment.authOrigin, location.pathname]);
  const error = query.error === undefined || authenticationRequired ? undefined : presentError(query.error).message;
  const value = query.data;
  useEffect(() => {
    setSelectedKey(undefined);
    setReplacement(undefined);
    setStepup(undefined);
  }, [location.pathname, value]);
  if (value === undefined) {
    return (
      <>
        <RouteScroll entry={location.entry} />
        <OperatorWorkspace
          product="门店工作台"
          scopeLabel="正在校验门店身份"
          pathname={location.pathname}
          title="正在加载"
          description="正在同步权限、导航和业务数据。"
          items={[]}
          data={undefined}
          {...(error === undefined ? {} : { error })}
          retry={retry}
          navigate={location.navigate}
        />
      </>
    );
  }
  const raw = replacement ?? value.raw;
  const data = value.viewModel.project?.(raw, value.route) ?? projectRecords(raw);
  const sourceActions = value.viewModel.actions?.(raw, value.route, selectedKey) ?? [];
  const actions = sourceActions.map((action) => (stepup?.action === action.id && stepup.selectedKey === selectedKey ? withStepupCode(action) : action));
  const execute = async (action: OperatorAction, input: ActionInput) => {
    if (!navigator.onLine) throw new Error('网络不可用，操作尚未提交。请恢复网络后重试。');
    const handler = value.viewModel.execute;
    if (handler === undefined) throw new Error('当前页面没有可执行操作。');
    const operationContext = action.identityScope === true ? identityContext(value.context, action.expectedVersion) : commandContext(value.context, action.expectedVersion);
    let commandInput = input;
    if (stepup?.action === action.id && stepup.selectedKey === selectedKey) {
      await dependencies.client.identity.stepupComplete({ body: { challenge: stepup.challenge, code: requiredText(input, 'stepupcode', 12) } }, identityContext(value.context));
      commandInput = Object.freeze(Object.fromEntries(Object.entries(input).filter(([name]) => name !== 'stepupcode')));
      setStepup(undefined);
    }
    let result;
    try {
      result = await handler(dependencies.client, operationContext, value.route, raw, selectedKey, action, commandInput);
    } catch (cause) {
      if (!hasFailureCode(cause, 'STEPUP_REQUIRED')) throw cause;
      const challenge = await dependencies.client.identity.stepupStart({ body: {} }, identityContext(value.context));
      setStepup(Object.freeze({ action: action.id, ...(selectedKey === undefined ? {} : { selectedKey }), challenge: challenge.id }));
      return { message: '验证码已发送，请输入验证码后再次确认。', keepOpen: true };
    }
    if (result.sessionEnded) {
      access.clear();
      window.location.replace(authHref(dependencies.environment.authOrigin, location.pathname));
      return { message: result.message };
    }
    if (result.destination) location.navigate(result.destination);
    else if (result.data !== undefined) setReplacement(result.data);
    else if (result.refresh !== false) setReplacement(await value.viewModel.read(dependencies.client, value.context, value.route));
    setSelectedKey(undefined);
    return { message: result.message, ...(result.destination === undefined ? {} : { destination: result.destination }) };
  };
  const select = (key: string) => {
    setSelectedKey(key);
    setStepup(undefined);
  };
  return (
    <>
      <RouteScroll entry={location.entry} />
      <OperatorWorkspace
        product="门店工作台"
        pathname={location.pathname}
        scopeLabel={value.scopeLabel}
        title={value.title}
        description={value.description}
        items={value.items}
        data={data}
        {...(selectedKey === undefined ? {} : { selectedKey })}
        actions={actions}
        context={<span>{value.employeeLabel}</span>}
        select={select}
        execute={execute}
        {...(error === undefined ? {} : { error })}
        retry={retry}
        navigate={location.navigate}
      />
    </>
  );
}

async function loadStore(dependencies: StoreDependencies, access: SurfaceAccessRuntime, pathname: string, navigate: (path: string, replace?: boolean) => void, signal: AbortSignal): Promise<StoreSnapshot> {
  const match = pathname === '/' ? undefined : matchRoutePath(pathname);
  if (pathname !== '/' && match === undefined) throw new Error('STORE_ROUTE_NOT_FOUND');
  const manifestPromise = match === undefined ? Promise.resolve(undefined) : STORE_ROUTES[match.id].load();
  const [session, requestedManifest] = await Promise.all([access.session(signal), manifestPromise]);
  const scope = selectSurfaceScope(session, 'store', match === undefined ? undefined : scopeCandidate(match));
  const context = surfaceRequestContext(dependencies.environment, session, scope, NAVIGATION_CATALOG_HASH, signal);
  const navigationPromise = access.navigation(session, scope, signal);
  const profilePromise = dependencies.client.member.profileRead({}, context);
  if (match !== undefined && requestedManifest !== undefined) {
    const resultPromise = requestedManifest.viewModel.read(dependencies.client, context, match);
    const [navigation, result, profile] = await Promise.all([navigationPromise, resultPromise, profilePromise]);
    preloadSurfaceRoutes(navigation, STORE_ROUTES);
    if (!routeAllowed(match, navigation)) throw new Error('STORE_ROUTE_DENIED');
    return storeSnapshot(scope.id, navigation, profile, result, match, context, requestedManifest.viewModel);
  }
  const [navigation, profile] = await Promise.all([navigationPromise, profilePromise]);
  preloadSurfaceRoutes(navigation, STORE_ROUTES);
  const landing = navigationLanding(navigation, scope.kind, scope.id);
  navigate(landing, true);
  const route = matchRoutePath(landing);
  if (route === undefined || !routeAllowed(route, navigation)) throw new Error('STORE_ROUTE_DENIED');
  const manifest = await STORE_ROUTES[route.id].load();
  const result = await manifest.viewModel.read(dependencies.client, context, route);
  return storeSnapshot(scope.id, navigation, profile, result, route, context, manifest.viewModel);
}

function storeSnapshot(
  scope: string,
  navigation: SurfaceNavigation,
  profile: OperationOutputFor<'member.profile.read'>,
  result: unknown,
  route: RouteMatch,
  context: ReturnType<typeof surfaceRequestContext>,
  viewModel: StoreFeatureViewModel
): StoreSnapshot {
  const employee = profile.employee_no ? `${profile.display_name} · 工号 ${profile.employee_no}` : profile.display_name;
  return Object.freeze({
    scopeLabel: `门店 · ${shortScope(scope)}`,
    employeeLabel: employee,
    title: viewModel.title,
    description: viewModel.description,
    items: navigationItems(navigation, 'store', scope),
    raw: result,
    route,
    context,
    viewModel,
  });
}

function navigationItems(navigation: SurfaceNavigation, scopeKind: string, scopeId: string): readonly Readonly<{ id: string; path: string; title: string }>[] {
  return Object.freeze(
    surfaceNavigationNodes(navigation)
      .filter((node) => !node.experience.disabled && node.experience.placement === 'primary')
      .map((node) => Object.freeze({ id: node.experience.routeKey, title: node.title, path: resolveRoutePath(node.experience.routeKey as RouteId, { scopeKind, scopeId }) }))
  );
}

function routeAllowed(route: RouteMatch, navigation: SurfaceNavigation): boolean {
  const enabled = surfaceNavigationNodes(navigation).filter((node) => !node.experience.disabled);
  return enabled.some((node) => node.experience.routeKey === route.id);
}

function navigationLanding(navigation: SurfaceNavigation, scopeKind: string, scopeId: string): string {
  const node = surfaceNavigationNodes(navigation).find((candidate) => candidate.key === navigation.defaultKey && !candidate.experience.disabled);
  if (node === undefined) throw new Error('STORE_NAVIGATION_EMPTY');
  return resolveRoutePath(node.experience.routeKey as RouteId, { scopeKind, scopeId });
}

function scopeCandidate(route: RouteMatch): Readonly<{ kind: string; id: string }> {
  const parameters = route.parameters as Readonly<Record<string, string>>;
  const kind = parameters.scopeKind;
  const id = parameters.scopeId;
  if (kind === undefined || id === undefined) throw new Error('STORE_SCOPE_ROUTE_INVALID');
  return Object.freeze({ kind, id });
}

export function authHref(origin: string, returnPath: string): string {
  const target = new URL('/', origin);
  target.searchParams.set('target', 'store');
  target.searchParams.set('returnpath', returnPath);
  return target.toString();
}

function shortScope(value: string): string {
  return value.length <= 20 ? value : `${value.slice(0, 12)}…${value.slice(-6)}`;
}

function withStepupCode(action: OperatorAction): OperatorAction {
  return Object.freeze({
    ...action,
    confirmation: '本操作需要再次验证当前员工身份。请输入刚收到的验证码后提交。',
    fields: Object.freeze([...action.fields, actionField('stepupcode', '身份验证码', { kind: 'password', maximumLength: 12 })]),
  });
}

function identityContext(context: ReturnType<typeof surfaceRequestContext>, expectedVersion?: number) {
  const { scope: _scope, expectedVersion: _expectedVersion, idempotencyKey: _idempotencyKey, ...identity } = context;
  return commandContext(identity, expectedVersion);
}
