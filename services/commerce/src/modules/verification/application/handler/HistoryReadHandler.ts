import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { HandlerContext } from '../../../../pipeline/HandlerContext';
import type { OperationHandler, OperationReply } from '../../../../pipeline/OperationHandler';
import { keysetPage, queryPage } from '../../../../pipeline/Validation';
import { requireSession } from '../../../../platform/security/OperationSecurityContext';
import type { AttemptRepository } from '../port/AttemptRepository';

export class HistoryReadHandler implements OperationHandler<'verification.history.read', 'read'> {
  readonly operation = 'verification.history.read' as const;
  readonly mode = 'read' as const;
  constructor(private readonly attempts: AttemptRepository) {}
  async execute(input: OperationInputFor<'verification.history.read'>, context: HandlerContext<'verification.history.read'>): Promise<OperationReply<OperationOutputFor<'verification.history.read'>>> {
    const page = queryPage(input, 200);
    const rows = await this.attempts.history(context.transaction, requireSession(context.security).scope.id, page);
    return { status: 200, body: keysetPage(rows, page, 'attempted_at') as OperationOutputFor<'verification.history.read'> };
  }
}
