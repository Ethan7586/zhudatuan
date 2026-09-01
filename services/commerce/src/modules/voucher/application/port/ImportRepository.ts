import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { ExecutionContext } from '../../../../foundation/application/HandlerContext';
import type { OperationReply } from '../../../../foundation/application/OperationHandler';
import type { ReadTransactionContext } from '../../../../foundation/persistence/TransactionContext';

export interface ImportRepository {
  readImport(transaction: ReadTransactionContext, input: OperationInputFor<'voucher.imports.read'>, context: ExecutionContext<'voucher.imports.read'>): Promise<OperationReply<OperationOutputFor<'voucher.imports.read'>>>;
}
