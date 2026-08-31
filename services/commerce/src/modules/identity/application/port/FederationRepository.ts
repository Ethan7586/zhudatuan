import type { OperationDatabase } from '../../../../foundation/application/ModuleOperations';
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
  create(database: OperationDatabase, value: CreateFederation): Promise<FederationTransaction>;
  redirected(database: OperationDatabase, transaction: FederationTransaction): Promise<FederationTransaction>;
  callback(database: OperationDatabase, provider: string, statehash: Buffer): Promise<FederationCallbackRecord>;
  advance(database: OperationDatabase, transaction: FederationTransaction, state: 'linkrequired' | 'rejected' | 'expired'): Promise<FederationTransaction>;
  verified(database: OperationDatabase, transaction: FederationTransaction, subject: FederatedSubject, subjecthash: Buffer): Promise<FederationResolution>;
  bindDirectory(database: OperationDatabase, input: Readonly<{ provider: string; principal: string; membership: string; subjecthash: Buffer; ciphertext: string; keyversion: string }>): Promise<void>;
  preauthorize(
    database: OperationDatabase,
    transaction: FederationTransaction,
    principal: string,
    memberships: FederationResolution['memberships'],
    browserhash: Buffer,
    devicehash: Buffer,
    assurance: number,
    authorization: AuthTicketBinding
  ): Promise<Readonly<{ token: string }>>;
  version(database: OperationDatabase, transaction: string): Promise<number>;
  complete(database: OperationDatabase, transaction: string, expected: number): Promise<void>;
}
export interface FederationCompletionPort {
  version(database: OperationDatabase, transaction: string): Promise<number>;
  complete(database: OperationDatabase, transaction: string, expected: number): Promise<void>;
}
