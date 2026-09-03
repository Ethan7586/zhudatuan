import { NAVIGATION_CATALOG_HASH } from '../../../generated/NavigationBinding';
import type { ConsoleContext } from '../../../entity/session/ConsoleSession';
import type { CockpitFilter } from '../model/Cockpit';

export const cockpitKey = (context: ConsoleContext, filter: CockpitFilter) => Object.freeze([
  'console', context.scope.kind, context.scope.id, context.session.accessVersion, NAVIGATION_CATALOG_HASH,
  'reporting', 'dashboard', filter.period, filter.application ?? null,
] as const);
