import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, extname, resolve } from 'node:path';
import { format, resolveConfig } from 'prettier';
import { parse } from 'yaml';
import { parseNavigation, type NavigationNode, type RouteDefinition } from './NavigationSchema';
import { validateNavigation, type OperationReference } from './NavigationValidator';

export async function generateNavigation(root: string, check: boolean): Promise<{ readonly hash: string; readonly nodes: number; readonly routes: number }> {
  const input = await readFile(resolve(root, 'config/navigation.yml'), 'utf8');
  const capacityDocument = parse(await readFile(resolve(root, 'config/capacity.yml'), 'utf8')) as Readonly<{ navigation?: NavigationCapacity }>;
  const capacity = capacityDocument.navigation;
  if (capacity === undefined) throw new Error('NAVIGATION_CAPACITY_MISSING');
  const clientDocument = parse(await readFile(resolve(root, 'config/clients.yml'), 'utf8')) as Readonly<{ version?: unknown; clients?: readonly ClientReference[] }>;
  const clients = clientDocument.clients;
  if (clientDocument.version !== 1 || !Array.isArray(clients) || clients.map(({ id }) => id).join(',') !== 'auth,console,storefront,miniapp,store,supplier') throw new Error('NAVIGATION_CLIENT_CATALOG_INVALID');
  const operations = parse(await readFile(resolve(root, 'packages/contract/definitions/operations.yml'), 'utf8'), { merge: true }) as { readonly operations?: readonly OperationReference[] };
  if (!Array.isArray(operations.operations)) throw new Error('NAVIGATION_OPERATION_CATALOG_INVALID');
  const document = parseNavigation(
    parse(input),
    clients.map(({ id }) => id)
  );
  const validated = validateNavigation(document, operations.operations, capacity);
  const canonical = JSON.stringify({ version: document.version, routes: validated.routes, nodes: validated.nodes });
  const hash = createHash('sha256').update(canonical).digest('hex');
  const routeById = new Map(validated.routes.map((route) => [route.id, route]));
  const operationById = new Map(operations.operations.map((operation) => [operation.id, operation]));
  const resolvedNodes = validated.nodes.map((node) => resolveNode(node, routeById, operationById));
  const outputs = new Map<string, string>([
    [resolve(root, 'services/commerce/src/modules/navigation/infrastructure/registry/NavigationCatalog.ts'), serverSource(resolvedNodes, hash)],
    [resolve(root, 'packages/config/src/RouteCatalog.ts'), sharedRouteCatalogSource(validated.routes, hash)],
    [resolve(root, 'evidence/navigation/catalog.json'), `${JSON.stringify({ version: 2, hash, routes: validated.routes, nodes: resolvedNodes }, null, 2)}\n`],
  ]);
  for (const client of clients) {
    const routes = validated.routes.filter(({ surface }) => surface === client.id);
    outputs.set(resolve(root, `${client.path}/${client.sourceRoot}/generated/RouteBinding.ts`), routeBindingSource(routes, hash));
    outputs.set(
      resolve(root, `${client.path}/${client.sourceRoot}/generated/NavigationBinding.ts`),
      navigationBindingSource(
        resolvedNodes.filter(({ surface }) => surface === client.id),
        routes,
        hash
      )
    );
    if (client.sourceRoot === 'miniprogram') {
      outputs.set(resolve(root, `${client.path}/${client.sourceRoot}/generated/PageBinding.ts`), miniappPageBindingSource(routes));
      outputs.set(resolve(root, `${client.path}/${client.sourceRoot}/app.json`), miniappApplicationSource(routes));
    }
  }
  for (const [path, content] of outputs) {
    const generated = extname(path) === '.ts' ? await format(content, { ...(await resolveConfig(path)), parser: 'typescript' }) : content;
    await emit(path, generated, check);
  }
  return Object.freeze({ hash, nodes: validated.nodes.length, routes: validated.routes.length });
}

