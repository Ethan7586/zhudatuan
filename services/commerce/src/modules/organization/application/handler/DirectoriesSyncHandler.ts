import { randomUUID } from 'node:crypto';
import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import { DomainError } from '../../../../foundation/domain/DomainError';
import type { WriteHandlerContext } from '../../../../foundation/application/HandlerContext';
import type { JobScheduler } from '../../../../foundation/application/JobScheduler';
import type { OperationHandler, OperationReply } from '../../../../foundation/application/OperationHandler';
import { bodyRecord } from '../../../../foundation/interface/Validation';
import { requireSession } from '../../../../foundation/security/OperationSecurityContext';
import type { OrganizationRepository } from '../port/OrganizationRepository';
export class DirectoriesSyncHandler implements OperationHandler<'organization.directories.sync', 'write'> {
  readonly operation = 'organization.directories.sync' as const;
  readonly mode = 'write' as const;
  constructor(
    private readonly organizations: OrganizationRepository,
    private readonly jobs: JobScheduler
  ) {}
  async execute(input: OperationInputFor<'organization.directories.sync'>, context: WriteHandlerContext<'organization.directories.sync'>): Promise<OperationReply<OperationOutputFor<'organization.directories.sync'>>> {
    requireSession(context.security);
    const id = input.path.directoryid;
    const connection = await this.organizations.lockDirectory(context.transaction, id);
    if (!connection.synchronizable()) throw new Error('DIRECTORY_PROVIDER_DISABLED');
    const mode = syncMode(bodyRecord(input).mode);
    const run = await this.organizations.createRun(context.transaction, id, mode, context.idempotencyKey ?? context.requestId);
    await this.jobs.schedule(context.transaction, { id: `job:${randomUUID()}`, kind: 'directorysync', owner: 'organization', scope: id, payload: { resource: id, connection: id, run: run.id }, priority: 20 });
    return { status: 202, body: { id: run.id, state: run.state, mode } };
  }
}
function syncMode(value: unknown): 'full' | 'incremental' {
  const mode = value ?? 'incremental';
  if (mode !== 'full' && mode !== 'incremental') throw new DomainError('VALIDATION_FAILED');
  return mode;
}
