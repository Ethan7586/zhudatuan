import { BenefitPort } from '../../../benefit';
import { FinancePort } from '../../../finance';
import { VoucherPort } from '../../../voucher';
import { CheckoutPort } from './CheckoutPort';
import { QuoteReader } from '../../03_application_yingyong/queries_duqu/QuoteReader';

/** Full Commerce defaults kept outside the purchase-only source closure. */
export function fullCheckoutPort(key: string): CheckoutPort {
  return new CheckoutPort(key, new QuoteReader(new BenefitPort(new FinancePort()), new VoucherPort(new FinancePort())));
}
