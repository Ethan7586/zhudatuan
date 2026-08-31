export interface Voucher {
  readonly id: string;
  readonly programId: string;
  readonly name: string;
  readonly initialMinor: number;
  readonly remainingMinor: number;
  readonly state: string;
  readonly expiresAt: string;
  readonly version: number;
}
