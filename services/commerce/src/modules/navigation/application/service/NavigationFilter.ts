import { NavigationNode, type NavigationNodeValue } from '../../domain/model/NavigationNode';
import type { NavigationContext } from '../../domain/model/NavigationContext';
import { VisibilityPolicy } from '../../domain/policy/VisibilityPolicy';
import { sortNavigation } from './NavigationSorter';

export interface CatalogNavigationNode {
  readonly id: string;
  readonly surface: string;
  readonly scope: string;
  readonly parent: string | null;
  readonly title: string;
  readonly icon: string;
  readonly route: string;
  readonly component: string;
  readonly order: number;
  readonly entry: string;
  readonly permissions: readonly string[];
  readonly capabilities: readonly string[];
  readonly empty: 'hide' | 'showdisabled';
}

export class NavigationFilter {
  constructor(private readonly visibility = new VisibilityPolicy()) {}

  apply(catalog: readonly CatalogNavigationNode[], context: NavigationContext): readonly NavigationNodeValue[] {
    const candidates = catalog.filter((node) => node.surface === context.target && node.scope === context.scopeKind);
    const allowed = new Map(candidates.filter((node) => this.visibility.allows(node, context)).map((node) => [node.id, node]));
    const children = new Map<string | null, CatalogNavigationNode[]>();
    for (const node of candidates) {
      const siblings = children.get(node.parent) ?? [];
      siblings.push(node);
      children.set(node.parent, siblings);
    }
    const build = (parent: string | null): readonly NavigationNodeValue[] =>
      sortNavigation(
        (children.get(parent) ?? []).flatMap((node) => {
          if (!allowed.has(node.id)) return [];
          const descendants = build(node.id);
          const hasCatalogChildren = (children.get(node.id)?.length ?? 0) > 0;
          if (hasCatalogChildren && descendants.length === 0 && node.empty === 'hide') return [];
          return [
            new NavigationNode({
              id: node.id,
              title: node.title,
              icon: node.icon,
              route: node.route,
              component: node.component,
              order: node.order,
              entry: node.entry,
              disabled: hasCatalogChildren && descendants.length === 0,
              children: descendants,
            }),
          ];
        })
      );
    return build(null);
  }
}
