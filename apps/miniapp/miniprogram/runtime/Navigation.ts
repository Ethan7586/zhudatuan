import { miniappPagePath } from '../generated/PageBinding';
import type { OperationOutputFor } from '@shop/contract';
import { ROUTES, type RouteId } from '../generated/RouteBinding';

type MiniappNavigationNode = NonNullable<OperationOutputFor<'storefront.bootstrap.read'>['navigation']['data']>[number];

export interface MiniappNavigationItem {
  readonly route: RouteId;
  readonly title: string;
  readonly path: string;
  readonly active: boolean;
}

export function miniappNavigation(active: RouteId, nodes: readonly MiniappNavigationNode[]): readonly MiniappNavigationItem[] {
  return Object.freeze(
    flatten(nodes)
      .filter(({ experience }) => experience.placement === 'primary' && !experience.disabled)
      .sort((left, right) => left.order - right.order || left.key.localeCompare(right.key))
      .map((node) => {
        const route = node.experience.routeKey;
        if (!(route in ROUTES)) throw new Error(`MINIAPP_NAVIGATION_ROUTE_UNKNOWN:${route}`);
        const routeId = route as RouteId;
        return Object.freeze({ route: routeId, title: node.title, path: miniappPagePath(routeId), active: routeId === active });
      })
  );
}

export function navigateMiniapp(path: string): void {
  if (!/^\/feature\/[a-z]+\/page\?route=[a-z]+/.test(path)) throw new Error('MINIAPP_NAVIGATION_PATH_INVALID');
  wx.redirectTo({ url: path, fail: () => wx.navigateTo({ url: path }) });
}

function flatten(nodes: readonly MiniappNavigationNode[]): readonly MiniappNavigationNode[] {
  return nodes.flatMap((node) => [node, ...flatten(node.children)]);
}
