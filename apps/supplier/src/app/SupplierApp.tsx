import { RouteScroll, useBrowserPath, useResourceQuery } from '@shop/design';
import { hasFailureCode, presentError, projectRecords } from '@shop/presentation';
import { actionField, requiredText, type ActionInput, type OperatorAction } from '@shop/presentation/actions';
import { readSurfaceNavigation, readSurfaceSession, selectSurfaceScope, surfaceRequestContext, type SurfaceNavigation } from '@shop/sdk/session';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { createSupplierDependencies, type SupplierDependencies } from './Dependencies';
import { SUPPLIER_ROUTES } from './RouteRegistry';
import { NAVIGATION_CATALOG_HASH } from '../generated/NavigationBinding';
import { matchRoutePath, resolveRoutePath, type RouteId, type RouteMatch } from '../generated/RouteBinding';
import { supplierCommand } from '../shared/Command';
import type { SupplierFeatureViewModel } from '../shared/FeatureViewModel';
import { SupplierShell } from '../shell/SupplierShell';

interface SupplierSnapshot {
  readonly scopeLabel: string;
  readonly employeeLabel: string;
  readonly title: string;
  readonly description: string;
  readonly items: readonly Readonly<{ id: string; path: string; title: string }>[];
  readonly raw: unknown;
  readonly route: RouteMatch;
  readonly context: ReturnType<typeof surfaceRequestContext>;
  readonly viewModel: SupplierFeatureViewModel;
}

interface StepupState {
  readonly action: string;
  readonly selectedKey?: string;
  readonly challenge: string;
}

export function SupplierApp({ dependencies: supplied }: Readonly<{ dependencies?: SupplierDependencies }>) {
  const dependencies = useMemo(() => supplied ?? createSupplierDependencies(), [supplied]);
  const location = useBrowserPath();
  const load = useCallback((signal: AbortSignal) => loadSupplier(dependencies, location.pathname, location.navigate, signal), [dependencies, location.pathname, location.navigate]);
  const query = useResourceQuery(location.pathname, load);
  const [selectedKey, setSelectedKey] = useState<string>();
  const [replacement, setReplacement] = useState<unknown>();
  const [stepup, setStepup] = useState<StepupState>();
  const authenticationRequired = hasFailureCode(query.error, 'AUTHENTICATION_REQUIRED');
  useEffect(() => {
    if (authenticationRequired) window.location.replace(authHref(dependencies.environment.authOrigin, location.pathname));
  }, [authenticationRequired, dependencies.environment.authOrigin, location.pathname]);
  const error = query.error === undefined || authenticationRequired ? undefined : presentError(query.error).message;
  const value = query.data;
  useEffect(() => {
    setSelectedKey(undefined);
    setReplacement(undefined);
    setStepup(undefined);
  }, [location.pathname, value]);
  if (value === undefined) return <Loading pathname={location.pathname} {...(error === undefined ? {} : { error })} retry={query.reload} navigate={location.navigate} entry={location.entry} />;
  const raw = replacement ?? value.raw;
  const data = value.viewModel.project?.(raw, value.route) ?? projectRecords(raw);
  const sourceActions = value.viewModel.actions?.(raw, value.route, selectedKey) ?? [];
  const actions = sourceActions.map((action) => (stepup?.action === action.id && stepup.selectedKey === selectedKey ? withStepupCode(action) : action));
  const execute = async (action: OperatorAction, input: ActionInput) => {
    if (!navigator.onLine) throw new Error('网络不可用，操作尚未提交。请恢复网络后重试。');
    const handler = value.viewModel.execute;
    if (handler === undefined) throw new Error('当前页面没有可执行操作。');
    const context = supplierCommand(value.context, action.expectedVersion);
    let commandInput = input;
    if (stepup?.action === action.id && stepup.selectedKey === selectedKey) {
      await dependencies.client.identity.stepupComplete({ body: { challenge: stepup.challenge, code: requiredText(input, 'stepupcode', 12) } }, identityContext(value.context));
      commandInput = Object.freeze(Object.fromEntries(Object.entries(input).filter(([name]) => name !== 'stepupcode')));
      setStepup(undefined);
    }
    try {
      const result = await handler(dependencies.client, context, value.route, raw, selectedKey, action, commandInput);
      if (result.destination) location.navigate(result.destination);
      else if (result.data !== undefined) setReplacement(result.data);
      else if (result.refresh !== false) setReplacement(await value.viewModel.read(dependencies.client, value.context, value.route));
      setSelectedKey(undefined);
      return { message: result.message, ...(result.destination === undefined ? {} : { destination: result.destination }) };
    } catch (cause) {
      if (!hasFailureCode(cause, 'STEPUP_REQUIRED')) throw cause;
      const challenge = await dependencies.client.identity.stepupStart({ body: {} }, identityContext(value.context));
      setStepup(Object.freeze({ action: action.id, ...(selectedKey === undefined ? {} : { selectedKey }), challenge: challenge.id }));
      return { message: '验证码已发送，请输入验证码后再次确认。', keepOpen: true };
    }
  };
  const select = (key: string) => {
    setSelectedKey(key);
    setStepup(undefined);
  };
  return (
    <>
      <RouteScroll entry={location.entry} />
      <SupplierShell pathname={location.pathname} scopeLabel={value.scopeLabel} title={value.title} description={value.description} items={value.items} data={data} context={<span>{value.employeeLabel}</span>} actions={actions} {...(selectedKey === undefined ? {} : { selectedKey })} select={select} execute={execute} {...(error === undefined ? {} : { error })} retry={query.reload} navigate={location.navigate} />
    </>
  );
}

