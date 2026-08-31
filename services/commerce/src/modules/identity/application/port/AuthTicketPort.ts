import type { OperationDatabase } from '../../../../foundation/application/ModuleOperations';
import type { AuthTransaction } from '../../domain/model/AuthTransaction';
import type { SignedReturnTarget } from './ReturnTargetPort';

export interface AuthTicketPort {
  issue(database: OperationDatabase, session: string, target: 'console' | 'storefront', transaction: AuthTransaction): Promise<Readonly<{ ticket: string; state: string }>>;
  issueBound(database: OperationDatabase, session: string, target: 'console' | 'storefront', binding: AuthTicketBinding): Promise<Readonly<{ ticket: string }>>;
  consume(database: OperationDatabase, value: unknown, currentSessionTokens: readonly string[], nextSessionToken: string): Promise<Readonly<{ returnTarget: SignedReturnTarget; sessionExpiresAt: Date; target: 'console' | 'storefront' }>>;
}
export interface AuthTicketBinding {
  readonly stateHash: string;
  readonly nonceHash: string;
  readonly challenge: string;
}
