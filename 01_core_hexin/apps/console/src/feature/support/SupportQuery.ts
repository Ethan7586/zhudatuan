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
  const prefetched = cursor === undefined ? await takeDocumentSupportPrefetch(context, signal) : undefined;
  if (prefetched !== undefined) return prefetched;
  return SupportCasePageSchema.parse(await casesRead({ query: { limit: 50,
    ...(cursor === undefined ? {} : { cursor }) } }, consoleRequest(context.scope, signal, context.session.accessVersion)));
}
export async function readMessages(context: ConsoleContext, caseId: string, cursor: string | undefined, signal: AbortSignal) {
  return SupportMessagePageSchema.parse(await messagesRead({ path: { caseid: caseId }, query: { limit: 200,
    ...(cursor === undefined ? {} : { cursor }) } }, consoleRequest(context.scope, signal, context.session.accessVersion)));
}

async function takeDocumentSupportPrefetch(context: ConsoleContext, signal: AbortSignal) {
  if (typeof window === 'undefined') return undefined;
  const slot = window.__consoleSupportPrefetch;
  delete window.__consoleSupportPrefetch;
  if (slot === undefined) return undefined;
  if (signal.aborted) {
    window.__consoleAbortDocumentPrefetch?.();
    throw signal.reason ?? new DOMException('The operation was aborted.', 'AbortError');
  }
  let rejectAbort: (cause: unknown) => void = () => undefined;
  const aborted = new Promise<never>((_resolve, reject) => { rejectAbort = reject; });
  const abort = () => {
    window.__consoleAbortDocumentPrefetch?.();
    rejectAbort(signal.reason ?? new DOMException('The operation was aborted.', 'AbortError'));
  };
  signal.addEventListener('abort', abort, { once: true });
  try {
    const value = await Promise.race([slot.promise, aborted]);
    const matches = value?.scopeKind === context.scope.kind
      && value.scopeId === context.scope.id
      && value.accessVersion === context.session.accessVersion;
    if (!matches) return undefined;
    const parsed = SupportCasePageSchema.safeParse(value.value);
    return parsed.success ? parsed.data : undefined;
  } finally {
    signal.removeEventListener('abort', abort);
  }
}
