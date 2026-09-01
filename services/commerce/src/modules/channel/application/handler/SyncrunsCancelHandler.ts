import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { WriteHandlerContext } from '../../../../foundation/application/HandlerContext';
import type { OperationHandler, OperationReply } from '../../../../foundation/application/OperationHandler';
import { requireSession } from '../../../../foundation/security/OperationSecurityContext';
import type { SyncRunRepository } from '../port/SyncRunRepository';

export class SyncRunsCancelHandler implements OperationHandler<'channel.syncruns.cancel', 'write'> {
  readonly operation = 'channel.syncruns.cancel' as const;
  readonly mode = 'write' as const;
  constructor(private readonly runs: SyncRunRepository) {}
  async execute(input: OperationInputFor<'channel.syncruns.cancel'>, context: WriteHandlerContext<'channel.syncruns.cancel'>): Promise<OperationReply<OperationOutputFor<'channel.syncruns.cancel'>>> {
    const access = requireSession(context.security);
    const result = await this.runs.cancel(context.transaction, input.path.runid, access.scope.id, context.expectedVersion ?? null);
    return { status: 200, body: result as OperationOutputFor<'channel.syncruns.cancel'> };
  }
}
