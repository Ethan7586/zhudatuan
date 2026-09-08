import { publicPort } from '../../../composition/ModuleRegistry';
import type { ReadTransactionContext } from '../../../platform/database/TransactionContext';

export interface RiskDecisionInput {
  readonly actor: string;
  readonly operation: string;
  readonly resource: string;
  readonly scope: string;
  readonly scopes: readonly string[];
  readonly trace: string;
  readonly amountMinor: number;
  readonly signals: Readonly<Record<string, number>>;
}

export interface RiskDecisionAssessment {
  readonly outcome: 'allow' | 'challenge' | 'review' | 'deny';
  readonly safeReason: string;
  readonly decision: string | null;
}

/** Shared by Catalog, Payment, Voucher, Finance and Checkout without exposing Risk cases or tables. */
export interface RiskDecisionPort {
  evaluate(context: ReadTransactionContext, input: RiskDecisionInput): Promise<RiskDecisionAssessment>;
}

export const RISK_DECISION_PORT = publicPort<RiskDecisionPort>('risk', 'decision');
