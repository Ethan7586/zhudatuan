import type { QueryResultRow } from 'pg';

export interface ReferralSettingRow extends QueryResultRow {
  readonly enabled: boolean;
  readonly reward_enabled: boolean;
  readonly settlement_trigger: 'paid' | 'received';
  readonly version: number;
  readonly freeze_days: number;
  readonly rate_basis_points: number;
  readonly currency: string;
}

export interface ReferralBindingRow extends QueryResultRow {
  readonly id: string;
  readonly beneficiary_id: string;
  readonly inviter_beneficiary_id: string | null;
}

export interface ReferralProductRow extends QueryResultRow {
  readonly id: string;
  readonly product_id: string;
  readonly enabled: boolean;
  readonly rate_basis_points: number;
  readonly reward_basis_points: number;
  readonly version: number;
}
