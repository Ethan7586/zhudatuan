import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { parseDocument } from 'yaml';

import { report } from './report.mjs';

const root = resolve(import.meta.dirname, '../..');
const violations = [];
const surfaces = Object.freeze(['auth', 'console', 'storefront', 'miniapp', 'store', 'supplier']);
const navigation = yaml(join(root, 'config/navigation.yml'), 'NAVIGATION_YAML_INVALID');
const clients = yaml(join(root, 'config/clients.yml'), 'CLIENT_YAML_INVALID');
const operations = yaml(join(root, 'packages/contract/definitions/operations.yml'), 'OPERATION_YAML_INVALID');
const routes = array(navigation?.routes, 'config/navigation.yml', 'NAVIGATION_ROUTES_INVALID');
const nodes = array(navigation?.nodes, 'config/navigation.yml', 'NAVIGATION_NODES_INVALID');
const clientEntries = array(clients?.clients, 'config/clients.yml', 'CLIENT_CATALOG_INVALID');
const operationEntries = array(operations?.operations, 'packages/contract/definitions/operations.yml', 'OPERATION_CATALOG_INVALID');
const preservedNodeIds = Object.freeze([
  'platformcontrol',
  'platformcatalog',
  'platformvoucher',
  'distributioncontrol',
  'groupdashboard',
  'groupcontrol',
  'groupapplication',
  'groupproduct',
  'grouporder',
  'groupreferral',
  'groupvoucher',
  'groupchannel',
  'groupfinance',
  'groupreporting',
  'groupsupport',
  'groupsettings',
  'malldashboard',
  'mallcontrol',
  'malldesign',
  'mallproduct',
  'mallorder',
  'mallvoucher',
  'mallchannel',
  'mallfinance',
  'mallreferral',
  'mallreporting',
  'mallsupport',
  'mallsettings',
  'platformchannel',
  'groupadmin',
  'groupmemberdata',
  'groupinvitation',
  'grouppartner',
  'groupqualification',
  'groupmessage',
  'grouprisk',
  'groupprovider',
  'groupdirectory',
  'malladmin',
  'mallmemberdata',
  'mallinvitation',
  'mallpartner',
  'mallqualification',
  'mallmessage',
  'mallrisk',
  'mallprovider',
  'malldirectory',
  'storehome',
  'storecatalog',
  'storeproduct',
  'storecart',
  'storecheckout',
  'storepayment',
  'storeorders',
  'storeorder',
  'storeaftersale',
  'storevouchers',
  'storebenefits',
  'storeprofile',
  'storesecurity',
  'storesupport',
  'storesupportcase',
  'storenotifications',
]);

if (clientEntries.map(({ id }) => id).join(',') !== surfaces.join(',')) violation('NAVIGATION_SURFACE_CATALOG_DRIFT', 'config/clients.yml', `expected ${surfaces.join(',')}`);

const routeById = uniqueMap(routes, 'id', 'ROUTE_ID_DUPLICATE', 'config/navigation.yml');
const nodeById = uniqueMap(nodes, 'id', 'NAVIGATION_ID_DUPLICATE', 'config/navigation.yml');
const operationById = uniqueMap(operationEntries, 'id', 'NAVIGATION_OPERATION_ID_DUPLICATE', 'packages/contract/definitions/operations.yml');
const pathKeys = new Set();
for (const route of routes) {
  const key = `${route.surface}:${route.path}`;
  if (pathKeys.has(key)) violation('ROUTE_PATH_DUPLICATE', route.id, key);
  pathKeys.add(key);
}

for (const surface of surfaces) {
  const surfaceRoutes = routes.filter((route) => route.surface === surface);
  if (surfaceRoutes.length === 0) violation('ROUTE_SURFACE_EMPTY', 'config/navigation.yml', surface);
  const defaults = surfaceRoutes.filter((route) => route.default === true || (route.default === undefined && route.path === '/'));
  if (defaults.length !== 1) violation('ROUTE_DEFAULT_INVALID', `surface:${surface}`, String(defaults.length));
  const client = clientEntries.find(({ id }) => id === surface);
  if (!client || typeof client.path !== 'string' || typeof client.sourceRoot !== 'string') continue;
  generated(`${client.path}/${client.sourceRoot}/generated/RouteBinding.ts`, 'ROUTE_CATALOG_HASH');
  generated(`${client.path}/${client.sourceRoot}/generated/NavigationBinding.ts`, 'NAVIGATION_CATALOG_HASH');
}

