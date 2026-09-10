import { createFetchAuditRecordsRead } from '@shop/sdk/audit';
import { z } from 'zod';
import type { ConsoleContext } from '../../entity/session/ConsoleSession';
import { consoleRequest } from '../../shared/api/Client';
import { appConfig } from '../../shared/config/AppConfig';

const AuditRecordSchema = z.object({
  id: z.string().min(1),
  kind: z.enum(['command', 'access', 'archive']),
  actor_id: z.string().nullable(),
  action: z.string().min(1),
  resource_type: z.string().min(1),
  resource_id: z.string().nullable(),
  occurred_at: z.string().min(1),
}).passthrough();

const AuditPageSchema = z.object({
  items: z.array(AuditRecordSchema),
  count: z.number().int().nonnegative(),
  nextCursor: z.string().min(1).optional(),
}).passthrough();

const recordsRead = createFetchAuditRecordsRead(appConfig.apiBaseUrl);

export type AccessAuditRecord = z.infer<typeof AuditRecordSchema>;

export function accessAuditAvailable(context: ConsoleContext): boolean {
  return context.session.permissions.includes('audit.records.read')
    || context.session.capabilities.includes('audit.records.read');
}

export const accessAuditKey = (context: ConsoleContext) => Object.freeze([
  'console', context.scope.kind, context.scope.id, context.session.accessVersion, 'audit.records.read', 'access-role-history', 200,
] as const);

export async function readAccessAudit(context: ConsoleContext, signal: AbortSignal) {
  const page = AuditPageSchema.parse(await recordsRead(
    { query: { limit: 200 } },
    consoleRequest(context.scope, signal, context.session.accessVersion),
  ));
  return page.items.filter((record) => record.kind === 'command' && record.action.startsWith('access.'));
}
