import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { ExecutionContext } from '../../../../foundation/application/HandlerContext';
import type { OperationReply } from '../../../../foundation/application/OperationHandler';
import type { ReadTransactionContext, WriteTransactionContext } from '../../../../foundation/persistence/TransactionContext';

export interface ProgramRepository {
  readPrograms(transaction: ReadTransactionContext, input: OperationInputFor<'voucher.programs.read'>, context: ExecutionContext<'voucher.programs.read'>): Promise<OperationReply<OperationOutputFor<'voucher.programs.read'>>>;
  manageProgram(transaction: WriteTransactionContext, input: OperationInputFor<'voucher.programs.manage'>, context: ExecutionContext<'voucher.programs.manage'>): Promise<OperationReply<OperationOutputFor<'voucher.programs.manage'>>>;
}
