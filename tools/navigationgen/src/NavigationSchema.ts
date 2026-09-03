export const ROUTE_FIELDS = Object.freeze(['id', 'surface', 'path', 'feature', 'requirements'] as const);
export const NAVIGATION_FIELDS = Object.freeze(['id', 'surface', 'scope', 'parent', 'title', 'icon', 'routeid', 'order', 'entry', 'permissions', 'capabilities', 'requirements', 'empty'] as const);

export type NavigationSurface = 'auth' | 'console' | 'storefront';
export type NavigationScope = 'platform' | 'distributor' | 'enterprise' | 'mall' | 'public';
export type EmptyPolicy = 'hide' | 'showdisabled';

export interface RouteDefinition {
  readonly id: string;
  readonly surface: NavigationSurface;
  readonly path: string;
  readonly feature: string;
  readonly requirements: readonly string[];
}

export interface NavigationNode {
  readonly id: string;
  readonly surface: Exclude<NavigationSurface, 'auth'>;
  readonly scope: Exclude<NavigationScope, 'public'>;
  readonly parent: string | null;
  readonly title: string;
  readonly icon: string;
  readonly routeid: string;
  readonly order: number;
  readonly entry: string;
  readonly permissions: readonly string[];
  readonly capabilities: readonly string[];
  readonly requirements: readonly string[];
  readonly empty: EmptyPolicy;
}

export interface NavigationDocument {
  readonly version: 2;
  readonly routes: readonly RouteDefinition[];
  readonly nodes: readonly NavigationNode[];
}

export function parseNavigation(value: unknown): NavigationDocument {
  const root = object(value, 'NAVIGATION_DOCUMENT_INVALID');
  exact(root, ['version', 'routes', 'nodes'], 'NAVIGATION_DOCUMENT_FIELD_UNKNOWN');
  if (root.version !== 2 || !Array.isArray(root.routes) || !Array.isArray(root.nodes)) throw new Error('NAVIGATION_DOCUMENT_INVALID');
  return Object.freeze({ version: 2, routes: Object.freeze(root.routes.map(parseRoute)), nodes: Object.freeze(root.nodes.map(parseNode)) });
}

function parseRoute(value: unknown, index: number): RouteDefinition {
  const record = object(value, `ROUTE_DEFINITION_INVALID:${index}`);
  exact(record, ROUTE_FIELDS, `ROUTE_DEFINITION_FIELD_UNKNOWN:${index}`);
  const id = key(record.id, 'id', index);
  const surface = one(record.surface, ['auth', 'console', 'storefront'] as const, 'surface', id);
  const path = pathValue(record.path, id);
  const feature = key(record.feature, 'feature', id);
  const requirements = list(record.requirements, requirement, 'requirements', id);
  if (requirements.length === 0) throw new Error(`ROUTE_REQUIREMENTS_EMPTY:${id}`);
  return Object.freeze({ id, surface, path, feature, requirements });
}

function parseNode(value: unknown, index: number): NavigationNode {
  const record = object(value, `NAVIGATION_NODE_INVALID:${index}`);
  exact(record, NAVIGATION_FIELDS, `NAVIGATION_NODE_FIELD_UNKNOWN:${index}`);
  const id = key(record.id, 'id', index);
  const surface = one(record.surface, ['console', 'storefront'] as const, 'surface', id);
  const scope = one(record.scope, ['platform', 'distributor', 'enterprise', 'mall'] as const, 'scope', id);
  const parent = record.parent === null ? null : key(record.parent, 'parent', index);
  const title = text(record.title, 'title', id);
  const icon = key(record.icon, 'icon', index);
  const routeid = key(record.routeid, 'routeid', id);
  const order = record.order;
  if (!Number.isSafeInteger(order) || Number(order) < 0) throw new Error(`NAVIGATION_ORDER_INVALID:${id}`);
  const entry = contractKey(record.entry, 'entry', id);
  const permissions = list(record.permissions, contractKey, 'permissions', id);
  const capabilities = list(record.capabilities, contractKey, 'capabilities', id);
  const requirements = list(record.requirements, requirement, 'requirements', id);
  if (requirements.length === 0) throw new Error(`NAVIGATION_REQUIREMENTS_EMPTY:${id}`);
  const empty = one(record.empty, ['hide', 'showdisabled'] as const, 'empty', id);
  return Object.freeze({ id, surface, scope, parent, title, icon, routeid, order: Number(order), entry, permissions, capabilities, requirements, empty });
}

function object(value: unknown, code: string): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new Error(code);
  return value as Record<string, unknown>;
}

function exact(record: Record<string, unknown>, fields: readonly string[], code: string): void {
  const known = new Set(fields);
  for (const field of Object.keys(record)) if (!known.has(field)) throw new Error(`${code}:${field}`);
  for (const field of fields) if (!(field in record)) throw new Error(`NAVIGATION_FIELD_MISSING:${field}`);
}

function key(value: unknown, field: string, owner: string | number): string {
  if (typeof value !== 'string' || !/^[a-z][a-z0-9]*$/.test(value)) throw new Error(`NAVIGATION_KEY_INVALID:${owner}:${field}`);
  return value;
}

function pathValue(value: unknown, owner: string): string {
  const path = text(value, 'path', owner);
  if (!path.startsWith('/') || path.includes('?') || path.includes('#') || path.includes('//')) throw new Error(`ROUTE_PATH_INVALID:${owner}`);
  return path;
}

function contractKey(value: unknown, field: string, owner: string | number): string {
  if (typeof value !== 'string' || !/^[a-z]+(?:\.[a-z]+)+$/.test(value)) throw new Error(`NAVIGATION_CONTRACT_KEY_INVALID:${owner}:${field}`);
  return value;
}

function requirement(value: unknown, field: string, owner: string | number): string {
  if (typeof value !== 'string' || !/^MVP[A-Z]+$/.test(value)) throw new Error(`NAVIGATION_REQUIREMENT_INVALID:${owner}:${field}`);
  return value;
}

function text(value: unknown, field: string, owner: string): string {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`NAVIGATION_TEXT_INVALID:${owner}:${field}`);
  return value;
}

function list(value: unknown, validator: (value: unknown, field: string, owner: string | number) => string, field: string, owner: string): readonly string[] {
  if (!Array.isArray(value)) throw new Error(`NAVIGATION_LIST_INVALID:${owner}:${field}`);
  const result = value.map((item) => validator(item, field, owner));
  if (new Set(result).size !== result.length) throw new Error(`NAVIGATION_LIST_DUPLICATE:${owner}:${field}`);
  return Object.freeze(result);
}

function one<const T extends readonly string[]>(value: unknown, choices: T, field: string, owner: string): T[number] {
  if (typeof value !== 'string' || !choices.includes(value)) throw new Error(`NAVIGATION_ENUM_INVALID:${owner}:${field}`);
  return value as T[number];
}
