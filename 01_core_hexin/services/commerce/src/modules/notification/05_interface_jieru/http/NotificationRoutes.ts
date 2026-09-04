import type { ModuleContext } from '../../../../bootstrap/ModuleRegistry';
import { AUDIT_SINK } from '../../../../foundation/application/AuditSink';
import { ModuleOperations } from '../../../../foundation/application/ModuleOperations';
import { KMS_CLIENT } from '../../../../foundation/infrastructure/KmsClient';
import { DATABASE_POOL } from '../../../../foundation/persistence/Pool';
import { changePreferenceOperations } from '../../03_application_yingyong/command/ChangePreference';
import { saveAnnouncementOperations } from '../../03_application_yingyong/command/SaveAnnouncement';
import { saveTemplateOperations } from '../../03_application_yingyong/command/SaveTemplate';
import { getAnnouncementOperations } from '../../03_application_yingyong/query/GetAnnouncements';
import { getNotificationsOperations } from '../../03_application_yingyong/query/GetNotifications';
import { getTemplateOperations } from '../../03_application_yingyong/query/GetTemplates';
import { PgNotificationRepository } from '../../04_adapters_shixian/persistence/PgNotificationRepository';

export function notificationRoutes(context: ModuleContext): ModuleOperations {
  const pool = context.container.get(DATABASE_POOL); const kms = context.container.get(KMS_CLIENT);
  const repositories = (database: ConstructorParameters<typeof PgNotificationRepository>[0]) => new PgNotificationRepository(database);
  return new ModuleOperations('notification', pool, context.container.get(AUDIT_SINK), {
    ...getNotificationsOperations(repositories), ...changePreferenceOperations(kms, pool, repositories),
    ...getTemplateOperations(repositories), ...saveTemplateOperations(repositories),
    ...getAnnouncementOperations(repositories), ...saveAnnouncementOperations(repositories),
  });
}
