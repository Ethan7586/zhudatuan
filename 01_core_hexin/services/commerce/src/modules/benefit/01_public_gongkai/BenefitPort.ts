import type { OperationDatabase } from '../../../foundation/application/ModuleOperations';

export interface BenefitFinancePort {
  post(database: OperationDatabase, intent: Readonly<{
    scope: string;
    referenceType: string;
    referenceId: string;
    currency: string;
    description: string;
    debit: Readonly<{ code: string; kind: 'asset' | 'liability' | 'income' | 'expense' }>;
    credit: Readonly<{ code: string; kind: 'asset' | 'liability' | 'income' | 'expense' }>;
    amountMinor: number;
    occurredAt?: string;
  }>): Promise<string>;
}

export interface BenefitChoice {
  readonly id: string;
  readonly available_minor: number;
  readonly version: number;
  readonly kind: string;
}

export interface BenefitTender { readonly reference: string; readonly amountMinor: number }

export interface BenefitRefund {
  readonly id: string;
  readonly order: string;
  readonly member: string;
  readonly scope: string;
  readonly account: string;
  readonly amountMinor: number;
}

export interface BenefitGateway {
  preview(database: OperationDatabase, member: string, scope: string, accounts: readonly string[]): Promise<readonly BenefitChoice[]>;
  reserve(database: OperationDatabase, order: string, member: string, scope: string, tenders: readonly BenefitTender[]): Promise<void>;
  consume(database: OperationDatabase, order: string, account: string, amountMinor: number): Promise<void>;
  refund(database: OperationDatabase, input: BenefitRefund): Promise<void>;
  release(database: OperationDatabase, order: string): Promise<void>;
}
