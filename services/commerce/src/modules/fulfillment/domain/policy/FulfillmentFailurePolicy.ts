export type FulfillmentFailureDecision = 'retry' | 'needsaction';

export class FulfillmentFailurePolicy {
  classify(error: unknown, attempts: number): FulfillmentFailureDecision {
    if (!Number.isSafeInteger(attempts) || attempts < 1) throw new Error('FULFILLMENT_ATTEMPTS_INVALID');
    const code = error instanceof Error ? error.message : String(error);
    if (attempts >= 5 || /(INVALID|DENIED|UNSUPPORTED|NOT_FOUND|MISMATCH|FORBIDDEN)/i.test(code)) return 'needsaction';
    return 'retry';
  }
}
