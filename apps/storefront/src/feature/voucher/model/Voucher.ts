export interface Voucher {
  readonly id: string;
  readonly productId: string;
  readonly productName: string;
  readonly numberMasked: string;
  readonly initialMinor: number;
  readonly remainingMinor: number;
  readonly currency: string;
  readonly state: string;
  readonly startsAt: string;
  readonly expiresAt: string;
  readonly version: number;
}
