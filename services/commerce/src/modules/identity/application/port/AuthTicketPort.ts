import type { ReadTransactionContext, WriteTransactionContext } from '../../../../foundation/persistence/TransactionContext';

import type { AuthTransaction } from '../../domain/model/AuthTransaction';

export interface AuthTicketPort {
  issue(context: WriteTransactionContext, session: string, target: 'console' | 'storefront' | 'miniapp' | 'store' | 'supplier', transaction: AuthTransaction): Promise<Readonly<{ ticket: string; state: string }>>;
  issueBound(context: WriteTransactionContext, session: string, target: 'console' | 'storefront' | 'miniapp' | 'store' | 'supplier', binding: AuthTicketBinding): Promise<Readonly<{ ticket: string }>>;
  consume(context: WriteTransactionContext, value: unknown, currentSessionTokens: readonly string[], nextSessionToken: string): Promise<Readonly<{ sessionExpiresAt: Date; target: 'console' | 'storefront' | 'miniapp' | 'store' | 'supplier' }>>;
}
export interface AuthTicketBinding {
  readonly stateHash: string;
  readonly nonceHash: string;
  readonly challenge: string;
}
