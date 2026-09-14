import { createFetchSupportCasesRead, createFetchSupportMessagesRead } from '@shop/sdk/support';
import type { ConsoleContext } from '../../entity/session/ConsoleSession';
import { consumeDocumentPrefetch } from '../../shared/api/DocumentPrefetch';
import { consoleRequest } from '../../shared/api/Client';
import { appConfig } from '../../shared/config/AppConfig';
import { SupportCasePageSchema, SupportMessagePageSchema, type SupportCaseView } from './SupportSchema';

const casesRead = createFetchSupportCasesRead(appConfig.apiBaseUrl);
const messagesRead = createFetchSupportMessagesRead(appConfig.apiBaseUrl);

export const supportCaseKey = (context: ConsoleContext, view: SupportCaseView = 'handling', cursor?: string) => Object.freeze([
  'console', context.scope.kind, context.scope.id, context.session.accessVersion, 'support.cases.read', view, cursor ?? null, 50,
] as const);
export const supportMessageKey = (context: ConsoleContext, caseId: string, cursor?: string) => Object.freeze([
  'console', context.scope.kind, context.scope.id, context.session.accessVersion, 'support.messages.read', caseId, cursor ?? null, 200,
] as const);

export async function readCases(context: ConsoleContext, view: SupportCaseView, cursor: string | undefined, signal: AbortSignal) {
  const prefetched = view === 'handling' && cursor === undefined ? await takeDocumentSupportPrefetch(context, signal) : undefined;
  if (prefetched !== undefined) return prefetched;
  return SupportCasePageSchema.parse(await casesRead({ query: { limit: 50,
    view, ...(cursor === undefined ? {} : { cursor }) } }, consoleRequest(context.scope, signal, context.session.accessVersion)));
}
export async function readMessages(context: ConsoleContext, caseId: string, cursor: string | undefined, signal: AbortSignal) {
  return SupportMessagePageSchema.parse(await messagesRead({ path: { caseid: caseId }, query: { limit: 200,
    ...(cursor === undefined ? {} : { cursor }) } }, consoleRequest(context.scope, signal, context.session.accessVersion)));
}

async function takeDocumentSupportPrefetch(context: ConsoleContext, signal: AbortSignal) {
  if (typeof window === 'undefined') return undefined;
  const slot = window.__consoleSupportPrefetch;
  delete window.__consoleSupportPrefetch;
  const value = await consumeDocumentPrefetch(slot, signal);
  const matches = value?.scopeKind === context.scope.kind
    && value.scopeId === context.scope.id
    && value.accessVersion === context.session.accessVersion;
  if (!matches) return undefined;
  const parsed = SupportCasePageSchema.safeParse(value.value);
  return parsed.success ? parsed.data : undefined;
}
