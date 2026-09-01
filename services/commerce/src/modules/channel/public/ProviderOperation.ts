export interface ProviderOperationInput {
  readonly id: string;
  readonly provider: string;
  readonly scope: string;
  readonly kind: 'order' | 'return' | 'refund';
  readonly idempotency: string;
  readonly reference: string;
  readonly external: string | null;
  readonly state: 'queued' | 'processing' | 'succeeded' | 'failed' | 'unknown';
  readonly requestHash: string;
  readonly response: unknown;
}
