import { defineModule } from '../../bootstrap/DefinedModule';
import { marketingOperations } from './MarketingOperations';
import { Manifest } from './Manifest';
import { MarketingPort } from './MarketingPort';
import { CHECKOUT_MARKETING_PORT, EXPERIENCE_MARKETING_PORT, PAYMENT_MARKETING_PORT } from './public/index';
export const MarketingModule = defineModule(Manifest, marketingOperations, () => {
  const marketing = new MarketingPort();
  return [
    { token: CHECKOUT_MARKETING_PORT, value: marketing },
    { token: PAYMENT_MARKETING_PORT, value: marketing },
    { token: EXPERIENCE_MARKETING_PORT, value: marketing },
  ];
});
