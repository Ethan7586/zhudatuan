import type { ReadTransactionContext } from '../../../foundation/persistence/TransactionContext';
import { publicPort } from '../../../bootstrap/ModuleRegistry';

export interface QualificationProfile {
  readonly status: string;
  readonly version: number;
  readonly city: string | null;
}
export interface QualificationPolicy {
  readonly id: string;
  readonly policyVersion: number;
  readonly hash: string;
  readonly rule: Record<string, unknown>;
  readonly resources: readonly Readonly<{
    kind: string;
    id: string;
  }>[];
  readonly subjects: readonly Readonly<Record<string, unknown>>[];
  readonly period: string | null;
  readonly quantity: number | null;
  readonly amountMinor: number | null;
}
export interface CheckoutQualificationPort {
  profile(context: ReadTransactionContext, member: string, scope: string): Promise<QualificationProfile | null>;
  policies(context: ReadTransactionContext, scope: string): Promise<readonly QualificationPolicy[]>;
  tags(context: ReadTransactionContext, member: string): Promise<readonly string[]>;
}
export const CHECKOUT_QUALIFICATION_PORT = publicPort<CheckoutQualificationPort>('qualification', 'checkout');
