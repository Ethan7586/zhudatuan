import { defineModule } from '../../bootstrap/DefinedModule';
import { Manifest } from './Manifest';
import { MarketingPort } from './infrastructure/persistence/MarketingPort';
import { CHECKOUT_MARKETING_PORT, EXPERIENCE_MARKETING_PORT, PAYMENT_MARKETING_PORT } from './public/index';
import { CampaignsReadHandler } from './application/handler/CampaignsReadHandler';
import { PgCampaignRepository } from './infrastructure/persistence/PgCampaignRepository';
import { PgTransactionAccess } from '../../adapter/database/PgTransactionAccess';

export const MarketingModule = defineModule(Manifest, {
  handlers: () => [new CampaignsReadHandler(new PgCampaignRepository(new PgTransactionAccess()))],
  ports: () => {
    const marketing = new MarketingPort();
    return [
      { token: CHECKOUT_MARKETING_PORT, value: marketing },
      { token: PAYMENT_MARKETING_PORT, value: marketing },
      { token: EXPERIENCE_MARKETING_PORT, value: marketing },
    ];
  },
  jobPorts: [{ token: PAYMENT_MARKETING_PORT, value: new MarketingPort() }],
});