interface ClientReference {
  readonly id: 'auth' | 'console' | 'storefront' | 'miniapp' | 'store' | 'supplier';
  readonly path: string;
  readonly sourceRoot: 'src' | 'miniprogram';
}

interface NavigationCapacity {
  readonly maximumRoutes: number;
  readonly maximumNodes: number;
}

interface ResolvedNode {
  readonly key: string;
  readonly surface: NavigationNode['surface'];
  readonly scope: NavigationNode['scope'];
  readonly parent: string | null;
  readonly title: string;
  readonly order: number;
  readonly operation: string;
  readonly owner: string;
  readonly permission: string | null;
  readonly capability: string;
  readonly featureFlags: readonly string[];
  readonly experience: Readonly<{
    icon: string;
    routeKey: string;
    route: string;
    component: string;
    placement: NavigationNode['placement'];
    empty: NavigationNode['empty'];
  }>;
}

function resolveNode(node: NavigationNode, routeById: ReadonlyMap<string, RouteDefinition>, operationById: ReadonlyMap<string, OperationReference>): ResolvedNode {
  const route = routeById.get(node.routeid);
  if (route === undefined) throw new Error(`NAVIGATION_ROUTE_UNKNOWN:${node.routeid}`);
  const operation = operationById.get(node.entry);
  if (operation === undefined) throw new Error(`NAVIGATION_ENTRY_UNKNOWN:${node.id}:${node.entry}`);
  return Object.freeze({
    key: node.id,
    surface: node.surface,
    scope: node.scope,
    parent: node.parent,
    title: node.title,
    order: node.order,
    operation: operation.id,
    owner: operation.owner,
    permission: operation.permission,
    capability: operation.capability,
    featureFlags: Object.freeze(route.requirements.filter((requirement) => operation.requirements.includes(requirement))),
    experience: Object.freeze({ icon: node.icon, routeKey: node.routeid, route: route.path, component: route.feature, placement: node.placement, empty: node.empty }),
  });
}

function serverSource(nodes: readonly ResolvedNode[], hash: string): string {
  return `// Generated by @shop/navigationgen. Do not edit.\nexport const NAVIGATION_CATALOG_HASH = '${hash}' as const;\nconst SOURCE = ${JSON.stringify(nodes, null, 2)} as const;\nexport const NAVIGATION_CATALOG = Object.freeze(SOURCE.map((node) => Object.freeze({ ...node, featureFlags: Object.freeze([...node.featureFlags]), experience: Object.freeze({ ...node.experience }) })));\nexport type NavigationNode = typeof NAVIGATION_CATALOG[number];\nexport type NavigationKey = NavigationNode['key'];\nexport const NAVIGATION_BY_KEY: ReadonlyMap<NavigationKey, NavigationNode> = new Map(NAVIGATION_CATALOG.map((node) => [node.key, node]));\nexport const NAVIGATION_FEATURE_FLAGS: ReadonlySet<string> = new Set(NAVIGATION_CATALOG.flatMap((node) => node.featureFlags));\n`;
}

