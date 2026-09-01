import { defineModuleManifest } from '../../bootstrap/ModuleRegistry';
export const Manifest = defineModuleManifest('payment', ['order', 'benefit', 'voucher', 'inventory', 'marketing', 'fulfillment', 'organization', 'access', 'identity'], ['database.pool', 'audit.sink', 'kms.client', 'payment.gateway'], {
  jobs: {
    dependencies: ['order', 'benefit', 'voucher', 'inventory', 'marketing', 'fulfillment', 'organization', 'channel'],
    bindings: ['benefit', 'voucher', 'inventory', 'marketing'],
    services: ['database.pool', 'payment.gateway'],
  },
});
