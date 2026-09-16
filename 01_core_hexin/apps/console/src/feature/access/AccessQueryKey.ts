import type { ConsoleContext } from '../../entity/session/ConsoleSession';

export const accessKey = (context: ConsoleContext, cursor?: string) => Object.freeze([
  'console', context.scope.kind, context.scope.id, context.session.accessVersion, 'access.center.read', cursor ?? null, 500,
] as const);
