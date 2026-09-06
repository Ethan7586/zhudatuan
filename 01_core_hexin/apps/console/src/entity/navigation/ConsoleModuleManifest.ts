import type { OperationId } from '@shop/contract';
import type { LazyRouteFunction, NonIndexRouteObject } from 'react-router';
import type { ConsoleScope } from '../session/ConsoleSession';

export const consoleModuleIds = [
  'cockpit',
  'control',
  'applications',
  'products',
  'orders',
  'referral',
  'channels',
  'vouchers',
  'finance',
  'storefront-members',
  'access',
  'qualification',
  'reports',
  'support',
] as const;

export type ConsoleModuleId = (typeof consoleModuleIds)[number];
export type ModuleStatus = 'enabled' | 'disabled' | 'hidden';
export type ConsoleModuleStatus = ModuleStatus;
export type NavigationPlacement = 'main' | 'bottom' | 'none';
export type NavigationGroupId = 'overview' | 'commerce' | 'finance-analysis' | 'organization';
export type NavigationIconName =
  | 'trend'
  | 'control'
  | 'building'
  | 'products'
  | 'orders'
  | 'channel'
  | 'voucher'
  | 'finance'
  | 'members'
  | 'system'
  | 'support';

interface NavigationConfigBase {
  readonly order: number;
  readonly label: string;
  readonly labelByScopeKind?: Partial<Record<ConsoleScope['kind'], string>>;
  readonly scopeKinds?: readonly ConsoleScope['kind'][];
  readonly preferredScopeKind?: ConsoleScope['kind'];
}

export type NavigationConfig = NavigationConfigBase & (
  | Readonly<{ placement: 'main' | 'bottom'; group: NavigationGroupId; icon: NavigationIconName }>
  | Readonly<{ placement: 'none'; group: null; icon?: never }>
);

export type ConsoleRouteKind = 'entry' | 'child' | 'detail' | 'technical' | 'redirect';

export interface RoutePresentation {
  readonly title: string;
  readonly summary: string;
  readonly byScopeKind?: Partial<Record<ConsoleScope['kind'], Readonly<{
    readonly title?: string;
    readonly summary?: string;
  }>>>;
}

export interface ConsoleRoutePermission {
  readonly operations: readonly OperationId[];
  readonly blocker?: string;
}

interface ConsoleModuleRouteBase<TModuleId extends ConsoleModuleId> {
  readonly id: `${TModuleId}.${string}`;
  readonly path: string;
  readonly presentation: RoutePresentation;
}

export interface ConsoleModuleLazyRoute<TModuleId extends ConsoleModuleId>
  extends ConsoleModuleRouteBase<TModuleId>, ConsoleRoutePermission {
  readonly kind: Exclude<ConsoleRouteKind, 'redirect'>;
  readonly lazy: LazyRouteFunction<NonIndexRouteObject>;
  readonly redirectTo?: never;
}

export interface ConsoleModuleRedirectRoute<TModuleId extends ConsoleModuleId>
  extends ConsoleModuleRouteBase<TModuleId> {
  readonly kind: 'redirect';
  readonly redirectTo: string;
  readonly operations: readonly [];
}

export type ConsoleModuleRoute<TModuleId extends ConsoleModuleId> =
  | ConsoleModuleLazyRoute<TModuleId>
  | ConsoleModuleRedirectRoute<TModuleId>;

export interface ConsoleModuleManifest<Id extends ConsoleModuleId = ConsoleModuleId> {
  readonly id: Id;
  readonly status: ModuleStatus;
  readonly navigation: NavigationConfig;
  readonly routes: readonly ConsoleModuleRoute<Id>[];
}

export interface ConsoleRouteHandle<Id extends ConsoleModuleId = ConsoleModuleId> extends ConsoleRoutePermission {
  readonly moduleId: Id;
  readonly routeId: `${Id}.${string}`;
  readonly kind: ConsoleRouteKind;
  readonly presentation: RoutePresentation;
}

export function defineConsoleModuleManifest<
  const Id extends ConsoleModuleId,
  const Manifest extends ConsoleModuleManifest<Id>,
>(manifest: Manifest): Manifest {
  return manifest;
}

export function isConsoleModuleId(value: string): value is ConsoleModuleId {
  return (consoleModuleIds as readonly string[]).includes(value);
}
