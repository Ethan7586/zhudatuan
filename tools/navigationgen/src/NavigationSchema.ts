export const NAVIGATION_FIELDS = Object.freeze(['id', 'surface', 'scope', 'parent', 'title', 'icon', 'route', 'component', 'order', 'entry', 'permissions', 'capabilities', 'requirements', 'empty'] as const);

export type NavigationSurface = 'console' | 'storefront';
export type NavigationScope = 'platform' | 'distributor' | 'enterprise' | 'mall';
export type EmptyPolicy = 'hide' | 'showdisabled';

export interface NavigationNode {
  readonly id: string;
  readonly surface: NavigationSurface;
  readonly scope: NavigationScope;
  readonly parent: string | null;
  readonly title: string;
  readonly icon: string;
  readonly route: string;
  readonly component: string;
  readonly order: number;
  readonly entry: string;
  readonly permissions: readonly string[];
  readonly capabilities: readonly string[];
  readonly requirements: readonly string[];
  readonly empty: EmptyPolicy;
}

export interface NavigationDocument {
  readonly version: 1;
  readonly nodes: readonly NavigationNode[];
}

export function parseNavigation(value: unknown): NavigationDocument {
  const root = object(value, 'NAVIGATION_DOCUMENT_INVALID');
  exact(root, ['version', 'nodes'], 'NAVIGATION_DOCUMENT_FIELD_UNKNOWN');
  if (root.version !== 1 || !Array.isArray(root.nodes)) throw new Error('NAVIGATION_DOCUMENT_INVALID');
  const nodes = root.nodes.map((candidate, index) => parseNode(candidate, index));
  return Object.freeze({ version: 1, nodes: Object.freeze(nodes) });
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
  const route = text(record.route, 'route', id);
  if (!route.startsWith('/')) throw new Error(`NAVIGATION_ROUTE_INVALID:${id}`);
  const component = key(record.component, 'component', index);
  const order = record.order;
  if (!Number.isSafeInteger(order) || Number(order) < 0) throw new Error(`NAVIGATION_ORDER_INVALID:${id}`);
  const entry = contractKey(record.entry, 'entry', id);
  const permissions = list(record.permissions, contractKey, 'permissions', id);
  const capabilities = list(record.capabilities, contractKey, 'capabilities', id);
  const requirements = list(record.requirements, requirement, 'requirements', id);
  if (requirements.length === 0) throw new Error(`NAVIGATION_REQUIREMENTS_EMPTY:${id}`);
  const empty = one(record.empty, ['hide', 'showdisabled'] as const, 'empty', id);
  return Object.freeze({ id, surface, scope, parent, title, icon, route, component, order: Number(order), entry, permissions, capabilities, requirements, empty });
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