function navigationBindingSource(nodes: readonly ResolvedNode[], routes: readonly RouteDefinition[], hash: string): string {
  const ids = unique(nodes.map(({ key }) => key));
  const features = unique(routes.map(({ feature }) => feature));
  const routeids = unique(nodes.map(({ experience }) => experience.routeKey));
  const groups = unique(routes.flatMap(({ group }) => (group === null ? [] : [group])));
  const byFeature = Object.fromEntries(nodes.map(({ experience }) => [experience.component, experience.route]));
  const byKey = new Map(nodes.map((node) => [node.key, node]));
  const manifest = nodes.map((node) =>
    Object.freeze({
      key: node.key,
      title: node.title,
      routeKey: node.experience.routeKey,
      feature: node.experience.component,
      scope: node.scope,
      parent: node.parent,
      operation: node.operation,
      capability: node.capability,
      permission: node.permission,
      breadcrumbs: navigationBreadcrumbs(node, byKey),
      order: node.order,
      placement: node.experience.placement,
    })
  );
  return `// Generated by @shop/navigationgen. Do not edit.
import type { OperationId } from '@shop/contract';

export const NAVIGATION_CATALOG_HASH = '${hash}' as const;
export const NAVIGATION_IDS = ${JSON.stringify(ids)} as const;
export type NavigationId = typeof NAVIGATION_IDS[number];
export const COMPONENT_KEYS = ${JSON.stringify(features)} as const;
export type ComponentKey = typeof COMPONENT_KEYS[number];
export const NAVIGATION_ROUTE_IDS = ${JSON.stringify(routeids)} as const;
export type NavigationRouteId = typeof NAVIGATION_ROUTE_IDS[number];
export const NAVIGATION_GROUPS = ${JSON.stringify(groups)} as const;
export type NavigationGroup = typeof NAVIGATION_GROUPS[number];
export const NAVIGATION_ROUTES = Object.freeze(${JSON.stringify(byFeature)}) as Readonly<Partial<Record<ComponentKey, string>>>;
export interface NavigationManifest {
  readonly key: NavigationId;
  readonly title: string;
  readonly routeKey: NavigationRouteId;
  readonly feature: ComponentKey;
  readonly scope: 'platform' | 'distributor' | 'tenant' | 'enterprise' | 'mall' | 'department' | 'store' | 'supplier' | 'brand' | 'self' | 'owner';
	  readonly parent: ${ids.length === 0 ? 'null' : 'NavigationId | null'};
  readonly operation: OperationId;
  readonly capability: string;
  readonly permission: string | null;
  readonly breadcrumbs: readonly string[];
  readonly order: number;
  readonly placement: 'primary' | 'secondary' | 'contextual';
}
const MANIFEST_SOURCE: readonly NavigationManifest[] = ${JSON.stringify(manifest)};
export const NAVIGATION_MANIFEST = Object.freeze(MANIFEST_SOURCE.map((item) => Object.freeze({ ...item, breadcrumbs: Object.freeze([...item.breadcrumbs]) })));
export const NAVIGATION_BY_ID: ReadonlyMap<NavigationId, NavigationManifest> = new Map(NAVIGATION_MANIFEST.map((item) => [item.key, item]));
export function navigationForRoute(routeid: NavigationRouteId): readonly NavigationManifest[] { return Object.freeze(NAVIGATION_MANIFEST.filter(({ routeKey }) => routeKey === routeid)); }
`;
}

function navigationBreadcrumbs(node: ResolvedNode, nodes: ReadonlyMap<string, ResolvedNode>): readonly string[] {
  const titles: string[] = [];
  const visited = new Set<string>();
  let current: ResolvedNode | undefined = node;
  while (current !== undefined) {
    if (visited.has(current.key)) throw new Error(`NAVIGATION_BREADCRUMB_CYCLE:${node.key}`);
    visited.add(current.key);
    titles.unshift(current.title);
    current = current.parent === null ? undefined : nodes.get(current.parent);
    if (current !== undefined && (current.surface !== node.surface || current.scope !== node.scope)) throw new Error(`NAVIGATION_BREADCRUMB_BOUNDARY_INVALID:${node.key}`);
  }
  return Object.freeze(titles);
}

