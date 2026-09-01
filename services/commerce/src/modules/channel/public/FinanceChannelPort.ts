import type { ReadTransactionContext } from '../../../foundation/persistence/TransactionContext';
import { publicPort } from '../../../bootstrap/ModuleRegistry';

export interface FinanceStatement {
  readonly id: string;
  readonly scope: string;
  readonly objectRef: string;
  readonly sha256: string;
  readonly periodStart: string;
  readonly periodEnd: string;
}
export interface FinanceChannelPort {
  statement(context: ReadTransactionContext, id: string, scope: string): Promise<FinanceStatement | null>;
}
export const FINANCE_CHANNEL_PORT = publicPort<FinanceChannelPort>('channel', 'finance');
