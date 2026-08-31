import { defineModule } from '../../bootstrap/DefinedModule';
import { voucherOperations } from './VoucherOperations';
import { Manifest } from './Manifest';
import { VoucherPort } from './application/port/VoucherPort';
import { VOUCHER_ACCOUNTING_PORT } from '../finance/public/index';
import { CHECKOUT_VOUCHER_PORT, PAYMENT_VOUCHER_PORT, VERIFICATION_VOUCHER_PORT } from './public/index';
export const VoucherModule = defineModule(Manifest, voucherOperations, (context) => {
  const checkout = new VoucherPort();
  return [
    { token: CHECKOUT_VOUCHER_PORT, value: checkout },
    { token: VERIFICATION_VOUCHER_PORT, value: checkout },
    { token: PAYMENT_VOUCHER_PORT, value: new VoucherPort(context.ports.get(VOUCHER_ACCOUNTING_PORT)) },
  ];
});
