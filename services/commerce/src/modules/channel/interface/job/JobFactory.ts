import { PgTransactionManager } from '../../../../adapter/database/PgTransactionManager';
import { PgDeadletterStore } from '../../../../adapter/database/PgDeadletterStore';
import { EXTENSION_REGISTRY } from '../../../../bootstrap/ExtensionRegistry';
import type { ModuleContext } from '../../../../bootstrap/ModuleRegistry';
import type { ModuleJob } from '../../../../foundation/application/ModuleJob';
import { KMS_CLIENT } from '../../../../foundation/application/KmsPort';
import { DATABASE_POOL } from '../../../../foundation/persistence/Pool';
import { ApplyChannelWebhook } from '../../application/process/ApplyChannelWebhook';
import { PgChannelWebhookRepository } from '../../infrastructure/persistence/PgChannelWebhookRepository';
import { PgChannelWebhookEventPort } from '../../infrastructure/persistence/PgChannelWebhookEventPort';
import { ChannelWebhookJob } from './ChannelWebhookJob';

export function createProviderJobs(context: ModuleContext): readonly ModuleJob[] {
  const webhook = new ApplyChannelWebhook(
    new PgTransactionManager(context.service(DATABASE_POOL)),
    new PgChannelWebhookRepository(),
    new PgChannelWebhookEventPort(),
    new PgDeadletterStore(),
    context.service(EXTENSION_REGISTRY),
    context.service(KMS_CLIENT)
  );
  const job = new ChannelWebhookJob(webhook);
  return Object.freeze([
    {
      id: 'channelwebhook',
      processor: job,
      deadletter: job,
    },
  ]);
}
