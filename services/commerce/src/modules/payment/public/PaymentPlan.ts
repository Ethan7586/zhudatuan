export interface PaymentTenderPlan {
  readonly kind: string;
  readonly reference: string | null;
  readonly amountMinor: number;
}

export interface PaymentPlan {
  readonly intent: string;
  readonly external: boolean;
  readonly expiresAt: string;
}
