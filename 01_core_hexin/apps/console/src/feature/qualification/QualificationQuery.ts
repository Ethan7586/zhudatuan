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
  const prefetched = cursor === undefined ? await takeDocumentQualificationPrefetch(context, signal) : undefined;
  if (prefetched !== undefined) return prefetched;
  return QualificationPageSchema.parse(await centerRead({ query: { limit: 50,
    ...(cursor === undefined ? {} : { cursor }) } }, consoleRequest(context.scope, signal, context.session.accessVersion)));
}

async function takeDocumentQualificationPrefetch(context: ConsoleContext, signal: AbortSignal) {
  if (typeof window === 'undefined') return undefined;
  const slot = window.__consoleQualificationPrefetch;
  delete window.__consoleQualificationPrefetch;
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
    const parsed = QualificationPageSchema.safeParse(value.value);
    return parsed.success ? parsed.data : undefined;
  } finally {
    signal.removeEventListener('abort', abort);
  }
}
