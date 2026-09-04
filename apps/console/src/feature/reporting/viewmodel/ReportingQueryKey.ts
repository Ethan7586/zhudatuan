import { NAVIGATION_CATALOG_HASH } from '../../../generated/NavigationBinding';
import type { ConsoleContext } from '../../../entity/session/ConsoleSession';
import type { ReportFilter } from '../model/Report';

export const reportingKey = (context: ConsoleContext, filter: ReportFilter) =>
  Object.freeze(['console', context.scope.kind, context.scope.id, context.session.accessVersion, NAVIGATION_CATALOG_HASH, 'reporting', filter.view, filter.period, filter.application ?? null, filter.cursor ?? null] as const);

export const exportKey = (context: ConsoleContext, id: string) => Object.freeze(['console', context.scope.kind, context.scope.id, context.session.accessVersion, NAVIGATION_CATALOG_HASH, 'reporting', 'export', id] as const);
