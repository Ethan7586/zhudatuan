import { publicPort } from '../../../composition/ModuleRegistry';
import type { ReadTransactionContext } from '../../../platform/database/TransactionContext';
import type { CustomerKind } from '../domain/model/Customer';

export interface VoucherCustomerSummary {
  readonly id: string;
  readonly scope: string;
  readonly name: string;
  readonly kind: CustomerKind;
  readonly agreementVersion: number;
  readonly agreementExpiresAt: string;
}

export interface VoucherCustomerPort {
  approved(context: ReadTransactionContext, customer: string, scope: string): Promise<VoucherCustomerSummary | null>;
}

export const VOUCHER_CUSTOMER_PORT = publicPort<VoucherCustomerPort>('partner', 'vouchercustomer');
