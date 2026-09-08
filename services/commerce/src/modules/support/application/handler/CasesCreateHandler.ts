import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { CommitContext, FinalizeContext, PrepareContext } from '../../../../pipeline/HandlerContext';
import type { DurableCommit, DurableOperationHandler, OperationReply } from '../../../../pipeline/OperationHandler';
import type { CaseRepository, PreparedSupportOperation } from '../port/SupportRepositories';

type Reply = OperationReply<OperationOutputFor<'support.cases.create'>>;

export class CasesCreateHandler implements DurableOperationHandler<'support.cases.create', PreparedSupportOperation, Reply, 'write'> {
  readonly operation = 'support.cases.create' as const;
  readonly mode = 'write' as const;
  constructor(private readonly cases: CaseRepository) {}
  prepare(input: OperationInputFor<'support.cases.create'>, context: PrepareContext<'support.cases.create'>) {
    return this.cases.prepareCase(input, context);
  }
  async commit(input: OperationInputFor<'support.cases.create'>, prepared: PreparedSupportOperation, context: CommitContext<'support.cases.create'>): Promise<DurableCommit<Reply, OperationOutputFor<'support.cases.create'>>> {
    const response = await this.cases.createCase(context.transaction, input, context, prepared);
    return { checkpoint: response, response };
  }
  finalize(_input: OperationInputFor<'support.cases.create'>, checkpoint: Reply, _context: FinalizeContext<'support.cases.create'>): Promise<Reply> {
    return Promise.resolve(checkpoint);
  }
}
