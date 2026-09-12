export const serviceTargets = Object.freeze({
  'identity-api': ['IdentityRegistrationApiMain', 'IdentityRegistrationApiReadyMain'],
  'identity-notification-jobs': ['IdentityNotificationJobsOnlyMain', 'IdentityNotificationJobsReadyMain'],
  'mall-provisioning-api': ['MallProvisioningApiMain', 'MallProvisioningApiReadyMain'],
  'support-api': ['ConsoleSupportMain'],
  'purchase-api': ['PurchaseApiMain', 'PurchaseApiReadyMain'],
  'web-api': ['WebBusinessApiMain', 'WebBusinessApiReadyMain'],
  'catalog-api': ['CatalogOperatorApiMain', 'CatalogOperatorApiReadyMain'],
  'catalog-jobs': ['CatalogJobsMain', 'CatalogJobsReadyMain'],
  'payment-webhook-api': ['PaymentWebhookApiMain', 'PaymentWebhookApiReadyMain'],
  'payment-jobs': ['PaymentJobsOnlyMain', 'PaymentJobsReadyMain'],
});

export const serviceEntryDirectory = '01_core_hexin/services/commerce/src/entry';
