import { PgTransactionManager } from '../../../../adapter/database/PgTransactionManager';
import { EXTENSION_REGISTRY } from '../../../../bootstrap/ExtensionRegistry';
import type { ModuleContext } from '../../../../bootstrap/ModuleRegistry';
import type { ModuleJob } from '../../../../foundation/application/ModuleJob';
import { KMS_CLIENT } from '../../../../foundation/infrastructure/KmsClient';
import { DATABASE_POOL } from '../../../../foundation/persistence/Pool';
import { ApplyChannelWebhook } from '../../application/process/ApplyChannelWebhook';
import { PgChannelWebhookRepository } from '../../infrastructure/persistence/PgChannelWebhookRepository';
import { ChannelWebhookJob } from './ChannelWebhookJob';

export function createProviderJobs(context: ModuleContext): readonly ModuleJob[] {
  return Object.freeze([
    {
      id: 'channelwebhook',
      processor: new ChannelWebhookJob(new ApplyChannelWebhook(new PgTransactionManager(context.service(DATABASE_POOL)), new PgChannelWebhookRepository(), context.service(EXTENSION_REGISTRY), context.service(KMS_CLIENT))),
    },
  ]);
}
