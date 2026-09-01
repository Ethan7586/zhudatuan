export interface PaymentWebhookScopeReader {
  resolve(order: string, signal: AbortSignal, deadline: number): Promise<string | null>;
}
