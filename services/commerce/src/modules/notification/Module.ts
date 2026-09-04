import { PgTransactionAccess } from '../../adapter/database/PgTransactionAccess';
import { defineModule } from '../../bootstrap/DefinedModule';
import { KMS_CLIENT } from '../../foundation/application/KmsPort';
import { MEMBER_ACCESS_PORT } from '../access/public';
import { NOTIFICATION_IDENTITY_PORT } from '../identity/public';
import { ORGANIZATION_READ_PORT } from '../organization/public';
import { AnnouncementsManageHandler } from './application/handler/AnnouncementsManageHandler';
import { AnnouncementsReadHandler } from './application/handler/AnnouncementsReadHandler';
import { EndpointsManageHandler } from './application/handler/EndpointsManageHandler';
import { NotificationsAckHandler } from './application/handler/NotificationsAckHandler';
import { NotificationsReadHandler } from './application/handler/NotificationsReadHandler';
import { PreferencesManageHandler } from './application/handler/PreferencesManageHandler';
import { PreferencesReadHandler } from './application/handler/PreferencesReadHandler';
import { TemplatesManageHandler } from './application/handler/TemplatesManageHandler';
import { TemplatesReadHandler } from './application/handler/TemplatesReadHandler';
import { PgNotificationRepository } from './infrastructure/persistence/PgNotificationRepository';
import { VerificationChannelRegistry } from './infrastructure/adapter/VerificationChannelRegistry';
import { Manifest } from './Manifest';
import { createJobs } from './interface/job/JobFactory';
import { EVENT_SUBSCRIPTIONS } from '../../generated/EventSubscriptions';
import { VERIFICATION_CHANNEL_PORT } from './public';

export const NotificationModule = defineModule(Manifest, {
  ports: [{ token: VERIFICATION_CHANNEL_PORT, value: new VerificationChannelRegistry() }],
  jobs: createJobs,
  events: [{ handler: 'notification', events: EVENT_SUBSCRIPTIONS.notification }],
  handlers: (context) => {
    const notifications = new PgNotificationRepository(new PgTransactionAccess(), context.ports.get(NOTIFICATION_IDENTITY_PORT), context.ports.get(MEMBER_ACCESS_PORT), context.ports.get(ORGANIZATION_READ_PORT));
    return [
      new NotificationsReadHandler(notifications),
      new NotificationsAckHandler(notifications),
      new PreferencesReadHandler(notifications),
      new PreferencesManageHandler(notifications),
      new EndpointsManageHandler(notifications, context.service(KMS_CLIENT)),
      new TemplatesManageHandler(notifications),
      new TemplatesReadHandler(notifications),
      new AnnouncementsReadHandler(notifications),
      new AnnouncementsManageHandler(notifications),
    ];
  },
});
