import { defineModuleManifest } from '../../bootstrap/ModuleRegistry';
export const Manifest = defineModuleManifest(
  'checkout',
  ['access', 'benefit', 'cart', 'catalog', 'experience', 'finance', 'inventory', 'marketing', 'member', 'order', 'organization', 'payment', 'pricing', 'qualification', 'risk', 'voucher'],
  ['database.pool', 'security.keys'],
  { jobs: { dependencies: ['payment', 'inventory', 'order'], services: ['database.pool'] } }
);
