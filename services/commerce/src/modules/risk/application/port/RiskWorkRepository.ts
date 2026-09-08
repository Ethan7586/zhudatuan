import type { OperationRisk } from '@shop/contract';
import type { WriteTransactionContext } from '../../../../platform/database/TransactionContext';
import type { RiskActionKind, RiskActionState, RiskActionTarget } from '../../domain/model/RiskAction';
import type { Signal } from '../../domain/model/Signal';

export interface RiskActionRecord {
  readonly id: string;
  readonly decision: string;
  readonly scope: string;
  readonly kind: RiskActionKind;
  readonly target: RiskActionTarget;
  readonly rationale: string;
  readonly approvalRequired: boolean;
  readonly approvalInstance: string | null;
  readonly approvalProof: string | null;
  readonly evidenceHash: string;
  readonly state: RiskActionState;
  readonly version: number;
  readonly requester: string;
  readonly expiresAt: string;
}

export interface DeferredRiskRecord {
  readonly id: string;
  readonly scope: string;
  readonly actor: string;
  readonly operation: string;
  readonly resource: string | null;
  readonly scopes: readonly string[];
  readonly amountMinor: number | null;
  readonly signals: readonly Signal[];
  readonly risk: OperationRisk;
  readonly trace: string;
}

export interface RiskWorkRepository {
  action(context: WriteTransactionContext, id: string): Promise<RiskActionRecord | null>;
  bindApproval(context: WriteTransactionContext, id: string, version: number, instance: string): Promise<boolean>;
  approve(context: WriteTransactionContext, instance: string, id: string, subjectVersion: number, kind: string, proof: string): Promise<string | null>;
  reject(context: WriteTransactionContext, instance: string, id: string, subjectVersion: number, kind: string): Promise<boolean>;
  applied(context: WriteTransactionContext, id: string, version: number): Promise<boolean>;
  assessment(context: WriteTransactionContext, id: string): Promise<DeferredRiskRecord | null>;
  completeAssessment(context: WriteTransactionContext, id: string, succeeded: boolean): Promise<void>;
}
