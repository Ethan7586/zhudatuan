import type { NavigationScopeKind } from '@shop/authz';
import type { OperationTarget } from '@shop/contract';
import { NavigationNode, type NavigationBreadcrumb, type NavigationNodeValue } from '../../domain/model/NavigationNode';
import type { NavigationContext } from '../../domain/model/NavigationContext';
import { VisibilityPolicy } from '../../domain/policy/VisibilityPolicy';
import { sortNavigation } from './NavigationSorter';

export interface CatalogNavigationNode {
  readonly key: string;
  readonly surface: OperationTarget;
  readonly scope: NavigationScopeKind;
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
    placement: 'primary' | 'secondary' | 'contextual';
    empty: 'hide' | 'showdisabled';
  }>;
}

export class NavigationFilter {
  constructor(private readonly visibility = new VisibilityPolicy()) {}

  apply(catalog: readonly CatalogNavigationNode[], context: NavigationContext): readonly NavigationNodeValue[] {
    const candidates = catalog.filter((node) => node.surface === context.target && node.scope === context.scopeKind);
    const children = new Map<string | null, CatalogNavigationNode[]>();
    for (const node of candidates) {
      const siblings = children.get(node.parent) ?? [];
      siblings.push(node);
      children.set(node.parent, siblings);
    }
    const build = (parent: string | null, path: readonly NavigationBreadcrumb[]): readonly NavigationNodeValue[] =>
      sortNavigation(
        (children.get(parent) ?? []).flatMap((node) => {
          const breadcrumbs = Object.freeze([...path, Object.freeze({ key: node.key, title: node.title })]);
          const descendants = build(node.key, breadcrumbs);
          const reason = this.visibility.decide(node, context);
          const visible = reason === 'visible';
          const hasCatalogChildren = (children.get(node.key)?.length ?? 0) > 0;
          if (!visible && descendants.length === 0) return [];
          if (visible && hasCatalogChildren && descendants.length === 0 && node.experience.empty === 'hide') return [];
          const disabled = !visible || (hasCatalogChildren && descendants.length === 0);
          return [
            new NavigationNode({
              key: node.key,
              title: node.title,
              parent: node.parent,
              order: node.order,
              operation: node.operation,
              experience: {
                icon: node.experience.icon,
                routeKey: node.experience.routeKey,
                route: node.experience.route,
                component: node.experience.component,
                placement: node.experience.placement,
                disabled,
                disabledReason: disabled ? disabledReason(reason) : null,
                breadcrumbs,
              },
              children: descendants,
            }),
          ];
        })
      );
    return build(null, Object.freeze([]));
  }
}

function disabledReason(reason: ReturnType<VisibilityPolicy['decide']>): string {
  const labels = Object.freeze({
    membership: '当前身份已停用',
    scope: '当前范围不可用',
    client: '当前客户端不可用',
    permission: '当前身份无此权限',
    capability: '当前范围未启用此能力',
    feature: '当前版本未开放此功能',
    visible: '当前范围暂无可用功能',
  } as const);
  return labels[reason];
}
