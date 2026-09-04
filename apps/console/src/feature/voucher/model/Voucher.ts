import type { OperationId } from '@shop/contract';
import { VOUCHER_OPERATION_IDS } from '@shop/contract/ids';

export const voucherViews = ['products', 'pools', 'credentials', 'stocks', 'issues', 'vouchers', 'redemptions', 'actions', 'search'] as const;
export type VoucherView = (typeof voucherViews)[number];
export type VoucherOperation = Extract<OperationId, `voucher.${string}`>;

const operationSet = new Set<string>(VOUCHER_OPERATION_IDS);
export function isVoucherOperation(value: string): value is VoucherOperation {
  return operationSet.has(value);
}

export interface VoucherRecord {
  readonly id: string;
  readonly kind: VoucherView;
  readonly name: string;
  readonly state: string;
  readonly detail: string;
  readonly quantity: number | null;
  readonly amountMinor: number | null;
  readonly currency: string | null;
  readonly occurredAt: string | null;
  readonly version: number | null;
  readonly raw: Readonly<Record<string, unknown>>;
}

export interface VoucherRecordPage {
  readonly items: readonly VoucherRecord[];
  readonly count: number;
  readonly nextCursor?: string;
}

export interface VoucherReadQuery {
  readonly cursor?: string;
  readonly query?: string;
  readonly state?: string;
}

export interface VoucherExecutionOptions {
  readonly identity?: string | undefined;
  readonly expectedVersion?: number | undefined;
  readonly proof?: string | undefined;
  readonly signal?: AbortSignal | undefined;
}

export interface VoucherCommandInput {
  readonly path?: Readonly<Record<string, string>>;
  readonly query?: Readonly<Record<string, string | number | boolean>>;
  readonly body?: Readonly<Record<string, unknown>>;
}

export type VoucherCommand = Readonly<{
  operation: VoucherOperation;
  input: VoucherCommandInput;
  options?: Omit<VoucherExecutionOptions, 'signal'>;
}>;

export interface VoucherReceipt {
  readonly operation: VoucherOperation;
  readonly reference: string | null;
  readonly state: string | null;
  readonly kind: VoucherProgressKind | 'record';
  readonly message: string;
}

export type VoucherChoiceKind = 'product' | 'stock';

export interface VoucherChoice {
  readonly id: string;
  readonly label: string;
  readonly detail: string;
  readonly fill: Readonly<Record<string, string>>;
}

export interface VoucherChoicePage {
  readonly items: readonly VoucherChoice[];
  readonly nextCursor?: string;
}

export interface VoucherFacet {
  readonly value: string;
  readonly count: number;
}

export interface VoucherFacets {
  readonly states: readonly VoucherFacet[];
  readonly products: readonly VoucherFacet[];
  readonly pools: readonly VoucherFacet[];
  readonly watermark: string;
}

export interface VoucherTimelineEntry {
  readonly sequence: number;
  readonly previous: string | null;
  readonly next: string;
  readonly reason: string;
  readonly actor: string;
  readonly occurredAt: string;
  readonly redemption: Readonly<Record<string, unknown>> | null;
}

export interface VoucherTimeline {
  readonly items: readonly VoucherTimelineEntry[];
  readonly nextCursor?: string;
}

export type VoucherProgressKind = 'job' | 'export' | 'issue' | 'action';

export interface VoucherProgress {
  readonly id: string;
  readonly kind: VoucherProgressKind;
  readonly state: string;
  readonly processed: number;
  readonly total: number;
  readonly succeeded: number;
  readonly failed: number;
  readonly retryable: number;
  readonly fileName: string | null;
  readonly downloadToken: string | null;
  readonly expiresAt: string | null;
  readonly updatedAt: string;
}
