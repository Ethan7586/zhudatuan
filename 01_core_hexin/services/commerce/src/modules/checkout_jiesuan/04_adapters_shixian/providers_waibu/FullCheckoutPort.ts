import { BenefitPort } from '../../../benefit/BenefitPort';
import { VoucherPort } from '../../../voucher/application/port/VoucherPort';
import { CheckoutPort } from './CheckoutPort';
import { QuoteReader } from '../../03_application_yingyong/queries_duqu/QuoteReader';

/** Full Commerce defaults kept outside the purchase-only source closure. */
export function fullCheckoutPort(key: string): CheckoutPort {
  return new CheckoutPort(key, new QuoteReader(new BenefitPort(), new VoucherPort()));
}
