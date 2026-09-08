import type { WriteTransactionContext } from '../../../../platform/database/TransactionContext';

export interface NewAssurance {
  readonly principal: string;
  readonly method: string;
  readonly level: 1 | 2 | 3;
  readonly evidenceHash: string;
  readonly expiresIn: '10minutes' | '15minutes' | '365days';
}

export interface AssuranceRepository {
  record(context: WriteTransactionContext, value: NewAssurance): Promise<void>;
  expire(context: WriteTransactionContext, principal: string, method: string): Promise<void>;
}
