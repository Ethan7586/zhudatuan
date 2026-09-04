/** The origin of an economic fact, frozen at redemption and reused by refunds. */
export interface RedemptionContext {
  readonly channel: 'order' | 'store' | 'manual';
  readonly store: string | null;
  readonly scopes: readonly string[];
  readonly timezone: string;
}
