import type { ReadTransactionContext, WriteTransactionContext } from '../../../../foundation/persistence/TransactionContext';

import type { FederatedSubject } from '../../domain/model/FederatedSubject';
import type { FederationTransaction } from '../../domain/model/FederationTransaction';
import type { AuthTicketBinding } from './AuthTicketPort';

export interface CreateFederation {
  readonly provider: string;
  readonly statehash: Buffer;
  readonly noncehash: Buffer;
  readonly challenge: string;
  readonly verifier: string;
  readonly browserhash: Buffer;
  readonly returntargethash: Buffer;
  readonly returntarget: string;
  readonly target: 'console' | 'storefront';
  readonly riskhash: Buffer;
  readonly expiresat: Date;
  readonly authorization: AuthTicketBinding;
  readonly purpose: 'signin' | 'link';
  readonly principal: string | null;
  readonly membership: string | null;
}
export interface FederationResolution {
  readonly principal: string | null;
  readonly memberships: readonly Readonly<{ id: string; name: string; target: 'console' | 'storefront' }>[];
  readonly conflict: boolean;
}
export interface FederationCallbackRecord {
  readonly transaction: FederationTransaction;
  readonly noncehash: Buffer;
  readonly verifierciphertext: string;
  readonly returntarget: string;
  readonly browserhash: Buffer;
  readonly authorization: AuthTicketBinding;
}
export interface FederationRepository {
  create(context: WriteTransactionContext, value: CreateFederation): Promise<FederationTransaction>;
  redirected(context: WriteTransactionContext, transaction: FederationTransaction): Promise<FederationTransaction>;
  pending(context: ReadTransactionContext, provider: string, statehash: Buffer): Promise<FederationCallbackRecord>;
  accept(context: WriteTransactionContext, transaction: FederationTransaction): Promise<FederationTransaction>;
  advance(context: WriteTransactionContext, transaction: FederationTransaction, state: 'linkrequired' | 'rejected' | 'expired'): Promise<FederationTransaction>;
  verified(context: WriteTransactionContext, transaction: FederationTransaction, subject: FederatedSubject, subjecthash: Buffer): Promise<FederationResolution>;
  bindDirectory(context: WriteTransactionContext, input: Readonly<{ provider: string; principal: string; membership: string; subjecthash: Buffer; ciphertext: string; keyversion: string }>): Promise<void>;
  preauthorize(
    context: WriteTransactionContext,
    transaction: FederationTransaction,
    principal: string,
    memberships: FederationResolution['memberships'],
    browserhash: Buffer,
    devicehash: Buffer,
    assurance: number,
    authorization: AuthTicketBinding
  ): Promise<Readonly<{ token: string }>>;
  version(context: ReadTransactionContext, transaction: string): Promise<number>;
  complete(context: WriteTransactionContext, transaction: string, expected: number): Promise<void>;
}
export interface FederationCompletionPort {
  version(context: ReadTransactionContext, transaction: string): Promise<number>;
  complete(context: WriteTransactionContext, transaction: string, expected: number): Promise<void>;
}
