import { PgTransactionManager } from '../../../../adapter/database/PgTransactionManager';
import type { ModuleContext } from '../../../../bootstrap/ModuleRegistry';
import type { ModuleJob } from '../../../../foundation/application/ModuleJob';
import { OBJECT_STORE } from '../../../../foundation/infrastructure/ObjectStore';
import { DATABASE_POOL } from '../../../../foundation/persistence/Pool';
import { EVENT_STREAM } from '../../../../foundation/stream/EventStream';
import { EvaluateSla } from '../../application/process/EvaluateSla';
import { RelaySupportEvents } from '../../application/process/RelaySupportEvents';
import { RunSupportJob } from '../../application/process/RunSupportJob';
import { PgSupportJobRepository } from '../../infrastructure/persistence/PgSupportJobRepository';
import { RedisSupportStream } from '../../infrastructure/messaging/RedisSupportStream';
import { ObjectAttachmentScanner } from '../../infrastructure/security/ObjectAttachmentScanner';
import { SupportJob } from './SupportJob';
import { SupportReassignJob } from './SupportReassignJob';
import { OUTBOX_RELAY_PORT } from '../../../runtime/public';

export function createJobs(context: ModuleContext): readonly ModuleJob[] {
  const transactions = new PgTransactionManager(context.service(DATABASE_POOL));
  const objects = context.service(OBJECT_STORE);
  const repository = new PgSupportJobRepository();
  const processManager = new RunSupportJob(
    transactions,
    repository,
    new ObjectAttachmentScanner(objects),
    new EvaluateSla(transactions, repository),
    new RelaySupportEvents(transactions, context.ports.get(OUTBOX_RELAY_PORT), new RedisSupportStream(context.service(EVENT_STREAM)))
  );
  return Object.freeze([
    { id: 'supportsla', processor: new SupportJob('supportsla', processManager) },
    { id: 'supportscan', processor: new SupportJob('supportscan', processManager) },
    { id: 'supportrelay', processor: new SupportJob('supportrelay', processManager) },
    { id: 'supportreassign', processor: new SupportReassignJob(processManager) },
  ]);
}