function routeBindingSource(routes: readonly RouteDefinition[], hash: string): string {
  const entries = Object.fromEntries(routes.map(({ id, path }) => [id, path]));
  const requirements = Object.fromEntries(routes.map(({ id, requirements: ids }) => [id, ids]));
  const features = Object.fromEntries(routes.map(({ id, feature }) => [id, feature]));
  const groups = Object.fromEntries(routes.map(({ id, group }) => [id, group]));
  const defaults = Object.fromEntries(routes.map(({ id, default: isDefault }) => [id, isDefault]));
  const parameters = Object.fromEntries(routes.map(({ id, path }) => [id, routeParameters(path)]));
  const base = routeBase(routes);
  const relativeRouteImport = base === '/' ? '' : "import { relativeRoutePath } from '@shop/config/routepath';\n";
  const parameterTypes = Object.entries(parameters)
    .map(([id, names]) => `${JSON.stringify(id)}: ${names.length === 0 ? 'Readonly<Record<never, never>>' : `Readonly<{ ${names.map((name) => `${JSON.stringify(name)}: string`).join('; ')} }>`}`)
    .join(';\n');
  const relativeRoute =
    base === '/'
      ? ''
      : `export function relativeRoute(route: RouteId): string {
  return relativeRoutePath(ROUTES[route], ROUTE_BASE, route);
}
`;
  const matchedRoute = Object.values(parameters).every((names) => names.length === 0)
    ? 'return Object.freeze({ id, parameters: Object.freeze(parameters) });'
    : 'return Object.freeze({ id, parameters: Object.freeze(parameters) }) as RouteMatch;';
  return `// Generated by @shop/navigationgen. Do not edit.
${relativeRouteImport}
export const ROUTE_CATALOG_HASH = '${hash}' as const;
export const ROOT_PATH = '/' as const;
export const ROUTE_BASE = ${JSON.stringify(base)} as const;
export const ROUTES = ${JSON.stringify(entries)} as const;
export type RouteId = keyof typeof ROUTES;
export type RoutePath = (typeof ROUTES)[RouteId];
export interface RouteParameterMap { ${parameterTypes} }
export type RouteParameters<R extends RouteId> = RouteParameterMap[R];
type RouteArguments<R extends RouteId> = keyof RouteParameters<R> extends never ? readonly [parameters?: never] : readonly [parameters: RouteParameters<R>];
export const ROUTE_PARAMETERS = Object.freeze(${JSON.stringify(parameters)}) as Readonly<Record<RouteId, readonly string[]>>;
export const ROUTE_REQUIREMENTS = Object.freeze(${JSON.stringify(requirements)}) as Readonly<Record<RouteId, readonly string[]>>;
export const ROUTE_FEATURES = Object.freeze(${JSON.stringify(features)}) as Readonly<Record<RouteId, string>>;
export const ROUTE_GROUPS = Object.freeze(${JSON.stringify(groups)}) as Readonly<Record<RouteId, string | null>>;
export const ROUTE_DEFAULTS = Object.freeze(${JSON.stringify(defaults)}) as Readonly<Record<RouteId, boolean>>;
export type RouteMatch = { [R in RouteId]: Readonly<{ id: R; parameters: RouteParameters<R> }> }[RouteId];
export function fillRouteTemplate(template: string, parameters: Readonly<Record<string, string>>): string {
  const expected = new Set([...template.matchAll(/:([A-Za-z][A-Za-z0-9]*)/g)].map((match) => match[1]));
  for (const name of Object.keys(parameters)) if (!expected.has(name)) throw new Error(\`ROUTE_PARAMETER_UNKNOWN:\${name}\`);
  return template.replace(/:([A-Za-z][A-Za-z0-9]*)/g, (_, name: string) => {
    const value = parameters[name];
    if (typeof value !== 'string' || value.length === 0 || value.length > 255 || hasControlCharacter(value)) throw new Error(\`ROUTE_PARAMETER_INVALID:\${name}\`);
    return encodeURIComponent(value);
  });
}
export function routePath<R extends RouteId>(route: R, ...arguments_: RouteArguments<R>): string {
  return fillRouteTemplate(ROUTES[route], arguments_[0] ?? {});
}
export function resolveRoutePath(route: RouteId, parameters: Readonly<Record<string, string>>): string { return fillRouteTemplate(ROUTES[route], parameters); }
export function matchRoutePath(pathname: string): RouteMatch | undefined {
  if (!pathname.startsWith('/') || pathname.includes('?') || pathname.includes('#') || hasControlCharacter(pathname)) return undefined;
  const actual = routeSegments(pathname);
  for (const [id, template] of Object.entries(ROUTES) as readonly [RouteId, string][]) {
    const expected = routeSegments(template);
    if (actual.length !== expected.length) continue;
    const parameters: Record<string, string> = {};
    let matches = true;
    for (let index = 0; index < expected.length; index += 1) {
      const pattern = expected.at(index);
      const value = actual.at(index);
      if (pattern === undefined || value === undefined) {
        matches = false;
        continue;
      }
      if (!pattern.startsWith(':')) {
        if (pattern !== value) matches = false;
        continue;
      }
      try {
        const decoded = decodeURIComponent(value);
        if (decoded.length === 0 || decoded.length > 255 || hasControlCharacter(decoded)) matches = false;
        else parameters[pattern.slice(1)] = decoded;
      } catch {
        matches = false;
      }
    }
    if (matches) ${matchedRoute}
  }
  return undefined;
}
function routeSegments(value: string): readonly string[] { return value === '/' ? [] : value.replace(/\\\/$/, '').split('/').slice(1); }
function hasControlCharacter(value: string): boolean { return [...value].some((character) => { const code = character.charCodeAt(0); return code <= 31 || code === 127; }); }
${relativeRoute}
`;
}

