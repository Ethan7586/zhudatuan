import type { Redemption } from './Redemption';

export interface VoucherActivity {
  readonly sequence: number;
  readonly previous: string | null;
  readonly next: string;
  readonly reason: string;
  readonly occurredAt: string;
  readonly redemption: Redemption | null;
}
