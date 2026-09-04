import { defineModule } from '../../bootstrap/DefinedModule';
import { PgTransactionAccess } from '../../adapter/database/PgTransactionAccess';
import { Manifest } from './Manifest';
import { PricingPort } from './infrastructure/persistence/PricingPort';
import { CART_PRICING_PORT, CATALOG_PRICE_COMMAND_PORT, CATALOG_PRICING_PORT, CHECKOUT_PRICING_PORT, PROVIDER_PRICING_PORT, RUNTIME_PRICING_PORT } from './public/index';
import { PRICING_READ_PORT } from './public/PricingReadPort';
import { PgPricingReadPort } from './infrastructure/persistence/PgPricingReadPort';
import { RulesCreateHandler } from './application/handler/RulesCreateHandler';
import { RulesPublishHandler } from './application/handler/RulesPublishHandler';
import { OffersReadHandler } from './application/handler/OffersReadHandler';
import { PgRuleRepository } from './infrastructure/persistence/PgRuleRepository';
import { createProviderJobs } from './interface/job/JobFactory';

export const PricingModule = defineModule(Manifest, {
  providerJobs: createProviderJobs,
  handlers: () => {
    const rules = new PgRuleRepository();
    return [new OffersReadHandler(new PgPricingReadPort()), new RulesCreateHandler(rules), new RulesPublishHandler(rules)];
  },
  ports: () => {
    const pricing = new PricingPort(new PgTransactionAccess());
    return [
      { token: CHECKOUT_PRICING_PORT, value: pricing },
      { token: CART_PRICING_PORT, value: pricing },
      { token: CATALOG_PRICING_PORT, value: pricing },
      { token: CATALOG_PRICE_COMMAND_PORT, value: pricing },
      { token: PRICING_READ_PORT, value: new PgPricingReadPort() },
    ];
  },
  jobPorts: [{ token: RUNTIME_PRICING_PORT, value: new PricingPort() }],
  providerPorts: [{ token: PROVIDER_PRICING_PORT, value: new PricingPort() }],
});
