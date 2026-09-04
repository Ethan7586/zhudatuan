import type { OperationOutputFor } from '@shop/contract';
import type { QualificationCase } from './Qualification';

export type PolicyStatus = OperationOutputFor<'qualification.center.read'>['items'][number]['status'];
type PolicyPreview = Extract<OperationOutputFor<'qualification.decisions.preview'>, { kind: 'policy' }>['impact'];
type DecisionPreview = Extract<OperationOutputFor<'qualification.decisions.preview'>, { kind: 'decision' }>['decisions'][number];
type PolicyManageOutput = OperationOutputFor<'qualification.policies.manage'>;

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
  readonly cases: readonly QualificationCase[];
  readonly count: number;
  readonly nextCursor?: string;
}

export interface PolicyImpact {
  readonly action: PolicyPreview['action'];
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
  readonly decision: DecisionPreview['decision'];
}

export interface PolicyReceipt {
  readonly id: string;
  readonly name: string;
  readonly activeVersion: number;
  readonly ruleHash: string;
  readonly action: PolicyManageOutput['action'];
  readonly sourceVersion: number | null;
  readonly updatedAt: string;
}
import type { ContractJsonValue } from '@shop/contract';
