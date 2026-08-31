<<<<<<< HEAD
<<<<<<< HEAD
=======
>>>>>>> 018b2a71 (chore(release): capture current production source)
/**
 * Deliberately not exported by the package. Cake Uncle's signature authenticates only channel
 * and timestamp, not the event payload; runtime must re-query order state before this can be wired.
 */
export const MEAL_WEBHOOK_DISABLED = 'MEAL_WEBHOOK_NON_AUTHORITATIVE' as const;
<<<<<<< HEAD
=======
export { Webhook as MealWebhook } from '@shop/providercore';
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
=======
>>>>>>> 018b2a71 (chore(release): capture current production source)
