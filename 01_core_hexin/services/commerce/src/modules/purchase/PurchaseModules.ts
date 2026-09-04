import { defineSelectedModule } from '../../bootstrap/DefinedModule';
import {
  purchaseCheckoutOperations,
  purchaseOrderOperations,
  purchasePaymentOperations,
} from './PurchaseOperations';

export const PurchaseCheckoutModule = defineSelectedModule(
  'checkout', ['checkout.quote.create'], purchaseCheckoutOperations,
);
export const PurchaseOrderModule = defineSelectedModule(
  'order', ['order.orders.create'], purchaseOrderOperations,
);
export const PurchasePaymentModule = defineSelectedModule(
  'payment', ['payment.intents.create'], purchasePaymentOperations,
);

export const PURCHASE_MODULES = Object.freeze([
  PurchaseCheckoutModule,
  PurchaseOrderModule,
  PurchasePaymentModule,
]);
