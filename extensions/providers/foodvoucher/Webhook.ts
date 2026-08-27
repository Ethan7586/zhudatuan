<<<<<<< HEAD
/**
 * Deliberately not exported by the package. The documented fulfillment callback is unsigned,
 * so it cannot satisfy ProviderWebhookVerifier and must remain disabled.
 */
export const FOODVOUCHER_WEBHOOK_DISABLED = 'FOODVOUCHER_UNSIGNED_CALLBACK' as const;
=======
export { Webhook as FoodvoucherWebhook } from '@shop/providercore';
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