async function loadSupplier(dependencies: SupplierDependencies, pathname: string, navigate: (path: string, replace?: boolean) => void, signal: AbortSignal): Promise<SupplierSnapshot> {
  const session = await readSurfaceSession(dependencies.client, dependencies.environment, 'supplier', NAVIGATION_CATALOG_HASH, signal);
  const match = pathname === '/' ? undefined : matchRoutePath(pathname);
  if (pathname !== '/' && match === undefined) throw new Error('SUPPLIER_ROUTE_NOT_FOUND');
  const scope = selectSurfaceScope(session, 'supplier', match === undefined ? undefined : scopeCandidate(match));
  const navigation = await readSurfaceNavigation(dependencies.client, dependencies.environment, session, scope, NAVIGATION_CATALOG_HASH, signal);
  const items = navigationItems(navigation, scope.kind, scope.id);
  const landing = navigationLanding(navigation, scope.kind, scope.id);
  if (pathname === '/') navigate(landing, true);
  const route = match ?? matchRoutePath(landing);
  if (route === undefined || !routeAllowed(route, navigation)) throw new Error('SUPPLIER_ROUTE_DENIED');
  const manifest = await SUPPLIER_ROUTES[route.id].load();
  const context = surfaceRequestContext(dependencies.environment, session, scope, NAVIGATION_CATALOG_HASH, signal);
  const [result, profile] = await Promise.all([manifest.viewModel.read(dependencies.client, context, route), dependencies.client.member.profileRead({}, context)]);
  const employeeLabel = profile.employee_no ? `${profile.display_name} · 工号 ${profile.employee_no}` : profile.display_name;
  return Object.freeze({ scopeLabel: `供应商 · ${shortScope(scope.id)}`, employeeLabel, title: manifest.viewModel.title, description: manifest.viewModel.description, items, raw: result, route, context, viewModel: manifest.viewModel });
}

function Loading(value: Readonly<{ pathname: string; error?: string; retry: () => void; navigate: (path: string) => void; entry: string }>) {
  return (
    <>
      <RouteScroll entry={value.entry} />
      <SupplierShell scopeLabel="正在校验供应商身份" pathname={value.pathname} title="正在加载" description="正在同步权限、导航和业务数据。" items={[]} data={undefined} {...(value.error === undefined ? {} : { error: value.error })} retry={value.retry} navigate={value.navigate} />
    </>
  );
}

function navigationItems(navigation: SurfaceNavigation, scopeKind: string, scopeId: string) {
  return Object.freeze(
    flatten(navigation.nodes)
      .filter((node) => !node.experience.disabled && node.experience.placement === 'primary')
      .map((node) => Object.freeze({ id: node.experience.routeKey, title: node.title, path: resolveRoutePath(node.experience.routeKey as RouteId, { scopeKind, scopeId }) }))
  );
}

function routeAllowed(route: RouteMatch, navigation: SurfaceNavigation): boolean {
  return flatten(navigation.nodes).some((node) => !node.experience.disabled && node.experience.routeKey === route.id);
}

function navigationLanding(navigation: SurfaceNavigation, scopeKind: string, scopeId: string): string {
  const node = flatten(navigation.nodes).find((candidate) => candidate.key === navigation.defaultKey && !candidate.experience.disabled);
  if (node === undefined) throw new Error('SUPPLIER_NAVIGATION_EMPTY');
  return resolveRoutePath(node.experience.routeKey as RouteId, { scopeKind, scopeId });
}

function flatten(nodes: readonly SurfaceNavigation['nodes'][number][]): readonly SurfaceNavigation['nodes'][number][] {
  return Object.freeze(nodes.flatMap((node) => [node, ...flatten(node.children)]));
}

function scopeCandidate(route: RouteMatch) {
  const parameters = route.parameters as Readonly<Record<string, string>>;
  if (parameters.scopeKind === undefined || parameters.scopeId === undefined) throw new Error('SUPPLIER_SCOPE_ROUTE_INVALID');
  return Object.freeze({ kind: parameters.scopeKind, id: parameters.scopeId });
}

function authHref(origin: string, returnPath: string): string {
  const target = new URL('/', origin);
  target.searchParams.set('target', 'supplier');
  target.searchParams.set('returnpath', returnPath);
  return target.toString();
}

function shortScope(value: string): string {
  return value.length <= 20 ? value : `${value.slice(0, 12)}…${value.slice(-6)}`;
}

function withStepupCode(action: OperatorAction): OperatorAction {
  return Object.freeze({ ...action, confirmation: '本操作需要再次验证当前人员身份。请输入刚收到的验证码后提交。', fields: Object.freeze([...action.fields, actionField('stepupcode', '身份验证码', { kind: 'password', maximumLength: 12 })]) });
}

function identityContext(context: ReturnType<typeof surfaceRequestContext>) {
  const { scope: _scope, expectedVersion: _version, idempotencyKey: _key, ...identity } = context;
  return supplierCommand(identity);
}
