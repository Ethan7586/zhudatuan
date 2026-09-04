import type { ContractJsonValue, OperationBodyFor, OperationOutputFor } from '@shop/contract';

type RiskCenterDto = OperationOutputFor<'risk.center.read'>['items'][number];
type ReviewedCaseDto = OperationOutputFor<'risk.cases.review'>;
export type RiskPolicyStatus = NonNullable<RiskCenterDto['status']>;
export type ReplayState = NonNullable<RiskCenterDto['replay_state']>;
export type RiskCaseState = ReviewedCaseDto['state'];
export type RiskOutcome = ReviewedCaseDto['outcome'];

export interface RiskPolicy {
  readonly kind: 'policy';
  readonly id: string;
  readonly version: number;
  readonly name: string;
  readonly status: RiskPolicyStatus;
  readonly activeVersion: number | null;
  readonly baselineVersion: number | null;
  readonly rolloutPercent: number | null;
  readonly ruleHash: string | null;
  readonly rule: Readonly<Record<string, ContractJsonValue>> | null;
  readonly candidateVersion: number | null;
  readonly candidateRollout: number | null;
  readonly candidateHash: string | null;
  readonly candidateRule: Readonly<Record<string, ContractJsonValue>> | null;
  readonly replayState: ReplayState | null;
  readonly sampleCount: number | null;
  readonly changedCount: number | null;
  readonly falsePositiveRate: number | null;
  readonly preview: ContractJsonValue | null;
}

export interface RiskCase {
  readonly kind: 'case';
  readonly id: string;
  readonly version: number;
  readonly decisionId: string;
  readonly outcome: RiskOutcome;
  readonly state: RiskCaseState;
  readonly reason: ReviewedCaseDto['safe_reason'];
  readonly actorId: string | null;
  readonly actorName: string | null;
  readonly actorMobile: string | null;
  readonly score: number;
  readonly evidence: ContractJsonValue | null;
  readonly createdAt: string;
}

export interface RiskPage {
  readonly items: readonly (RiskPolicy | RiskCase)[];
  readonly count: number;
  readonly nextCursor?: string;
}

export type RiskReceipt =
  | Readonly<{ kind: 'policy'; id: string; version: number; state: string; action: 'save' | 'activate' | 'retire'; candidateVersion: number | null; activeVersion: number | null }>
  | Readonly<{ kind: 'case'; id: string; version: number; state: RiskCaseState; action: RiskCaseAction }>;

export type RiskCaseAction = OperationBodyFor<'RiskCasesReviewInput'>['action'];
