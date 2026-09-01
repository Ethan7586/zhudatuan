import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { WriteHandlerContext } from '../../../../foundation/application/HandlerContext';
import type { OperationHandler, OperationReply } from '../../../../foundation/application/OperationHandler';
import { bodyRecord, textField } from '../../../../foundation/interface/Validation';
import { requireSession } from '../../../../foundation/security/OperationSecurityContext';
import type { SyncRunRepository } from '../port/SyncRunRepository';
import type { SyncKind } from '../../domain/model/SyncRun';

const kinds = new Set<SyncKind>(['catalog', 'price', 'stock', 'statement']);

export class SyncRunsStartHandler implements OperationHandler<'channel.syncruns.start', 'write'> {
  readonly operation = 'channel.syncruns.start' as const;
  readonly mode = 'write' as const;
  constructor(private readonly runs: SyncRunRepository) {}
  async execute(input: OperationInputFor<'channel.syncruns.start'>, context: WriteHandlerContext<'channel.syncruns.start'>): Promise<OperationReply<OperationOutputFor<'channel.syncruns.start'>>> {
    const access = requireSession(context.security);
    const body = bodyRecord(input);
    const kind = syncKind(textField(body, 'kind', 64));
    const parameters =
      kind === 'statement'
        ? Object.freeze({ start: date(body.start), end: date(body.end), timezone: required(body.timezone, 'STATEMENT_TIMEZONE_REQUIRED'), partner: required(body.partner, 'STATEMENT_PARTNER_REQUIRED') })
        : Object.freeze({});
    const result = await this.runs.start(context.transaction, { scope: access.scope.id, connection: textField(body, 'connection'), kind, cursor: body.cursor ?? null, parameters });
    return { status: 202, body: result as OperationOutputFor<'channel.syncruns.start'> };
  }
}

function syncKind(value: string): SyncKind {
  if (!kinds.has(value as SyncKind)) throw new Error('SYNC_KIND_INVALID');
  return value as SyncKind;
}
function required(value: unknown, code: string): string {
  if (typeof value !== 'string' || !value.trim()) throw new Error(code);
  return value.trim();
}
function date(value: unknown): string {
  const text = String(value ?? '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) throw new Error('STATEMENT_DATE_INVALID');
  return text;
}
