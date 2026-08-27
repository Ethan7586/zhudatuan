import { createFetchQualificationCenterRead } from '@shop/sdk/qualification';
import type { ConsoleContext } from '../../entity/session/ConsoleSession';
import { consoleRequest } from '../../shared/api/Client';
import { appConfig } from '../../shared/config/AppConfig';
import { QualificationPageSchema } from './QualificationSchema';

const centerRead = createFetchQualificationCenterRead(appConfig.apiBaseUrl);

export const qualificationKey = (context: ConsoleContext, cursor?: string) => Object.freeze([
  'console', context.scope.kind, context.scope.id, context.session.accessVersion, 'qualification.center.read', cursor ?? null, 50,
] as const);
export async function readQualifications(context: ConsoleContext, cursor: string | undefined, signal: AbortSignal) {
  return QualificationPageSchema.parse(await centerRead({ query: { limit: 50,
    ...(cursor === undefined ? {} : { cursor }) } }, consoleRequest(context.scope, signal, context.session.accessVersion)));
}
