import type { ModuleContext } from '../../../../bootstrap/ModuleRegistry';
import type { AuditSink } from '../../../../foundation/application/AuditSink';
import type { KmsClient } from '../../../../foundation/infrastructure/KmsClient';
import type { DatabasePool } from '../../../../foundation/persistence/Pool';
import { ApplyWebhook } from '../../application/command/ApplyWebhook';
import { ExtensionWebhookResolver } from '../../infrastructure/adapter/ExtensionWebhookResolver';

export function channelWebhook(context: ModuleContext, pool: DatabasePool, kms: KmsClient, audit: AuditSink): ApplyWebhook {
  return new ApplyWebhook(pool.workload('command'), kms, new ExtensionWebhookResolver(context.extensions), audit);
}
