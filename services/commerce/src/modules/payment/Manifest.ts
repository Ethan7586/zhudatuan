import { defineModuleManifest } from '../../bootstrap/ModuleRegistry';
export const Manifest = defineModuleManifest('payment', ['order', 'benefit', 'voucher', 'inventory', 'marketing', 'fulfillment', 'organization', 'access'], ['database.pool', 'audit.sink', 'kms.client', 'payment.gateway']);
