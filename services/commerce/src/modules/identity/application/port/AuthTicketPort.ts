import type { ReadTransactionContext, WriteTransactionContext } from '../../../../foundation/persistence/TransactionContext';

import type { AuthTransaction } from '../../domain/model/AuthTransaction';
import type { SignedReturnTarget } from './ReturnTargetPort';

export interface AuthTicketPort {
  issue(context: WriteTransactionContext, session: string, target: 'console' | 'storefront', transaction: AuthTransaction): Promise<Readonly<{ ticket: string; state: string }>>;
  issueBound(context: WriteTransactionContext, session: string, target: 'console' | 'storefront', binding: AuthTicketBinding): Promise<Readonly<{ ticket: string }>>;
  consume(
    context: WriteTransactionContext,
    value: unknown,
    currentSessionTokens: readonly string[],
    nextSessionToken: string
  ): Promise<Readonly<{ returnTarget: SignedReturnTarget; sessionExpiresAt: Date; target: 'console' | 'storefront' }>>;
}
export interface AuthTicketBinding {
  readonly stateHash: string;
  readonly nonceHash: string;
  readonly challenge: string;
}
