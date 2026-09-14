import { createFetchAccessCenterRead } from '@shop/sdk/access';
import type { ConsoleContext } from '../../entity/session/ConsoleSession';
import { consumeDocumentPrefetch } from '../../shared/api/DocumentPrefetch';
import { consoleRequest } from '../../shared/api/Client';
import { appConfig } from '../../shared/config/AppConfig';
import { AccessPageSchema } from './AccessSchema';

const centerRead = createFetchAccessCenterRead(appConfig.apiBaseUrl);

export const ACCESS_QUERY_STALE_TIME_MS = 30_000;

export const accessKey = (context: ConsoleContext, cursor?: string) => Object.freeze([
  'console', context.scope.kind, context.scope.id, context.session.accessVersion, 'access.center.read', cursor ?? null, 500,
] as const);
export async function readAccess(context: ConsoleContext, cursor: string | undefined, signal: AbortSignal) {
  const prefetched = await takeDocumentAccessPrefetch(context, cursor, signal);
  if (prefetched !== undefined) return prefetched;
  return AccessPageSchema.parse(await centerRead({ query: { limit: 500,
    ...(cursor === undefined ? {} : { cursor }) } }, consoleRequest(context.scope, signal, context.session.accessVersion)));
}

async function takeDocumentAccessPrefetch(context: ConsoleContext, cursor: string | undefined, signal: AbortSignal) {
  if (typeof window === 'undefined') return undefined;
  const slot = window.__consoleAccessPrefetch;
  delete window.__consoleAccessPrefetch;
  const value = await consumeDocumentPrefetch(slot, signal);
  const matches = value?.scopeKind === context.scope.kind
    && value.scopeId === context.scope.id
    && value.accessVersion === context.session.accessVersion
    && value.cursor === cursor;
  if (!matches) return undefined;
  const parsed = AccessPageSchema.safeParse(value.value);
  return parsed.success ? parsed.data : undefined;
}
