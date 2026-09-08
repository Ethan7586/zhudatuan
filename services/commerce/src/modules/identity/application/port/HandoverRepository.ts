import type { QueryPage } from '../../../../pipeline/Validation';
import type { ReadTransactionContext, WriteTransactionContext } from '../../../../platform/database/TransactionContext';

export interface HandoverRecord {
  readonly id: string;
  readonly scopeId: string;
  readonly membershipId: string;
  readonly note: string;
  readonly handedOverAt: Date;
  readonly version: number;
}

export interface HandoverRepository {
  create(
    context: WriteTransactionContext,
    input: Readonly<{
      scope: string;
      principal: string;
      membership: string;
      session: string;
      note: string;
    }>
  ): Promise<HandoverRecord>;
  read(context: ReadTransactionContext, scope: string, page: QueryPage): Promise<readonly HandoverRecord[]>;
}
