import type { ContractJsonValue } from '@shop/contract';
import type { ReadTransactionContext, WriteTransactionContext } from '../../../../foundation/persistence/TransactionContext';

export interface QualificationPolicyRecord extends Record<string, unknown> {
  readonly id: string;
  readonly name: string;
  readonly status: string;
  readonly active_version: number;
  readonly updated_at: string;
  readonly rule: ContractJsonValue | null;
  readonly published_at: string | null;
}

export interface QualificationDecisionRecord {
  readonly policy_id: string;
  readonly policy_version: number;
  readonly decision: 'eligible' | 'ineligible';
}

export interface ManagedQualificationPolicy {
  readonly id: string;
  readonly scope_id: string;
  readonly name: string;
  readonly status: 'published';
  readonly active_version: number;
  readonly created_at: string;
  readonly updated_at: string;
  readonly rule_hash: string;
}

export interface QualificationRepository {
  policies(context: ReadTransactionContext, input: Readonly<{ scope: string; sort: string | null; id: string | null; fetch: number }>): Promise<readonly QualificationPolicyRecord[]>;
  preview(context: WriteTransactionContext, scope: string, member: string, resource: string): Promise<readonly QualificationDecisionRecord[]>;
  savePolicy(context: WriteTransactionContext, input: Readonly<{ id: string; scope: string; name: string; rule: ContractJsonValue; hash: string; actor: string }>): Promise<ManagedQualificationPolicy>;
}
