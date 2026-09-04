import { randomUUID } from 'node:crypto';
import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import { DomainError } from '../../../../foundation/domain/DomainError';
import type { WriteHandlerContext } from '../../../../foundation/application/HandlerContext';
import type { JobScheduler } from '../../../../foundation/application/JobScheduler';
import type { OperationHandler, OperationReply } from '../../../../foundation/application/OperationHandler';
import { bodyRecord, textField } from '../../../../foundation/interface/Validation';
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
    const body = bodyRecord(input);
    const action = syncAction(body.action);
    if (action === 'cancel') {
      const run = await this.organizations.cancelRun(context.transaction, id, textField(body, 'run', 64));
      if (!run) throw new DomainError('VALIDATION_FAILED');
      await this.jobs.cancel(context.transaction, 'directorysync', String(run.id));
      return { status: 200, body: { id: String(run.id), state: 'cancelled', mode: syncMode(run.mode) } };
    }
    const run =
      action === 'resume'
        ? await this.organizations.resumeRun(context.transaction, id, textField(body, 'run', 64), context.idempotencyKey ?? context.requestId)
        : await this.organizations.createRun(context.transaction, id, syncMode(body.mode), context.idempotencyKey ?? context.requestId);
    if (!run) throw new DomainError('VALIDATION_FAILED');
    await this.jobs.schedule(context.transaction, { id: `job:${randomUUID()}`, kind: 'directorysync', owner: 'organization', scope: id, payload: { resource: id, connection: id, run: run.id }, priority: 20 });
    return { status: 202, body: { id: run.id, state: run.state, mode: syncMode(run.mode) } };
  }
}
function syncAction(value: unknown): 'start' | 'cancel' | 'resume' {
  if (value !== 'start' && value !== 'cancel' && value !== 'resume') throw new DomainError('VALIDATION_FAILED');
  return value;
}
function syncMode(value: unknown): 'full' | 'incremental' {
  const mode = value ?? 'incremental';
  if (mode !== 'full' && mode !== 'incremental') throw new DomainError('VALIDATION_FAILED');
  return mode;
}
