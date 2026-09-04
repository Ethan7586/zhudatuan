export type PolicyStatus = 'draft' | 'published' | 'retired';

export interface PolicyVersion {
  readonly version: number;
  readonly ruleHash: string;
  readonly publishedAt: string | null;
  readonly createdBy: string;
}

export interface QualificationPolicy {
  readonly id: string;
  readonly name: string;
  readonly status: PolicyStatus;
  readonly activeVersion: number | null;
  readonly updatedAt: string;
  readonly rule: Readonly<Record<string, ContractJsonValue>> | null;
  readonly ruleHash: string | null;
  readonly publishedAt: string | null;
  readonly versions: readonly PolicyVersion[];
}

export interface QualificationPage {
  readonly items: readonly QualificationPolicy[];
  readonly count: number;
  readonly nextCursor?: string;
}

export interface PolicyImpact {
  readonly action: 'publish' | 'rollback';
  readonly policyId: string;
  readonly currentVersion: number | null;
  readonly nextVersion: number;
  readonly sourceVersion: number | null;
  readonly currentHash: string | null;
  readonly proposedHash: string;
  readonly changedFields: readonly string[];
  readonly potentialProfiles: number;
  readonly resourceCount: number;
  readonly subjectCount: number;
  readonly limitCount: number;
}

export interface QualificationDecision {
  readonly policyId: string;
  readonly policyVersion: number;
  readonly decision: 'eligible' | 'ineligible';
}

export interface PolicyReceipt {
  readonly id: string;
  readonly name: string;
  readonly activeVersion: number;
  readonly ruleHash: string;
  readonly action: 'publish' | 'rollback';
  readonly sourceVersion: number | null;
  readonly updatedAt: string;
}
import type { ContractJsonValue } from '@shop/contract';