function miniappPageBindingSource(routes: readonly RouteDefinition[]): string {
  const entries = Object.fromEntries(routes.map(({ id, feature }) => [id, `/feature/${feature}/page`]));
  const pages = miniappPages(routes).map((page) => `/${page}`);
  const mainPages = miniappMainPages(routes).map((page) => `/${page}`);
  const subpackages = miniappSubpackages(routes);
  return `// Generated by @shop/navigationgen. Do not edit.
import { ROUTE_PARAMETERS, ROUTES, type RouteId, type RouteMatch } from './RouteBinding';

export const MINIAPP_PAGE_BY_ROUTE = Object.freeze(${JSON.stringify(entries)}) as Readonly<Record<RouteId, string>>;
export const MINIAPP_PAGES = Object.freeze(${JSON.stringify(pages)}) as readonly string[];
export const MINIAPP_MAIN_PAGES = Object.freeze(${JSON.stringify(mainPages)}) as readonly string[];
export const MINIAPP_SUBPACKAGES = Object.freeze(${JSON.stringify(subpackages)}) as readonly Readonly<{ root: string; pages: readonly string[] }>[];

export function miniappPagePath(route: RouteId, parameters: Readonly<Record<string, string>> = {}): string {
  const expected = ROUTE_PARAMETERS[route];
  if (Object.keys(parameters).some((name) => !expected.includes(name)) || expected.some((name) => !valid(parameters[name]))) throw new Error('MINIAPP_ROUTE_PARAMETER_INVALID');
  const query = [['route', route], ...expected.map((name) => [name, parameters[name]!] as const)]
    .map(([name, value]) => \`\${encodeURIComponent(name)}=\${encodeURIComponent(value)}\`)
    .join('&');
  return \`\${MINIAPP_PAGE_BY_ROUTE[route]}?\${query}\`;
}

export function readMiniappRoute(options: Readonly<Record<string, string | undefined>>): RouteMatch {
  const route = options.route;
  if (typeof route !== 'string' || !(route in ROUTES)) throw new Error('MINIAPP_ROUTE_INVALID');
  const id = route as RouteId;
  const parameters = Object.fromEntries(ROUTE_PARAMETERS[id].map((name) => [name, options[name]]));
  if (Object.values(parameters).some((value) => !valid(value))) throw new Error('MINIAPP_ROUTE_PARAMETER_INVALID');
  return Object.freeze({ id, parameters: Object.freeze(parameters) }) as RouteMatch;
}

function valid(value: string | undefined): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= 255 && ![...value].some((character) => character.charCodeAt(0) <= 31 || character.charCodeAt(0) === 127);
}
`;
}

