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

export function notificationRoutes(context: ModuleContext): ModuleOperations {
  const pool = context.container.get(DATABASE_POOL); const kms = context.container.get(KMS_CLIENT);
  const repositories = (database: ConstructorParameters<typeof PgNotificationRepository>[0]) => new PgNotificationRepository(database);
  return new ModuleOperations('notification', pool, context.container.get(AUDIT_SINK), {
    ...getNotificationsOperations(repositories), ...changePreferenceOperations(kms, pool, repositories),
    ...getTemplateOperations(repositories), ...saveTemplateOperations(repositories),
    ...getAnnouncementOperations(repositories), ...saveAnnouncementOperations(repositories),
  });
}
