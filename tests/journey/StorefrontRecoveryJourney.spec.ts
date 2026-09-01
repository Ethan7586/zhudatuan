import { storefrontJourney } from './StorefrontJourneyHarness';
storefrontJourney('storefront payment recovery journey', {
  operations: ['payment.intents.read', 'payment.recoveries.read', 'payment.recoveries.resolve'],
  routes: ['/payments/:paymentId/result'],
  sources: ['services/commerce/src/modules/payment/infrastructure/persistence/PgPaymentRecoveryProcess.ts', 'services/commerce/src/modules/payment/infrastructure/persistence/PaymentReader.ts'],
  markers: [/for update of intent,attempt/, /recoverycase/, /retryAfter/],
});
