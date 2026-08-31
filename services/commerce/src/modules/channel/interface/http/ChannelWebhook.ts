import type { ModuleContext } from '../../../../bootstrap/ModuleRegistry';
import type { AuditSink } from '../../../../foundation/application/AuditSink';
import type { KmsClient } from '../../../../foundation/infrastructure/KmsClient';
import type { DatabasePool } from '../../../../foundation/persistence/Pool';
import { ApplyWebhook } from '../../application/command/ApplyWebhook';

export function channelWebhook(context: ModuleContext, pool: DatabasePool, kms: KmsClient, audit: AuditSink): ApplyWebhook {
  void context;
  return new ApplyWebhook(pool.workload('command'), kms, audit);
}
