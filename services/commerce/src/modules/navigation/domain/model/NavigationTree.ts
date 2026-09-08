import { DomainError } from '../../../../platform/error/DomainError';
import { NAVIGATION_CONFIGURATION } from '@shop/config/server';
import type { NavigationScopeKind } from '@shop/authz';
import type { OperationTarget } from '@shop/contract';
import { NavigationNode, type NavigationNodeValue } from './NavigationNode';

export interface NavigationTreeValue {
  readonly scope: Readonly<{ id: string; kind: NavigationScopeKind }>;
  readonly target: OperationTarget;
  readonly version: string;
  readonly etag: string;
  readonly generatedAt: string;
  readonly catalogVersion: string;
  readonly defaultKey: string;
  readonly defaultRoute: string;
  readonly nodes: readonly NavigationNodeValue[];
}

export class NavigationTree implements NavigationTreeValue {
  readonly scope: Readonly<{ id: string; kind: NavigationScopeKind }>;
  readonly target: OperationTarget;
  readonly version: string;
  readonly etag: string;
  readonly generatedAt: string;
  readonly catalogVersion: string;
  readonly defaultKey: string;
  readonly defaultRoute: string;
  readonly nodes: readonly NavigationNodeValue[];

  constructor(value: NavigationTreeValue) {
    validate(value);
    this.scope = Object.freeze({ ...value.scope });
    this.target = value.target;
    this.version = value.version;
    this.etag = value.etag;
    this.generatedAt = value.generatedAt;
    this.catalogVersion = value.catalogVersion;
    this.defaultKey = value.defaultKey;
    this.defaultRoute = value.defaultRoute;
    this.nodes = Object.freeze(value.nodes.map((node) => new NavigationNode(node)));
    Object.freeze(this);
  }

  toValue(): NavigationTreeValue {
    return Object.freeze({
      scope: Object.freeze({ ...this.scope }),
      target: this.target,
      version: this.version,
      etag: this.etag,
      generatedAt: this.generatedAt,
      catalogVersion: this.catalogVersion,
      defaultKey: this.defaultKey,
      defaultRoute: this.defaultRoute,
      nodes: Object.freeze(this.nodes.map((node) => new NavigationNode(node).toValue())),
    });
  }
}

function validate(value: NavigationTreeValue): void {
  const keys = new Set<string>();
  const routes = new Set<string>();
  const visiting = new Set<NavigationNodeValue>();
  let count = 0;
  const visit = (nodes: readonly NavigationNodeValue[], parent: string | null, depth: number, breadcrumbs: readonly string[]): void => {
    if (depth > NAVIGATION_CONFIGURATION.maximumDepth) throw new Error('NAVIGATION_DEPTH_EXCEEDED');
    for (const node of nodes) {
      if (visiting.has(node)) throw new Error('NAVIGATION_CYCLE');
      if (keys.has(node.key)) throw new Error('NAVIGATION_NODE_DUPLICATE');
      if (node.parent !== parent) throw new Error('NAVIGATION_PARENT_INVALID');
      const path = [...breadcrumbs, node.key];
      if (node.experience.breadcrumbs.map(({ key }) => key).join('/') !== path.join('/')) throw new Error('NAVIGATION_BREADCRUMB_PATH_INVALID');
      if (routes.has(node.experience.route)) throw new Error('NAVIGATION_ROUTE_DUPLICATE');
      keys.add(node.key);
      routes.add(node.experience.route);
      count += 1;
      visiting.add(node);
      visit(node.children, node.key, depth + 1, path);
      visiting.delete(node);
    }
  };
  visit(value.nodes, null, 1, []);
  if (count === 0) throw new DomainError('NAVIGATION_EMPTY');
  if (count > NAVIGATION_CONFIGURATION.maximumNodes) throw new Error('NAVIGATION_NODE_LIMIT_EXCEEDED');
  const selected = flatten(value.nodes).find((node) => node.key === value.defaultKey);
  if (!selected || selected.experience.disabled || selected.experience.route !== value.defaultRoute) throw new Error('NAVIGATION_DEFAULT_INVALID');
  if (Buffer.byteLength(JSON.stringify(value)) > NAVIGATION_CONFIGURATION.maximumBytes) throw new Error('NAVIGATION_SIZE_EXCEEDED');
}

function flatten(nodes: readonly NavigationNodeValue[]): readonly NavigationNodeValue[] {
  return nodes.flatMap((node) => [node, ...flatten(node.children)]);
}
