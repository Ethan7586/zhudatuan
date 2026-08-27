import { createFetchAccessCenterRead } from '@shop/sdk/access';
import type { ConsoleContext } from '../../entity/session/ConsoleSession';
import { consoleRequest } from '../../shared/api/Client';
import { appConfig } from '../../shared/config/AppConfig';
import { AccessPageSchema } from './AccessSchema';

const centerRead = createFetchAccessCenterRead(appConfig.apiBaseUrl);

export const accessKey = (context: ConsoleContext, cursor?: string) => Object.freeze([
  'console', context.scope.kind, context.scope.id, context.session.accessVersion, 'access.center.read', cursor ?? null, 50,
] as const);
export async function readAccess(context: ConsoleContext, cursor: string | undefined, signal: AbortSignal) {
  return AccessPageSchema.parse(await centerRead({ query: { limit: 50,
    ...(cursor === undefined ? {} : { cursor }) } }, consoleRequest(context.scope, signal, context.session.accessVersion)));
}
