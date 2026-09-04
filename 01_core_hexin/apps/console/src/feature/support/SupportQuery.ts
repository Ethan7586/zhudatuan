import { createFetchSupportCasesRead, createFetchSupportMessagesRead } from '@shop/sdk/support';
import type { ConsoleContext } from '../../entity/session/ConsoleSession';
import { consoleRequest } from '../../shared/api/Client';
import { appConfig } from '../../shared/config/AppConfig';
import { SupportCasePageSchema, SupportMessagePageSchema } from './SupportSchema';

const casesRead = createFetchSupportCasesRead(appConfig.apiBaseUrl);
const messagesRead = createFetchSupportMessagesRead(appConfig.apiBaseUrl);

export const supportCaseKey = (context: ConsoleContext, cursor?: string) => Object.freeze([
  'console', context.scope.kind, context.scope.id, context.session.accessVersion, 'support.cases.read', cursor ?? null, 50,
] as const);
export const supportMessageKey = (context: ConsoleContext, caseId: string, cursor?: string) => Object.freeze([
  'console', context.scope.kind, context.scope.id, context.session.accessVersion, 'support.messages.read', caseId, cursor ?? null, 200,
] as const);

export async function readCases(context: ConsoleContext, cursor: string | undefined, signal: AbortSignal) {
  return SupportCasePageSchema.parse(await casesRead({ query: { limit: 50,
    ...(cursor === undefined ? {} : { cursor }) } }, consoleRequest(context.scope, signal, context.session.accessVersion)));
}
export async function readMessages(context: ConsoleContext, caseId: string, cursor: string | undefined, signal: AbortSignal) {
  return SupportMessagePageSchema.parse(await messagesRead({ path: { caseid: caseId }, query: { limit: 200,
    ...(cursor === undefined ? {} : { cursor }) } }, consoleRequest(context.scope, signal, context.session.accessVersion)));
}
