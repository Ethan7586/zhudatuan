import type { CipherEnvelope } from '../../../../foundation/application/KmsPort';
import type { ReadTransactionContext, WriteTransactionContext } from '../../../../foundation/persistence/TransactionContext';
import type { ContactKind } from '../../domain/model/Contact';
import type { CustomerKind, CustomerState } from '../../domain/model/Customer';

export interface CustomerContactProjection {
  readonly id: string;
  readonly kind: ContactKind;
  readonly nameMasked: string;
  readonly phoneMasked: string | null;
  readonly emailMasked: string | null;
  readonly configured: true;
  readonly version: number;
}

export interface CustomerAgreementProjection {
  readonly id: string;
  readonly contractRef: string;
  readonly contractHash: string;
  readonly capabilities: readonly string[];
  readonly status: 'draft' | 'active' | 'expired' | 'terminated';
  readonly effectiveAt: string;
  readonly expiresAt: string;
  readonly version: number;
}

export interface CustomerProjection {
  readonly id: string;
  readonly scopeId: string;
  readonly identifierMasked: string;
  readonly name: string;
  readonly kind: CustomerKind;
  readonly status: CustomerState;
  readonly version: number;
  readonly contacts: readonly CustomerContactProjection[];
  readonly agreement: CustomerAgreementProjection | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface ProtectedContact {
  readonly id: string;
  readonly kind: ContactKind;
  readonly name: CipherEnvelope;
  readonly phone: CipherEnvelope | null;
  readonly email: CipherEnvelope | null;
  readonly nameMasked: string;
  readonly phoneMasked: string | null;
  readonly emailMasked: string | null;
}

export interface PreparedAgreement {
  readonly id: string;
  readonly contractRef: string;
  readonly contractHash: string;
  readonly capabilities: readonly string[];
  readonly status: 'draft' | 'active' | 'expired';
  readonly effectiveAt: string;
  readonly expiresAt: string;
}

export interface CreateCustomerCommand {
  readonly id: string;
  readonly tenant: string;
  readonly scope: string;
  readonly identifier: CipherEnvelope;
  readonly identifierMasked: string;
  readonly name: string;
  readonly kind: CustomerKind;
  readonly actor: string;
  readonly contact: ProtectedContact;
  readonly agreement: PreparedAgreement | null;
}

export interface UpdateCustomerCommand {
  readonly id: string;
  readonly scope: string;
  readonly actor: string;
  readonly expectedVersion: number;
  readonly identifier?: CipherEnvelope;
  readonly identifierMasked?: string;
  readonly name?: string;
  readonly kind?: CustomerKind;
  readonly contact?: ProtectedContact;
  readonly agreement?: PreparedAgreement;
}

export interface CustomerLock {
  readonly id: string;
  readonly name: string;
  readonly kind: CustomerKind;
  readonly status: CustomerState;
  readonly version: number;
  readonly agreementEffective: boolean;
}

export type CustomerWriteResult = CustomerProjection | 'identifierconflict' | 'notfound' | 'versionconflict';

export interface CustomerRepository {
  list(context: ReadTransactionContext, input: Readonly<{ scope: string; q: string | null; kind: CustomerKind | null; status: CustomerState | null; sort: string | null; id: string | null; fetch: number }>): Promise<readonly CustomerProjection[]>;
  get(context: ReadTransactionContext, scope: string, id: string): Promise<CustomerProjection | null>;
  create(context: WriteTransactionContext, command: CreateCustomerCommand): Promise<CustomerProjection | 'identifierconflict'>;
  update(context: WriteTransactionContext, command: UpdateCustomerCommand): Promise<CustomerWriteResult>;
  lock(context: WriteTransactionContext, scope: string, id: string): Promise<CustomerLock | null>;
  setState(context: WriteTransactionContext, input: Readonly<{ scope: string; id: string; current: CustomerState; target: CustomerState; actor: string; expectedVersion: number }>): Promise<CustomerProjection | null>;
  options(context: ReadTransactionContext, input: Readonly<{ scope: string; q: string | null; limit: number }>): Promise<readonly Readonly<{ id: string; name: string; kind: CustomerKind; agreementExpiresAt: string; version: number }>[]>;
  approved(context: ReadTransactionContext, customer: string, scope: string): Promise<Readonly<{ id: string; scope: string; name: string; kind: CustomerKind; agreementVersion: number; agreementExpiresAt: string }> | null>;
}
