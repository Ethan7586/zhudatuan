import { defineModuleManifest } from '../../bootstrap/ModuleManifest';
import { CHECKOUT_HOLD_PORT, CHECKOUT_PAYMENT_PORT, FINANCE_PAYMENT_PORT, ORDER_EXPIRY_HOLD_PORT, ORDER_EXPIRY_PAYMENT_PORT, ORDER_IMPORT_PAYMENT_PORT } from './public';

export const Manifest = defineModuleManifest({
  id: 'payment',
  dependencies: ['order', 'benefit', 'voucher', 'inventory', 'marketing', 'organization', 'access', 'identity'],
  services: ['database.pool', 'audit.sink', 'kms.client', 'payment.gateway'],
  ports: [CHECKOUT_PAYMENT_PORT, CHECKOUT_HOLD_PORT, FINANCE_PAYMENT_PORT],
  workloads: {
    jobs: {
      dependencies: ['order', 'benefit', 'voucher', 'inventory', 'marketing', 'organization', 'channel'],
      bindings: ['benefit', 'voucher', 'inventory', 'marketing'],
      services: ['database.pool', 'payment.gateway'],
      ports: [FINANCE_PAYMENT_PORT, ORDER_IMPORT_PAYMENT_PORT, ORDER_EXPIRY_PAYMENT_PORT, ORDER_EXPIRY_HOLD_PORT],
    },
  },
});
