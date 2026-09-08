import { defineModule } from '../../composition/DefinedModule';
import { EVENT_SUBSCRIPTIONS } from '../../generated/EventSubscriptions';
import { CurrentIdentityReadPort } from './infrastructure/persistence/CurrentIdentityReadPort';
import { PgIdentityPrincipal } from './infrastructure/persistence/PgIdentityPrincipal';
import { PgIdentityRetention } from './infrastructure/persistence/PgIdentityRetention';
import { PgMembershipContext } from './infrastructure/persistence/PgMembershipContext';
import { PgNotificationIdentity } from './infrastructure/persistence/PgNotificationIdentity';
import { PgPaymentIdentityPort } from './infrastructure/persistence/PgPaymentIdentityPort';
import { createJobs } from './interface/job/JobFactory';
import { Manifest } from './Manifest';
import { composeIdentity } from './infrastructure/registry/IdentityComposition';
import { MEMBER_IMPORT_IDENTITY_PORT, RUNTIME_IDENTITY_PORT } from './public';
import { IDENTITY_READ_PORT } from './public/IdentityReadPort';
import { MEMBERSHIP_CONTEXT_PORT } from './public/MembershipContextPort';
import { NOTIFICATION_IDENTITY_PORT } from './public/NotificationIdentityPort';
import { PAYMENT_IDENTITY_PORT } from './public/PaymentIdentityPort';

export const IdentityModule = defineModule(Manifest, {
  jobs: createJobs,
  events: [{ handler: 'sessionrevocation', events: EVENT_SUBSCRIPTIONS.sessionrevocation }],
  handlers: composeIdentity,
  ports: [
    { token: NOTIFICATION_IDENTITY_PORT, value: new PgNotificationIdentity() },
    { token: MEMBERSHIP_CONTEXT_PORT, value: new PgMembershipContext() },
    { token: IDENTITY_READ_PORT, value: new CurrentIdentityReadPort() },
    { token: PAYMENT_IDENTITY_PORT, value: new PgPaymentIdentityPort() },
  ],
  jobPorts: [
    { token: NOTIFICATION_IDENTITY_PORT, value: new PgNotificationIdentity() },
    { token: MEMBER_IMPORT_IDENTITY_PORT, value: new PgIdentityPrincipal() },
    { token: RUNTIME_IDENTITY_PORT, value: new PgIdentityRetention() },
  ],
});
