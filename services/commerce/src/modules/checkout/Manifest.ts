import { defineModuleManifest } from '../../bootstrap/ModuleRegistry';
export const Manifest = defineModuleManifest(
  'checkout',
  ['access', 'benefit', 'cart', 'catalog', 'experience', 'finance', 'inventory', 'marketing', 'order', 'organization', 'payment', 'pricing', 'qualification', 'risk', 'voucher'],
  ['database.pool', 'audit.sink', 'security.keys']
);
