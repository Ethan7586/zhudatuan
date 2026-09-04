import type { ContractJsonValue } from '@shop/contract';
import type { ReadTransactionContext, WriteTransactionContext } from '../../../../foundation/persistence/TransactionContext';

export interface QualificationPolicyRecord extends Record<string, unknown> {
  readonly id: string;
  readonly name: string;
  readonly status: 'draft' | 'published' | 'retired';
  readonly active_version: number | null;
  readonly updated_at: string;
  readonly rule: ContractJsonValue | null;
  readonly rule_hash: string | null;
  readonly published_at: string | null;
  readonly versions: readonly Readonly<{ version: number; rule_hash: string; published_at: string | null; created_by: string }>[];
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
  readonly action: 'publish' | 'rollback';
  readonly source_version: number | null;
}

export interface QualificationPolicyImpactBasis {
  readonly currentName: string | null;
  readonly currentVersion: number | null;
  readonly currentRule: ContractJsonValue | null;
  readonly currentHash: string | null;
  readonly sourceVersion: number | null;
  readonly sourceRule: ContractJsonValue | null;
  readonly sourceHash: string | null;
  readonly potentialProfiles: number;
  readonly resourceCount: number;
  readonly subjectCount: number;
  readonly limitCount: number;
}

export interface QualificationRepository {
  policies(context: ReadTransactionContext, input: Readonly<{ scope: string; sort: string | null; id: string | null; fetch: number }>): Promise<readonly QualificationPolicyRecord[]>;
  previewDecision(context: WriteTransactionContext, scope: string, member: string, resource: string): Promise<readonly QualificationDecisionRecord[]>;
  previewPolicy(context: WriteTransactionContext, input: Readonly<{ scope: string; id: string; sourceVersion: number | null }>): Promise<QualificationPolicyImpactBasis | null>;
  publishPolicy(context: WriteTransactionContext, input: Readonly<{ id: string; scope: string; name: string; rule: ContractJsonValue; hash: string; actor: string; expectedVersion: number }>): Promise<ManagedQualificationPolicy | null>;
  rollbackPolicy(context: WriteTransactionContext, input: Readonly<{ id: string; scope: string; version: number; actor: string; expectedVersion: number }>): Promise<ManagedQualificationPolicy | null>;
}
