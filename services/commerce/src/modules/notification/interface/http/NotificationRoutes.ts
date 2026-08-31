import type { ModuleContext } from '../../../../bootstrap/ModuleRegistry';
import { AUDIT_SINK } from '../../../../foundation/application/AuditSink';
import { ModuleOperations } from '../../../../foundation/application/ModuleOperations';
import { KMS_CLIENT } from '../../../../foundation/infrastructure/KmsClient';
import { DATABASE_POOL } from '../../../../foundation/persistence/Pool';
import { changePreferenceOperations } from '../../application/command/ChangePreference';
import { saveAnnouncementOperations } from '../../application/command/SaveAnnouncement';
import { saveTemplateOperations } from '../../application/command/SaveTemplate';
import { getAnnouncementOperations } from '../../application/query/GetAnnouncements';
import { getNotificationsOperations } from '../../application/query/GetNotifications';
import { getTemplateOperations } from '../../application/query/GetTemplates';
import { PgNotificationRepository } from '../../infrastructure/persistence/PgNotificationRepository';
import { NOTIFICATION_IDENTITY_PORT } from '../../../identity/public/index';
import { MEMBER_ACCESS_PORT } from '../../../access/public';
import { ORGANIZATION_READ_PORT } from '../../../organization/public';

export function notificationRoutes(context: ModuleContext): ModuleOperations {
  const pool = context.service(DATABASE_POOL);
  const kms = context.service(KMS_CLIENT);
  const identity = context.ports.get(NOTIFICATION_IDENTITY_PORT);
  const members = context.ports.get(MEMBER_ACCESS_PORT);
  const organizations = context.ports.get(ORGANIZATION_READ_PORT);
  const repositories = (database: ConstructorParameters<typeof PgNotificationRepository>[0]) => new PgNotificationRepository(database, identity, members, organizations);
  return new ModuleOperations('notification', pool, context.service(AUDIT_SINK), {
    ...getNotificationsOperations(repositories),
    ...changePreferenceOperations(kms, repositories),
    ...getTemplateOperations(repositories),
    ...saveTemplateOperations(repositories),
    ...getAnnouncementOperations(repositories),
    ...saveAnnouncementOperations(repositories),
  });
}
