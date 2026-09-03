import { NAVIGATION_CATALOG_HASH } from '../../../generated/NavigationBinding';
import type { ConsoleContext } from '../../../entity/session/ConsoleSession';
import type { ChannelView } from '../model/Channel';

export const channelPrefix = (context: ConsoleContext) => Object.freeze(['console', context.scope.kind, context.scope.id, context.session.accessVersion, NAVIGATION_CATALOG_HASH, 'channel'] as const);
export const channelKey = (context: ConsoleContext, view: ChannelView, cursor?: string) => Object.freeze([...channelPrefix(context), view, cursor ?? null, 50] as const);
