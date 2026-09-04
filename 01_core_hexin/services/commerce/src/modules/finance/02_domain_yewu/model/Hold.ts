export type HoldState = 'active' | 'captured' | 'released' | 'expired';

export interface Hold {
  readonly id: string;
  readonly account: string;
  readonly ownerType: string;
  readonly owner: string;
  readonly amountMinor: number;
  readonly state: HoldState;
  readonly expiresAt: string;
}