function miniappApplicationSource(routes: readonly RouteDefinition[]): string {
  return `${JSON.stringify(
    {
      pages: miniappMainPages(routes),
      subPackages: miniappSubpackages(routes),
      window: { navigationBarTitleText: '智慧翼福利商城', navigationBarBackgroundColor: '#143A8F', navigationBarTextStyle: 'white', backgroundColor: '#F5F7FA', backgroundTextStyle: 'light', enablePullDownRefresh: true },
      style: 'v2',
      lazyCodeLoading: 'requiredComponents',
      sitemapLocation: 'sitemap.json',
    },
    null,
    2
  )}\n`;
}

function miniappMainPages(routes: readonly RouteDefinition[]): readonly string[] {
  const pages = miniappPages(routes).filter((page) => page === 'feature/home/page');
  if (pages.length !== 1) throw new Error('MINIAPP_MAIN_PAGE_INVALID');
  return pages;
}

function miniappSubpackages(routes: readonly RouteDefinition[]): readonly Readonly<{ root: string; pages: readonly string[] }>[] {
  return miniappPages(routes)
    .filter((page) => page !== 'feature/home/page')
    .map((page) => Object.freeze({ root: page.replace(/\/page$/, ''), pages: Object.freeze(['page']) }));
}

function miniappPages(routes: readonly RouteDefinition[]): readonly string[] {
  const ordered = [...routes].sort((left, right) => Number(right.default) - Number(left.default) || left.path.localeCompare(right.path));
  return [...new Set(ordered.map(({ feature }) => `feature/${feature}/page`))];
}

function routeParameters(path: string): readonly string[] {
  return [...path.matchAll(/:([A-Za-z][A-Za-z0-9]*)/g)].map((match) => match[1]!);
}

function routeBase(routes: readonly RouteDefinition[]): string {
  const segments = routes.map(({ path }) => path.split('/').filter(Boolean));
  const length = Math.min(...segments.map((value) => value.length));
  const common: string[] = [];
  for (let index = 0; index < length; index += 1) {
    const value = segments[0]?.[index];
    if (value === undefined || segments.some((candidate) => candidate[index] !== value)) break;
    common.push(value);
  }
  return common.length === 0 ? '/' : `/${common.join('/')}`;
}

function sharedRouteCatalogSource(routes: readonly RouteDefinition[], hash: string): string {
  return `// Generated by @shop/navigationgen. Do not edit.\nexport const ROUTE_CATALOG_HASH = '${hash}' as const;\nexport const ROUTE_CATALOG = Object.freeze(${JSON.stringify(routes, null, 2)}.map((route) => Object.freeze({ ...route, requirements: Object.freeze([...route.requirements]) })));\nexport type RouteDefinition = (typeof ROUTE_CATALOG)[number];\nexport type RouteId = RouteDefinition['id'];\nexport const ROUTE_BY_ID: ReadonlyMap<RouteId, RouteDefinition> = new Map(ROUTE_CATALOG.map((route) => [route.id, route]));\n`;
}

function requiredRoute(routes: ReadonlyMap<string, RouteDefinition>, id: string): RouteDefinition {
  const route = routes.get(id);
  if (route === undefined) throw new Error(`NAVIGATION_ROUTE_UNKNOWN:${id}`);
  return route;
}

function unique(values: readonly string[]): readonly string[] {
  return [...new Set(values)].sort();
}

async function emit(path: string, content: string, check: boolean): Promise<void> {
  if (check) {
    const current = await readFile(path, 'utf8').catch(() => '');
    if (current !== content) throw new Error(`GENERATED_NAVIGATION_DRIFT:${path}`);
    return;
  }
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, content, 'utf8');
}
