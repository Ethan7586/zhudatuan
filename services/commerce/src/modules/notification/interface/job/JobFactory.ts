import { PgTransactionManager } from '../../../../platform/database/PgTransactionManager';
import type { ModuleContext } from '../../../../composition/ModuleRegistry';
import type { ModuleJob } from '../../../../pipeline/ModuleJob';
import { KMS_CLIENT } from '../../../../pipeline/KmsPort';
import { DATABASE_POOL } from '../../../../platform/database/Pool';
import { NOTIFICATION_IDENTITY_PORT } from '../../../identity/public';
import { ORGANIZATION_READ_PORT } from '../../../organization/public';
import { NotificationDeliveryProcess } from '../../application/process/NotificationDeliveryProcess';
import { PgDeliveryRepository } from '../../infrastructure/persistence/PgDeliveryRepository';
import { DELIVERY_REGISTRY } from '../../infrastructure/registry/DeliveryRegistry';
import { IdentityNotificationJobProcessor, NotificationJobProcessor } from './NotificationJob';

export function createJobs(context: ModuleContext): readonly ModuleJob[] {
  const transactions = new PgTransactionManager(context.service(DATABASE_POOL));
  const process = new NotificationDeliveryProcess(
    transactions,
    new PgDeliveryRepository(context.ports.get(NOTIFICATION_IDENTITY_PORT), context.ports.get(ORGANIZATION_READ_PORT)),
    context.service(KMS_CLIENT),
    context.service(DELIVERY_REGISTRY)
  );
  return Object.freeze([
    { id: 'identitynotification', processor: new IdentityNotificationJobProcessor(process) },
    { id: 'notification', processor: new NotificationJobProcessor(process) },
  ]);
}
