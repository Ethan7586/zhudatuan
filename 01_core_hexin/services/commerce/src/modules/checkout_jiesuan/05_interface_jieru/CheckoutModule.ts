import { defineModule } from '../../../bootstrap/DefinedModule';
import { checkoutOperations } from './http/CheckoutOperations';

export const CheckoutModule = defineModule(
  'checkout',
  ['cart', 'qualification', 'pricing', 'inventory', 'marketing', 'voucher', 'benefit'],
  checkoutOperations,
);
