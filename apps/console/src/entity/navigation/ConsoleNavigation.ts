import type { ConsoleScope } from '../session/ConsoleSession';
import type {
  ConsoleModuleId,
  ConsoleModuleManifest,
  ModuleStatus,
  NavigationGroupId,
  NavigationIconName,
} from './ConsoleModuleManifest';

export interface NavigationItem {
  readonly moduleId: ConsoleModuleId;
  readonly suffix: string;
  readonly label: string;
  readonly icon: NavigationIconName;
  readonly placement: 'main' | 'bottom';
  readonly group: NavigationGroupId;
  readonly order: number;
  readonly status: Exclude<ModuleStatus, 'hidden'>;
  readonly preferredScopeKind?: ConsoleScope['kind'];
}

export function selectConsoleNavigationItems(
  modules: readonly ConsoleModuleManifest[],
  scopeKind: ConsoleScope['kind'],
): readonly NavigationItem[] {
  const items: NavigationItem[] = [];
  for (const module of modules) {
    const navigation = module.navigation;
    if (module.status === 'hidden' || navigation.placement === 'none') continue;
    const entry = module.routes.find(({ kind }) => kind === 'entry');
    if (entry === undefined) continue;
    items.push({
      moduleId: module.id,
      suffix: navigationSuffix(entry.path),
      label: navigation.labelByScopeKind?.[scopeKind] ?? navigation.labelByScopeKind?.enterprise ?? navigation.label,
      icon: navigation.icon,
      placement: navigation.placement,
      group: navigation.group,
      order: navigation.order,
      status: module.status,
      ...(navigation.preferredScopeKind === undefined ? {} : { preferredScopeKind: navigation.preferredScopeKind }),
    });
  }
  return Object.freeze(items.sort(compareNavigationItems));
}

function navigationSuffix(path: string): string {
  return path.replace(/\/:[^/]+\?/g, '');
}

function compareNavigationItems(left: NavigationItem, right: NavigationItem): number {
  const placement = navigationPlacementRank(left.placement) - navigationPlacementRank(right.placement);
  return placement === 0 ? left.order - right.order : placement;
}

function navigationPlacementRank(placement: NavigationItem['placement']): number {
  return placement === 'main' ? 0 : 1;
}
