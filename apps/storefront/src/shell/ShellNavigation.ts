import type { ExperienceDocument } from '@shop/contract';
import type { SessionState } from '../entity/session/viewmodel/SessionContext';
import { experiencePath } from '../entity/session/model/PublishedExperience';
import { ROUTES } from '../generated/RouteBinding';

type NavigationNode = SessionState['navigation'][number];

export interface ShellLink {
  readonly id: string;
  readonly label: string;
  readonly path: string;
}

export type ShellQuickAction = ShellLink & Readonly<{ kind: 'support' | 'notification' | 'cart' | 'account' }>;
export type ShellMobileAction = ShellLink & Readonly<{ kind: 'home' | 'catalog' | 'benefit' | 'orders' | 'account' }>;

const QUICK_ACTIONS = Object.freeze([
  Object.freeze({ kind: 'support' as const, path: ROUTES.storesupport }),
  Object.freeze({ kind: 'notification' as const, path: ROUTES.storenotifications }),
  Object.freeze({ kind: 'cart' as const, path: ROUTES.storecart }),
  Object.freeze({ kind: 'account' as const, path: ROUTES.storeprofile }),
]);

const MOBILE_ACTIONS = Object.freeze([
  Object.freeze({ kind: 'home' as const, path: ROUTES.storehome, label: '首页' }),
  Object.freeze({ kind: 'catalog' as const, path: ROUTES.storecatalog, label: '分类' }),
  Object.freeze({ kind: 'benefit' as const, path: ROUTES.storebenefits, label: '福利' }),
  Object.freeze({ kind: 'orders' as const, path: ROUTES.storeorders, label: '订单' }),
  Object.freeze({ kind: 'account' as const, path: ROUTES.storeprofile, label: '我的' }),
]);

export function shellNavigation(nodes: SessionState['navigation'], experience: ExperienceDocument | null) {
  const available = flatten(nodes).filter(({ experience: item }) => !item.disabled && safePath(item.route));
  const primary = available
    .filter(({ experience: item }) => item.placement === 'primary' && !item.route.includes(':') && !QUICK_ACTIONS.some(({ path }) => path === item.route))
    .sort((left, right) => left.order - right.order)
    .map(toLink);
  const primaryPaths = new Set(primary.map(({ path }) => path));
  const visiblePaths = new Set(primaryPaths);
  const published = (experience?.navigation ?? []).flatMap((item): readonly ShellLink[] => {
    const page = experience?.pages.find(({ id }) => id === item.page);
    const path = experiencePath(page?.path ?? '');
    if (!path || visiblePaths.has(path)) return [];
    visiblePaths.add(path);
    return [Object.freeze({ id: item.id, label: item.label, path })];
  });
  const quick = QUICK_ACTIONS.flatMap((spec): readonly ShellQuickAction[] => {
    const node = available.find(({ experience: item }) => item.route === spec.path);
    return node ? [Object.freeze({ id: node.key, label: node.title, path: spec.path, kind: spec.kind })] : [];
  });
  const mobile = MOBILE_ACTIONS.flatMap((spec): readonly ShellMobileAction[] => {
    const node = available.find(({ experience: item }) => item.route === spec.path);
    return node ? [Object.freeze({ id: node.key, label: spec.label, path: spec.path, kind: spec.kind })] : [];
  });
  return Object.freeze({
    primary: Object.freeze(primary),
    published: Object.freeze(published),
    quick: Object.freeze(quick),
    mobile: Object.freeze(mobile),
    search: available.some(({ experience: item }) => item.route === ROUTES.storecatalog),
    quickView: available.some(({ experience: item }) => item.route === ROUTES.storeproduct),
  });
}

export function shellPathActive(pathname: string, path: string): boolean {
  if (path === ROUTES.storehome) return pathname === path;
  return pathname === path || pathname.startsWith(`${path}/`);
}

function flatten(nodes: readonly NavigationNode[]): readonly NavigationNode[] {
  return nodes.flatMap((node) => [node, ...flatten(node.children)]);
}

function toLink(node: NavigationNode): ShellLink {
  return Object.freeze({ id: node.key, label: node.title, path: node.experience.route });
}

function safePath(path: string): boolean {
  return path.startsWith('/') && !path.startsWith('//') && !/[\\\r\n?#]/.test(path);
}
