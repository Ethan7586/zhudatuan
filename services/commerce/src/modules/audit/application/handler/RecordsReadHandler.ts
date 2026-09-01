import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { HandlerContext } from '../../../../foundation/application/HandlerContext';
import type { OperationHandler, OperationReply } from '../../../../foundation/application/OperationHandler';
import { encodeCursor, queryPage } from '../../../../foundation/interface/Validation';
import { requireSession } from '../../../../foundation/security/OperationSecurityContext';
import type { AuditHistoryRepository } from '../port/AuditHistoryRepository';

export class RecordsReadHandler implements OperationHandler<'audit.records.read', 'read'> {
  readonly operation = 'audit.records.read' as const;
  readonly mode = 'read' as const;

  constructor(private readonly history: AuditHistoryRepository) {}

  async execute(input: OperationInputFor<'audit.records.read'>, context: HandlerContext<'audit.records.read'>): Promise<OperationReply<OperationOutputFor<'audit.records.read'>>> {
    const access = requireSession(context.security);
    const page = queryPage(input, 200);
    const rows = await this.history.records(context.transaction, access.scope.id, { sort: page.sort, id: page.id }, page.fetch);
    const more = rows.length > page.limit;
    const items = more ? rows.slice(0, page.limit) : rows;
    const last = items.at(-1);
    const next = more && last ? encodeCursor({ sort: last.occurred_at, id: last.id }) : null;
    return { status: 200, body: { items: [...items], count: items.length, next } as OperationOutputFor<'audit.records.read'> };
  }
}
