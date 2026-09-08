import { defineModule } from '../../composition/DefinedModule';
import { CampaignsCreateHandler } from './application/handler/CampaignsCreateHandler';
import { CampaignsDisableHandler } from './application/handler/CampaignsDisableHandler';
import { CampaignsPublishHandler } from './application/handler/CampaignsPublishHandler';
import { CampaignsReadHandler } from './application/handler/CampaignsReadHandler';
import { CampaignsReviseHandler } from './application/handler/CampaignsReviseHandler';
import { PgCampaignRepository } from './infrastructure/persistence/PgCampaignRepository';
import { PgMarketingReadPort } from './infrastructure/persistence/PgMarketingReadPort';
import { PgMarketingReservePort } from './infrastructure/persistence/PgMarketingReservePort';
import { createJobs } from './interface/job/JobFactory';
import { Manifest } from './Manifest';
import { MARKETING_READ_PORT, MARKETING_RESERVE_PORT } from './public';

export const MarketingModule = defineModule(Manifest, {
  jobs: createJobs,
  handlers: () => {
    const campaigns = new PgCampaignRepository();
    return [new CampaignsReadHandler(campaigns), new CampaignsCreateHandler(campaigns), new CampaignsReviseHandler(campaigns), new CampaignsPublishHandler(campaigns), new CampaignsDisableHandler(campaigns)];
  },
  ports: [
    { token: MARKETING_READ_PORT, value: new PgMarketingReadPort() },
    { token: MARKETING_RESERVE_PORT, value: new PgMarketingReservePort() },
  ],
  jobPorts: [{ token: MARKETING_RESERVE_PORT, value: new PgMarketingReservePort() }],
});