const titleKeys = new Set();
for (const node of nodes) {
  const route = routeById.get(node.routeid);
  const operation = operationById.get(node.entry);
  if (!route) violation('NAVIGATION_ROUTE_UNKNOWN', node.id, String(node.routeid));
  else if (route.surface !== node.surface) violation('NAVIGATION_ROUTE_SURFACE_INVALID', node.id, `${node.surface}:${route.surface}`);
  if (!operation) violation('NAVIGATION_ENTRY_UNKNOWN', node.id, String(node.entry));
  else {
    if (!arrayValue(operation.targets).includes(node.surface)) violation('NAVIGATION_ENTRY_SURFACE_DENIED', node.id, `${node.entry}:${node.surface}`);
    if (!scopeAllowed(operation, node)) violation('NAVIGATION_ENTRY_SCOPE_DENIED', node.id, `${node.entry}:${node.scope}`);
    if (operation.lifecycle !== 'active') violation('NAVIGATION_ENTRY_INACTIVE', node.id, String(operation.lifecycle));
  }
  for (const legacy of ['permissions', 'capabilities', 'requirements']) if (legacy in node) violation('NAVIGATION_DUPLICATE_POLICY_SOURCE', node.id, legacy);
  if (typeof node.title !== 'string' || !/\p{Script=Han}/u.test(node.title) || node.title.length > 80) violation('NAVIGATION_TITLE_INVALID', node.id, String(node.title));
  if (!['primary', 'secondary', 'contextual'].includes(node.placement)) violation('NAVIGATION_PLACEMENT_INVALID', node.id, String(node.placement));
  const titleKey = `${node.surface}:${node.scope}:${node.parent ?? 'root'}:${node.title}`;
  if (titleKeys.has(titleKey)) violation('NAVIGATION_TITLE_AMBIGUOUS', node.id, titleKey);
  titleKeys.add(titleKey);
  if (node.parent !== null) {
    const parent = nodeById.get(node.parent);
    if (!parent) violation('NAVIGATION_PARENT_MISSING', node.id, String(node.parent));
    else if (parent.surface !== node.surface || parent.scope !== node.scope) violation('NAVIGATION_PARENT_BOUNDARY_INVALID', node.id, String(node.parent));
    cycle(node, nodeById);
  }
}

for (const id of preservedNodeIds) if (!nodeById.has(id)) violation('NAVIGATION_BASELINE_NODE_MISSING', 'config/navigation.yml', id);

const expectedPrimary = Object.freeze({
  platform: ['platformcontrol', 'platformcatalog', 'platformvoucher', 'platformchannel', 'platformsettings'],
  distributor: ['distributioncontrol', 'distributionreferral', 'distributionchannel', 'distributionsettings'],
  enterprise: ['groupdashboard', 'groupapplication', 'groupproduct', 'grouporder', 'groupvoucher', 'groupfinance', 'groupreporting', 'groupsettings'],
  mall: ['malldashboard', 'malldesign', 'mallproduct', 'mallorder', 'mallvoucher', 'mallfinance', 'mallreporting', 'mallsettings'],
});
for (const [scope, expected] of Object.entries(expectedPrimary)) {
  const actual = nodes
    .filter((node) => node.surface === 'console' && node.scope === scope && node.parent === null && node.placement === 'primary')
    .sort((left, right) => left.order - right.order || left.id.localeCompare(right.id))
    .map(({ id }) => id);
  if (actual.length > 8) violation('NAVIGATION_PRIMARY_OVERLOAD', `scope:${scope}`, String(actual.length));
  if ([...actual].sort().join(',') !== [...expected].sort().join(',')) violation('NAVIGATION_PRIMARY_INFORMATION_ARCHITECTURE_DRIFT', `scope:${scope}`, `expected=${expected.join(',')} actual=${actual.join(',')}`);
}

const referencedRoutes = new Set(nodes.map(({ routeid }) => routeid));
for (const route of routes.filter(({ surface }) => surface !== 'auth')) {
  if (!referencedRoutes.has(route.id)) violation('ROUTE_ORPHANED', route.id, route.path);
}

exactGroups(
  routes.filter(({ surface, path }) => surface === 'console' && path.includes('/finance')),
  ['funds', 'difference', 'settlement', 'withdrawal', 'invoice', 'governance'],
  'FINANCE_GROUP'
);
exactGroups(
  routes.filter(({ surface, path }) => surface === 'console' && path.includes('/settings')),
  ['organization', 'resources', 'connections', 'security', 'system'],
  'SETTINGS_GROUP'
);

for (const id of [
  'consoleproducts',
  'consoleorders',
  'consolefinance',
  'consolefinancegovernance',
  'consoleapprovals',
  'consoletasks',
  'storehome',
  'miniapphome',
  'storetasks',
  'storeorderswork',
  'storefulfillment',
  'storeverification',
  'suppliertasks',
  'suppliercatalog',
  'supplierinventory',
  'supplierorders',
  'suppliershipments',
  'supplierstatements',
  'supplierconnections',
]) {
  if (!routeById.has(id)) violation('CORE_ROUTE_MISSING', 'config/navigation.yml', id);
}

auditConsoleRegistry();
auditClientVisibility();
report('navigation', violations);

