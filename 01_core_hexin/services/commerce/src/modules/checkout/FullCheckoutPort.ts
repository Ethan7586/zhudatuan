import { BenefitPort } from '../benefit/BenefitPort';
import { VoucherPort } from '../voucher/application/port/VoucherPort';
import { CheckoutPort } from './CheckoutPort';
import { QuoteReader } from './application/QuoteReader';

/** Full Commerce defaults kept outside the purchase-only source closure. */
export function fullCheckoutPort(key: string): CheckoutPort {
  return new CheckoutPort(key, new QuoteReader(new BenefitPort(), new VoucherPort()));
}
