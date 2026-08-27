export type SettlementState = 'draft' | 'payable' | 'paid' | 'cancelled';

export interface Settlement {
  readonly id: string;
  readonly scope: string;
  readonly partner: string;
  readonly period: string;
  readonly grossMinor: number;
  readonly feeMinor: number;
  readonly amountMinor: number;
  readonly invoiceBasis: 'gross' | 'net';
  readonly currency: 'CNY';
  readonly state: SettlementState;
  readonly requestedBy: string;
  readonly approvedBy: string | null;
  readonly version: number;
}
