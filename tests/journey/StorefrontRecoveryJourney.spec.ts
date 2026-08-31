import { storefrontJourney } from './StorefrontJourneyHarness';
storefrontJourney('storefront payment recovery journey', {
  operations: ['payment.intents.read', 'payment.recoveries.read', 'payment.recoveries.resolve'],
  routes: ['/payments/:paymentId/result'],
  sources: ['services/commerce/src/modules/payment/PaymentJobs.ts', 'services/commerce/src/modules/payment/application/ReadPayment.ts'],
  markers: [/for update of intent,attempt/, /recoverycase/, /retryAfter/],
});
