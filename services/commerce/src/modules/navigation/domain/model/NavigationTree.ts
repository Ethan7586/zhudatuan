import { DomainError } from '../../../../foundation/domain/DomainError';
import { NAVIGATION_CONFIGURATION } from '@shop/config/server';
import type { ConsoleScopeKind } from '@shop/authz';
import type { NavigationNodeValue } from './NavigationNode';

export interface NavigationTreeValue {
  readonly scope: Readonly<{ id: string; kind: ConsoleScopeKind }>;
  readonly target: 'console' | 'storefront';
  readonly version: string;
  readonly etag: string;
  readonly generatedAt: string;
  readonly catalogVersion: string;
  readonly nodes: readonly NavigationNodeValue[];
}

export class NavigationTree implements NavigationTreeValue {
  readonly scope: Readonly<{ id: string; kind: ConsoleScopeKind }>;
  readonly target: 'console' | 'storefront';
  readonly version: string;
  readonly etag: string;
  readonly generatedAt: string;
  readonly catalogVersion: string;
  readonly nodes: readonly NavigationNodeValue[];

  constructor(value: NavigationTreeValue) {
    const ids = new Set<string>();
    let count = 0;
    const visit = (nodes: readonly NavigationNodeValue[], depth: number): void => {
      if (depth > NAVIGATION_CONFIGURATION.maximumDepth) throw new Error('NAVIGATION_DEPTH_EXCEEDED');
      for (const node of nodes) {
        if (ids.has(node.id)) throw new Error('NAVIGATION_NODE_DUPLICATE');
        ids.add(node.id);
        count += 1;
        visit(node.children, depth + 1);
      }
    };
    visit(value.nodes, 1);
    if (count === 0) throw new DomainError('NAVIGATION_EMPTY');
    if (count > NAVIGATION_CONFIGURATION.maximumNodes) throw new Error('NAVIGATION_NODE_LIMIT_EXCEEDED');
    if (Buffer.byteLength(JSON.stringify(value)) > NAVIGATION_CONFIGURATION.maximumBytes) throw new Error('NAVIGATION_SIZE_EXCEEDED');
    this.scope = Object.freeze({ ...value.scope });
    this.target = value.target;
    this.version = value.version;
    this.etag = value.etag;
    this.generatedAt = value.generatedAt;
    this.catalogVersion = value.catalogVersion;
    this.nodes = Object.freeze([...value.nodes]);
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
      nodes: Object.freeze(this.nodes.map(nodeValue)),
    });
  }
}

function nodeValue(node: NavigationNodeValue): NavigationNodeValue {
  return Object.freeze({
    id: node.id,
    title: node.title,
    icon: node.icon,
    route: node.route,
    component: node.component,
    order: node.order,
    entry: node.entry,
    disabled: node.disabled,
    children: Object.freeze(node.children.map(nodeValue)),
  });
}
