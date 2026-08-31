import { publicPort } from '../../../bootstrap/ModuleRegistry';
import type { OperationDatabase } from '../../../foundation/application/ModuleOperations';

export interface CheckoutRiskInput {
  readonly actor: string;
  readonly operation: string;
  readonly resource: string;
  readonly scope: string;
  readonly scopes: readonly string[];
  readonly trace: string;
  readonly amountMinor: number;
  readonly signals: Readonly<Record<string, number>>;
}
export interface CheckoutRiskAssessment {
  readonly outcome: 'allow' | 'challenge' | 'review' | 'deny';
  readonly safeReason: string;
  readonly decision: string | null;
}
export interface CheckoutRiskPort {
  assess(database: OperationDatabase, input: CheckoutRiskInput): Promise<CheckoutRiskAssessment>;
}
export const CHECKOUT_RISK_PORT = publicPort<CheckoutRiskPort>('risk', 'checkout');
