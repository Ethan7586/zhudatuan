export const voucherViews = ['programs', 'libraries', 'reserves', 'batches', 'statusbatches', 'bindings', 'redemptions', 'history'] as const;
export type VoucherView = (typeof voucherViews)[number];

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
  readonly programId?: string;
  readonly cardpoolId?: string | null;
  readonly reserveId?: string | null;
  readonly voucherId?: string;
  readonly memberId?: string | null;
  readonly requestedBy?: string;
  readonly approvalRequired?: boolean;
  readonly validityDays?: number;
}

export interface VoucherRecordPage {
  readonly items: readonly VoucherRecord[];
  readonly count: number;
  readonly nextCursor?: string;
}

export interface VoucherProgramDraft {
  readonly id?: string;
  readonly version?: number;
  readonly name: string;
  readonly valueMinor: number;
  readonly validityDays: number;
  readonly approvalRequired: boolean;
  readonly status: 'draft' | 'active' | 'paused' | 'retired';
}
