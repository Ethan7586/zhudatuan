import { defineModule } from '../../bootstrap/DefinedModule';
import { pricingOperations } from './PricingOperations';
import { Manifest } from './Manifest';
import { PricingPort } from './PricingPort';
import { CART_PRICING_PORT, CATALOG_PRICING_PORT, CHECKOUT_PRICING_PORT } from './public/index';
import { DATABASE_POOL } from '../../foundation/persistence/Pool';
import { PRICING_READ_PORT, PgPricingReadPort } from './public/PricingReadPort';
import { readDatabaseWorkload } from '../../foundation/persistence/Workload';
export const PricingModule = defineModule(Manifest, pricingOperations, (context) => {
  const pricing = new PricingPort();
  return [
    { token: CHECKOUT_PRICING_PORT, value: pricing },
    { token: CART_PRICING_PORT, value: pricing },
    { token: CATALOG_PRICING_PORT, value: pricing },
    { token: PRICING_READ_PORT, value: new PgPricingReadPort(context.service(DATABASE_POOL), readDatabaseWorkload(context.workload)) },
  ];
});
