import { defineModule } from '../../bootstrap/DefinedModule';
import { paymentOperations } from './PaymentOperations';
import { Manifest } from './Manifest';
import { CHECKOUT_PAYMENT_PORT, FINANCE_PAYMENT_PORT } from './public/index';
import { paymentComposition } from './PaymentComposition';
export const PaymentModule = defineModule(Manifest, paymentOperations, (context) => {
  const payment = paymentComposition(context);
  return [
    { token: CHECKOUT_PAYMENT_PORT, value: payment.checkout },
    { token: FINANCE_PAYMENT_PORT, value: payment.payments },
  ];
});
