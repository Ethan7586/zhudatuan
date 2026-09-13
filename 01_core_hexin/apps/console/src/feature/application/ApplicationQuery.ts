import { createFetchExperienceApplicationsRead } from '@shop/sdk/experience';
import type { ConsoleContext } from '../../entity/session/ConsoleSession';
import { consoleRequest } from '../../shared/api/Client';
import { appConfig } from '../../shared/config/AppConfig';
import { ApplicationPageSchema } from './ApplicationSchema';

const applicationsRead = createFetchExperienceApplicationsRead(appConfig.apiBaseUrl);

export const applicationRootKey = (context: ConsoleContext) => Object.freeze(['console', context.scope.kind, context.scope.id, context.session.accessVersion, 'experience.applications.read'] as const);

export const applicationKey = (context: ConsoleContext, cursor?: string) => Object.freeze([...applicationRootKey(context), cursor ?? null, 50] as const);

export async function readApplications(context: ConsoleContext, cursor: string | undefined, signal: AbortSignal) {
  const prefetched = await takeDocumentApplicationPrefetch(context, cursor, signal);
  if (prefetched !== undefined) return prefetched;
  const value = await applicationsRead({ query: { limit: 50, ...(cursor === undefined ? {} : { cursor }) } }, consoleRequest(context.scope, signal, context.session.accessVersion));
  return ApplicationPageSchema.parse(value);
}

async function takeDocumentApplicationPrefetch(context: ConsoleContext, cursor: string | undefined, signal: AbortSignal) {
  if (typeof window === 'undefined') return undefined;
  const slot = window.__consoleApplicationPrefetch;
  delete window.__consoleApplicationPrefetch;
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
      && value.accessVersion === context.session.accessVersion
      && value.cursor === cursor;
    if (!matches) return undefined;
    const parsed = ApplicationPageSchema.safeParse(value.value);
    return parsed.success ? parsed.data : undefined;
  } finally {
    signal.removeEventListener('abort', abort);
  }
}
