import type { ConsoleModuleId, ConsoleModuleManifest } from '../entity/navigation/ConsoleModuleManifest';
import { accessModule } from '../feature/access/manifest';
import { applicationsModule } from '../feature/application/manifest';
import { channelsModule } from '../feature/channel/manifest';
import { cockpitModule } from '../feature/cockpit/manifest';
import { controlModule } from '../feature/control/manifest';
import { financeModule } from '../feature/finance/manifest';
import { ordersModule } from '../feature/order/manifest';
import { productsModule } from '../feature/product/manifest';
import { qualificationModule } from '../feature/qualification/manifest';
import { referralModule } from '../feature/referral/manifest';
import { reportsModule } from '../feature/report/manifest';
import { storefrontMembersModule } from '../feature/storefront-member/manifest';
import { supportModule } from '../feature/support/manifest';
import { vouchersModule } from '../feature/voucher/manifest';

export type ConsoleModuleRegistryIssueCode =
  | 'duplicate-module-id'
  | 'duplicate-route-id'
  | 'duplicate-route-path'
  | 'entry-count';

export interface ConsoleModuleRegistryIssue {
  readonly code: ConsoleModuleRegistryIssueCode;
  readonly moduleId: ConsoleModuleId;
  readonly value: string;
}

export interface ConsoleModuleRegistry<Modules extends readonly ConsoleModuleManifest[] = readonly ConsoleModuleManifest[]> {
  readonly modules: Modules;
  readonly moduleById: ReadonlyMap<ConsoleModuleId, ConsoleModuleManifest>;
}

export function consoleModuleRegistryIssues(
  modules: readonly ConsoleModuleManifest[],
): readonly ConsoleModuleRegistryIssue[] {
  const issues: ConsoleModuleRegistryIssue[] = [];
  const moduleIds = new Set<ConsoleModuleId>();
  const routeIds = new Set<string>();
  const routePaths = new Set<string>();

  for (const module of modules) {
    if (moduleIds.has(module.id)) {
      issues.push({ code: 'duplicate-module-id', moduleId: module.id, value: module.id });
    }
    moduleIds.add(module.id);

    const entryCount = module.routes.filter(({ kind }) => kind === 'entry').length;
    if (entryCount !== 1) {
      issues.push({ code: 'entry-count', moduleId: module.id, value: String(entryCount) });
    }

    for (const route of module.routes) {
      if (routeIds.has(route.id)) {
        issues.push({ code: 'duplicate-route-id', moduleId: module.id, value: route.id });
      }
      routeIds.add(route.id);

      if (routePaths.has(route.path)) {
        issues.push({ code: 'duplicate-route-path', moduleId: module.id, value: route.path });
      }
      routePaths.add(route.path);
    }
  }

  return issues;
}

export function defineConsoleModuleRegistry<const Modules extends readonly ConsoleModuleManifest[]>(
  modules: Modules,
): ConsoleModuleRegistry<Modules> {
  const issues = consoleModuleRegistryIssues(modules);
  if (issues.length > 0) {
    const detail = issues.map(({ code, moduleId, value }) => `${code}:${moduleId}:${value}`).join(', ');
    throw new Error(`Invalid Console module registry: ${detail}`);
  }

  const moduleById = new Map<ConsoleModuleId, ConsoleModuleManifest>();
  for (const module of modules) moduleById.set(module.id, module);
  return Object.freeze({ modules, moduleById });
}

export const consoleModuleRegistry = defineConsoleModuleRegistry([
  cockpitModule,
  controlModule,
  applicationsModule,
  productsModule,
  ordersModule,
  referralModule,
  channelsModule,
  vouchersModule,
  financeModule,
  storefrontMembersModule,
  accessModule,
  qualificationModule,
  reportsModule,
  supportModule,
] as const);
export const consoleModules = consoleModuleRegistry.modules;
export const consoleModuleById = consoleModuleRegistry.moduleById;

export function selectConsoleModuleByEntryPath(
  entryPath: string,
  modules: readonly ConsoleModuleManifest[] = consoleModules,
): ConsoleModuleManifest | undefined {
  return modules.find((module) => module.routes.some((route) => route.kind === 'entry' && route.path === entryPath));
}
