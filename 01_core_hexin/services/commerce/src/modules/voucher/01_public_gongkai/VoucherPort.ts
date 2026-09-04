export interface VoucherDatabase {
  query<R extends object = Record<string, unknown>>(
    text: string,
    values?: readonly unknown[],
  ): Promise<Readonly<{ rows: readonly R[] }>>;
}

export interface VoucherChoice {
  readonly id: string;
  readonly remaining_minor: number;
  readonly version: number;
  readonly program: string;
}

export interface VoucherTender { readonly reference: string; readonly amountMinor: number }

export interface VoucherRefund {
  readonly refund: string;
  readonly order: string;
  readonly member: string;
  readonly voucher: string;
  readonly amountMinor: number;
}

export interface VoucherRedemption { readonly id: string; readonly amountMinor: number }

export interface VoucherFinancePort {
  post(database: VoucherDatabase, intent: Readonly<{
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

export interface VoucherGateway {
  preview(database: VoucherDatabase, vouchers: readonly string[], member: string, scope: string): Promise<readonly VoucherChoice[]>;
  reserve(database: VoucherDatabase, order: string, member: string, scope: string, tenders: readonly VoucherTender[]): Promise<void>;
  release(database: VoucherDatabase, order: string): Promise<void>;
  consume(database: VoucherDatabase, order: string, member: string, voucher: string, amountMinor: number): Promise<void>;
  refund(database: VoucherDatabase, input: VoucherRefund): Promise<void>;
  redeemableScope(database: VoucherDatabase, voucher: string, member: string): Promise<string | null>;
  redeemVerification(database: VoucherDatabase, input: Readonly<{
    voucher: string;
    verification: string;
    scope: string;
    actor: string;
  }>): Promise<VoucherRedemption | null>;
}
