import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { describe, it } from 'node:test';
import { generateNavigation } from './NavigationGenerator';
import type { NavigationDocument, NavigationNode, RouteDefinition } from './NavigationSchema';
import { validateNavigation, type OperationReference } from './NavigationValidator';

describe('navigation generator contract', () => {
  it('keeps every generated artifact synchronized with the six-surface source', async () => {
    const result = await generateNavigation(resolve(import.meta.dirname, '../../..'), true);
    assert.ok(result.routes >= 88);
    assert.equal(result.nodes, 146);
    assert.match(result.hash, /^[a-f0-9]{64}$/);
  });

  it('accepts a target, scope, route and operation closed graph', () => {
    const result = validateNavigation(fixture(), operations(), capacity);
    assert.equal(result.routes.length, 6);
    assert.equal(result.nodes.length, 5);
  });

  it('rejects a missing surface default', () => {
    const document = mutableFixture();
    document.routes[1]!.default = false;
    assert.throws(() => validateNavigation(document, operations(), capacity), /ROUTE_DEFAULT_MISSING:console/);
  });

  it('rejects an entry that is not published to its surface', () => {
    const catalog = mutableOperations();
    catalog[4]!.targets = ['console'];
    assert.throws(() => validateNavigation(fixture(), catalog, capacity), /NAVIGATION_ENTRY_SURFACE_DENIED:suppliernode/);
  });

  it('rejects a route with no node or navigable parent', () => {
    const document = mutableFixture();
    document.routes.push(route('orphan', 'console', '/orphan', false));
    assert.throws(() => validateNavigation(document, operations(), capacity), /ROUTE_ORPHANED:orphan/);
  });

  it('rejects navigation documents beyond configured capacity', () => {
    assert.throws(() => validateNavigation(fixture(), operations(), { maximumRoutes: 5, maximumNodes: 200 }), /NAVIGATION_ROUTE_CAPACITY_EXCEEDED/);
    assert.throws(() => validateNavigation(fixture(), operations(), { maximumRoutes: 200, maximumNodes: 4 }), /NAVIGATION_NODE_CAPACITY_EXCEEDED/);
  });

  it('rejects duplicate keys, cycles and non-Chinese product labels', () => {
    const duplicate = mutableFixture();
    duplicate.nodes.push({ ...duplicate.nodes[0]! });
    assert.throws(() => validateNavigation(duplicate, operations(), capacity), /NAVIGATION_ID_DUPLICATE:consolenode/);

    const cyclic = mutableFixture();
    cyclic.nodes[0]!.parent = cyclic.nodes[0]!.id;
    assert.throws(() => validateNavigation(cyclic, operations(), capacity), /NAVIGATION_CYCLE:consolenode/);

    const untranslated = mutableFixture();
    untranslated.nodes[0]!.title = 'Console home';
    assert.throws(() => validateNavigation(untranslated, operations(), capacity), /NAVIGATION_TITLE_INVALID:consolenode/);
  });
});

const capacity = Object.freeze({ maximumRoutes: 200, maximumNodes: 200 });

function fixture(): NavigationDocument {
  return Object.freeze({
    version: 2,
    owner: 'product',
    routes: Object.freeze([
      route('authroute', 'auth', '/', true),
      route('consoleroute', 'console', '/scopes/:scopeKind/:scopeId/home', true),
      route('storefrontroute', 'storefront', '/', true),
      route('miniapproute', 'miniapp', '/', true),
      route('storeroute', 'store', '/scopes/:scopeKind/:scopeId/tasks', true),
      route('supplierroute', 'supplier', '/scopes/:scopeKind/:scopeId/tasks', true),
    ]),
    nodes: Object.freeze([
      node('consolenode', 'console', 'enterprise', 'consoleroute', 'navigation.console.read'),
      node('storefrontnode', 'storefront', 'mall', 'storefrontroute', 'navigation.storefront.read'),
      node('miniappnode', 'miniapp', 'mall', 'miniapproute', 'navigation.miniapp.read'),
      node('storenode', 'store', 'store', 'storeroute', 'navigation.store.read'),
      node('suppliernode', 'supplier', 'supplier', 'supplierroute', 'navigation.supplier.read'),
    ]),
  });
}

function operations(): readonly OperationReference[] {
  return Object.freeze([
    operation('navigation.console.read', 'console', 'enterprise'),
    operation('navigation.storefront.read', 'storefront', 'mall'),
    operation('navigation.miniapp.read', 'miniapp', 'mall'),
    operation('navigation.store.read', 'store', 'store'),
    operation('navigation.supplier.read', 'supplier', 'supplier'),
  ]);
}

function route(id: string, surface: RouteDefinition['surface'], path: string, isDefault: boolean): RouteDefinition {
  return Object.freeze({ id, surface, path, feature: 'home', group: null, default: isDefault, requirements: Object.freeze(['MVPPLATFORM']) });
}

function node(id: string, surface: NavigationNode['surface'], scope: NavigationNode['scope'], routeid: string, entry: string): NavigationNode {
  return Object.freeze({ id, surface, scope, parent: null, title: '测试导航', icon: 'home', routeid, order: 10, entry, placement: 'primary', empty: 'hide' });
}

function operation(id: string, target: string, scope: string): OperationReference {
  return Object.freeze({ id, owner: 'navigation', lifecycle: 'active', permission: null, capability: id, requirements: Object.freeze(['MVPPLATFORM']), targets: Object.freeze([target]), scopeKinds: Object.freeze([scope]) });
}

function mutableFixture(): MutableDocument {
  return structuredClone(fixture()) as unknown as MutableDocument;
}

function mutableOperations(): MutableOperation[] {
  return structuredClone(operations()) as MutableOperation[];
}

type Mutable<T> = { -readonly [TKey in keyof T]: T[TKey] };
type MutableDocument = { version: 2; owner: 'product'; routes: Mutable<RouteDefinition>[]; nodes: Mutable<NavigationNode>[] };
type MutableOperation = Omit<OperationReference, 'targets'> & { targets: string[] };
