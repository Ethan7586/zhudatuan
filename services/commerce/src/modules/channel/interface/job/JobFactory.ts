import { PgTransactionManager } from '../../../../platform/database/PgTransactionManager';
import { PgDeadletterStore } from '../../../../platform/database/PgDeadletterStore';
import { EXTENSION_REGISTRY } from '../../../../composition/ExtensionRegistry';
import type { ModuleContext } from '../../../../composition/ModuleRegistry';
import type { ModuleJob } from '../../../../pipeline/ModuleJob';
import { KMS_CLIENT } from '../../../../pipeline/KmsPort';
import { DATABASE_POOL } from '../../../../platform/database/Pool';
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
