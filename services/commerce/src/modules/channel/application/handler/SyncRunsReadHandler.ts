import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { HandlerContext } from '../../../../foundation/application/HandlerContext';
import type { OperationHandler, OperationReply } from '../../../../foundation/application/OperationHandler';
import { keysetPage, queryPage } from '../../../../foundation/interface/Validation';
import { requireSession } from '../../../../foundation/security/OperationSecurityContext';
import type { SyncRunRepository } from '../port/SyncRunRepository';

export class SyncRunsReadHandler implements OperationHandler<'channel.syncruns.read', 'read'> {
  readonly operation = 'channel.syncruns.read' as const;
  readonly mode = 'read' as const;
  constructor(private readonly runs: SyncRunRepository) {}
  async execute(input: OperationInputFor<'channel.syncruns.read'>, context: HandlerContext<'channel.syncruns.read'>): Promise<OperationReply<OperationOutputFor<'channel.syncruns.read'>>> {
    const access = requireSession(context.security);
    const page = queryPage(input);
    const rows = await this.runs.read(context.transaction, access.scope.id, page);
    return { status: 200, body: keysetPage(rows, page, 'cursor_sort') as OperationOutputFor<'channel.syncruns.read'> };
  }
}
