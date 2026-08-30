/**
 * Deliberately not exported by the package. The documented fulfillment callback is unsigned,
 * so it cannot satisfy ProviderWebhookVerifier and must remain disabled.
 */
export const FOODVOUCHER_WEBHOOK_DISABLED = 'FOODVOUCHER_UNSIGNED_CALLBACK' as const;
