export interface AfterSaleLine {
  readonly lineId: string;
  readonly skuId: string;
  readonly listingId: string;
  readonly title: string;
  readonly productType: string;
  readonly provider: string | null;
  readonly purchasedQuantity: number;
  readonly fulfilledQuantity: number;
  readonly claimedQuantity: number;
  readonly requestedQuantity: number;
  readonly maximumQuantity: number;
  readonly unitMinor: number;
  readonly refundMinor: number;
  readonly available: boolean;
  readonly unavailableReason: string | null;
}

export interface AvailableAfterSaleLine extends Omit<AfterSaleLine, 'requestedQuantity' | 'unitMinor' | 'refundMinor'> {
  readonly expectedRefundMinor: number;
  readonly deadline: string | null;
  readonly requiresReturn: boolean;
}
