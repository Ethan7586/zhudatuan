export const serviceTargets = Object.freeze({
  'identity-api': ['IdentityRegistrationApiMain', 'IdentityRegistrationApiReadyMain'],
  'purchase-api': ['PurchaseApiMain', 'PurchaseApiReadyMain'],
  'web-api': ['WebBusinessApiMain', 'WebBusinessApiReadyMain'],
  'catalog-api': ['CatalogOperatorApiMain', 'CatalogOperatorApiReadyMain'],
  'catalog-jobs': ['CatalogJobsMain', 'CatalogJobsReadyMain'],
  'payment-webhook-api': ['PaymentWebhookApiMain', 'PaymentWebhookApiReadyMain'],
  'payment-jobs': ['PaymentJobsOnlyMain', 'PaymentJobsReadyMain'],
});

export const serviceEntryDirectory = '01_core_hexin/services/commerce/src/entry';
