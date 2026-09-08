import { PgExperienceReadPort } from './infrastructure/persistence/PgExperienceReadPort';
import { PgCheckoutExperiencePort } from './infrastructure/persistence/PgCheckoutExperiencePort';
import { PgCartExperiencePort } from './infrastructure/persistence/PgCartExperiencePort';
import { CACHE } from '../../platform/cache/Cache';
import { Singleflight } from '@shop/kernel';

import { PgTransactionAccess } from '../../platform/database/PgTransactionAccess';
import { defineModule } from '../../composition/DefinedModule';
import { EXPERIENCE_CATALOG_PORT } from '../catalog/public';
import { MARKETING_READ_PORT } from '../marketing/public';
import { ORGANIZATION_READ_PORT } from '../organization/public';
import { MALL_PROVISION_PORT } from '../organization/public';
import { ApplicationDetailHandler } from './application/handler/ApplicationDetailHandler';
import { EntryResolver } from './application/service/EntryResolver';
import { ApplicationsCopyHandler } from './application/handler/ApplicationsCopyHandler';
import { ApplicationsCreateHandler } from './application/handler/ApplicationsCreateHandler';
import { ApplicationsReadHandler } from './application/handler/ApplicationsReadHandler';
import { ApplicationsUpdateHandler } from './application/handler/ApplicationsUpdateHandler';
import { VersionsPublishHandler } from './application/handler/VersionsPublishHandler';
import { VersionsRestoreHandler } from './application/handler/VersionsRestoreHandler';
import { VersionsSaveHandler } from './application/handler/VersionsSaveHandler';
import { VersionsValidateHandler } from './application/handler/VersionsValidateHandler';
import { PgApplicationRepository } from './infrastructure/persistence/PgApplicationRepository';
import { PgPublicationRepository } from './infrastructure/persistence/PgPublicationRepository';
import { PgReleaseRepository } from './infrastructure/persistence/PgReleaseRepository';
import { PgVersionRepository } from './infrastructure/persistence/PgVersionRepository';
import { PgEntryRepository } from './infrastructure/persistence/PgEntryRepository';
import { RedisEntryCache } from './infrastructure/cache/RedisEntryCache';
import { Manifest } from './Manifest';
import { CART_EXPERIENCE_PORT, CHECKOUT_EXPERIENCE_PORT } from './public';
import { EXPERIENCE_READ_PORT } from './public/ExperienceReadPort';
import { createJobs } from './interface/job/JobFactory';
import { EVENT_SUBSCRIPTIONS } from '../../generated/EventSubscriptions';
import { TELEMETRY } from '../../platform/telemetry/Telemetry';
import { ExperienceTelemetry } from './infrastructure/adapter/ExperienceTelemetry';
import { STOREFRONT_CONFIG } from './application/port/StorefrontConfig';
import { ExperienceValidator } from './application/service/ExperienceValidator';
import { PublishedReadHandler } from './application/handler/PublishedReadHandler';
import { CATALOG_QUALIFICATION_PORT } from '../qualification/public/CatalogQualificationPort';
import { PRICING_READ_PORT } from '../pricing/public/PricingReadPort';
import { INVENTORY_READ_PORT } from '../inventory/public/InventoryReadPort';
import { OBJECT_STORE } from '../runtime/public/ObjectPort';

export const ExperienceModule = defineModule(Manifest, {
  jobs: createJobs,
  events: [
    { handler: 'experiencepublish', events: EVENT_SUBSCRIPTIONS.experiencepublish },
    { handler: 'experienceprovision', events: EVENT_SUBSCRIPTIONS.experienceprovision },
  ],
  handlers: (context) => {
    const transactions = new PgTransactionAccess();
    const entries = new RedisEntryCache(context.service(CACHE));
    const telemetry = new ExperienceTelemetry(context.service(TELEMETRY));
    const storefront = context.service(STOREFRONT_CONFIG);
    const applications = new PgApplicationRepository(transactions, context.ports.get(ORGANIZATION_READ_PORT), context.ports.get(MALL_PROVISION_PORT), context.ports.get(EXPERIENCE_CATALOG_PORT), storefront);
    const versions = new PgVersionRepository(transactions, context.ports.get(EXPERIENCE_CATALOG_PORT));
    const publications = new PgPublicationRepository(
      context.ports.get(EXPERIENCE_CATALOG_PORT),
      context.ports.get(MARKETING_READ_PORT),
      context.ports.get(MALL_PROVISION_PORT),
      context.ports.get(CATALOG_QUALIFICATION_PORT),
      context.ports.get(PRICING_READ_PORT),
      context.ports.get(INVENTORY_READ_PORT),
      context.service(OBJECT_STORE)
    );
    const validator = new ExperienceValidator(versions, publications);
    const releases = new PgReleaseRepository(transactions);
    const experience = new PgExperienceReadPort(new EntryResolver(new PgEntryRepository(storefront), entries, new Singleflight(), telemetry), context.service(CACHE), transactions);
    return [
      new ApplicationsCreateHandler(applications),
      new ApplicationsCopyHandler(applications),
      new ApplicationsReadHandler(applications, telemetry),
      new ApplicationDetailHandler(applications),
      new ApplicationsUpdateHandler(applications, entries),
      new VersionsSaveHandler(versions),
      new VersionsValidateHandler(validator),
      new VersionsPublishHandler(versions, releases, validator),
      new VersionsRestoreHandler(versions),
      new PublishedReadHandler(experience),
    ];
  },
  ports: (context) => [
    { token: CART_EXPERIENCE_PORT, value: new PgCartExperiencePort() },
    { token: CHECKOUT_EXPERIENCE_PORT, value: new PgCheckoutExperiencePort() },
    {
      token: EXPERIENCE_READ_PORT,
      value: new PgExperienceReadPort(
        new EntryResolver(new PgEntryRepository(context.service(STOREFRONT_CONFIG)), new RedisEntryCache(context.service(CACHE)), new Singleflight(), new ExperienceTelemetry(context.service(TELEMETRY))),
        context.service(CACHE),
        new PgTransactionAccess()
      ),
    },
  ],
});
