import type { ReadTransactionContext, WriteTransactionContext } from '../../../../foundation/persistence/TransactionContext';

export interface BenefitChoice {
  readonly id: string;
  readonly available_minor: number;
  readonly version: number;
  readonly kind: string;
}

export interface BenefitTender {
  readonly reference: string;
  readonly amountMinor: number;
}

export interface BenefitRefund {
  readonly id: string;
  readonly order: string;
  readonly member: string;
  readonly scope: string;
  readonly account: string;
  readonly amountMinor: number;
}

export interface BenefitGateway {
  preview(context: ReadTransactionContext, member: string, scope: string, accounts: readonly string[]): Promise<readonly BenefitChoice[]>;
  available(context: ReadTransactionContext, member: string, scope: string): Promise<readonly BenefitChoice[]>;
  reserve(context: WriteTransactionContext, order: string, member: string, scope: string, tenders: readonly BenefitTender[]): Promise<void>;
  consume(context: WriteTransactionContext, order: string, account: string, amountMinor: number): Promise<void>;
  refund(context: WriteTransactionContext, input: BenefitRefund): Promise<void>;
  release(context: WriteTransactionContext, order: string): Promise<void>;
}
