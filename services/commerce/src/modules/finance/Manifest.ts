import { defineModuleManifest } from '../../bootstrap/ModuleRegistry';
export const Manifest = defineModuleManifest('finance', ['access', 'organization'], ['database.pool', 'kms.client', 'object.store', 'security.keys'], {
  jobs: {
    dependencies: ['payment', 'channel', 'fulfillment'],
    services: ['database.pool', 'object.store', 'kms.client', 'finance.invoiceissuer', 'finance.payoutgateway'],
  },
  provider: { dependencies: ['channel'] },
});
