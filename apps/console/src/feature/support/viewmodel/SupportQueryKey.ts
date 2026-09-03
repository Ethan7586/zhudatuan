import { NAVIGATION_CATALOG_HASH } from '../../../generated/NavigationBinding';
import type { ConsoleContext } from '../../../entity/session/ConsoleSession';
import { filterSignature, type TicketFilter } from '../model/TicketFilter';

const base = (context: ConsoleContext) => ['console', context.scope.kind, context.scope.id, context.session.accessVersion, NAVIGATION_CATALOG_HASH] as const;

export const queueKey = (context: ConsoleContext, filter: TicketFilter) => [...base(context), 'support.queue', filterSignature(filter)] as const;
export const queuePrefix = (context: ConsoleContext) => [...base(context), 'support.queue'] as const;
export const directTicketKey = (context: ConsoleContext, ticket: string) => [...base(context), 'support.ticket', ticket] as const;
export const conversationKey = (context: ConsoleContext, ticket: string) => [...base(context), 'support.conversation', ticket] as const;
export const agentsKey = (context: ConsoleContext) => [...base(context), 'support.agents'] as const;
export const historyKey = (context: ConsoleContext, ticket: string) => [...base(context), 'support.history', ticket] as const;
export const settingKey = (context: ConsoleContext, setting: string) => [...base(context), 'support.settings', setting] as const;