function yaml(path, code) {
  try {
    const document = parseDocument(readFileSync(path, 'utf8'), { merge: true, uniqueKeys: true });
    for (const error of document.errors) violation(code, path.slice(root.length + 1), error.message.replaceAll('\n', ' '));
    return document.errors.length === 0 ? document.toJS({ mapAsMap: false }) : undefined;
  } catch (error) {
    violation(code, path.slice(root.length + 1), error instanceof Error ? error.message : String(error));
    return undefined;
  }
}

function array(value, location, code) {
  if (Array.isArray(value)) return value;
  violation(code, location, 'array required');
  return [];
}

function arrayValue(value) {
  return Array.isArray(value) ? value : [];
}

function uniqueMap(values, field, code, location) {
  const result = new Map();
  for (const value of values) {
    const key = value?.[field];
    if (typeof key !== 'string') {
      violation(code, location, `${field} missing`);
      continue;
    }
    if (result.has(key)) violation(code, location, key);
    result.set(key, value);
  }
  return result;
}

function generated(relative, marker) {
  const path = join(root, relative);
  if (!existsSync(path)) return violation('NAVIGATION_GENERATED_FILE_MISSING', relative, marker);
  if (!readFileSync(path, 'utf8').includes(marker)) violation('NAVIGATION_GENERATED_MARKER_MISSING', relative, marker);
}

function scopeAllowed(operation, node) {
  const kinds = arrayValue(operation.scopeKinds);
  return kinds.includes(node.scope) || ((node.surface === 'storefront' || node.surface === 'miniapp') && node.scope === 'mall' && (kinds.includes('owner') || kinds.includes('self')));
}

function cycle(node, nodes) {
  const visited = new Set();
  let current = node;
  while (current?.parent !== null) {
    if (visited.has(current.id)) return violation('NAVIGATION_CYCLE', node.id, current.id);
    visited.add(current.id);
    current = nodes.get(current.parent);
    if (!current) return;
  }
}

function exactGroups(groupedRoutes, expected, code) {
  const groups = [...new Set(groupedRoutes.map(({ group }) => group).filter((group) => typeof group === 'string'))].sort();
  const required = [...expected].sort();
  if (groups.join(',') !== required.join(',')) violation(`${code}_CATALOG_INVALID`, 'config/navigation.yml', `expected=${required.join(',')} actual=${groups.join(',')}`);
  for (const route of groupedRoutes) if (typeof route.group !== 'string') violation(`${code}_ROUTE_UNGROUPED`, route.id, route.path);
}

function auditConsoleRegistry() {
  const routerFile = join(root, 'apps/console/src/route/Router.tsx');
  const registryFile = join(root, 'apps/console/src/app/RouteRegistry.ts');
  const router = readFileSync(routerFile, 'utf8');
  const registry = readFileSync(registryFile, 'utf8');
  if (!router.includes('path: ROUTE_BASE') || !router.includes("from '../generated/RouteBinding'")) violation('CONSOLE_SCOPE_ROUTE_MISSING', 'apps/console/src/route/Router.tsx', 'generated scope root');
  if (!router.includes('registry.routes()')) violation('CONSOLE_REGISTRY_ROUTES_BYPASSED', 'apps/console/src/route/Router.tsx', 'route registry');
  for (const match of registry.matchAll(/from '([^']+\/Manifest)'/g)) if (!resolveModule(dirname(registryFile), match[1])) violation('CONSOLE_MANIFEST_MODULE_MISSING', match[1], 'workspace manifest');
  if (/workstations|ResourceBoard|features\/workstation/.test(router)) violation('CONSOLE_RETIRED_ROUTE_REGISTRY', 'apps/console/src/route/Router.tsx', 'hard-cut semantic router required');
}

function auditClientVisibility() {
  const checks = Object.freeze([
    ['apps/storefront/src/entity/session/viewmodel/SessionViewModel.ts', /NAVIGATION_IDS|navigationids\.includes|navigationids\.filter/],
    ['apps/store/src/app/StoreApp.tsx', /NAVIGATION_IDS|navigationids\.includes|navigationids\.filter/],
    ['apps/supplier/src/app/SupplierApp.tsx', /NAVIGATION_IDS|navigationids\.includes|navigationids\.filter/],
    ['apps/miniapp/miniprogram/runtime/Navigation.ts', /PRIMARY_NAVIGATION|NAVIGATION_IDS|navigationids\.includes|navigationids\.filter/],
  ]);
  for (const [relative, pattern] of checks) {
    const value = readFileSync(join(root, relative), 'utf8');
    if (pattern.test(value)) violation('CLIENT_NAVIGATION_VISIBILITY_DUPLICATED', relative, String(pattern));
  }
}

function resolveModule(directory, specifier) {
  for (const suffix of ['.tsx', '.ts', '/index.tsx', '/index.ts']) {
    const candidate = resolve(directory, `${specifier}${suffix}`);
    if (existsSync(candidate)) return candidate;
  }
  return undefined;
}

function violation(code, location, detail) {
  violations.push({ code, location, detail });
}
