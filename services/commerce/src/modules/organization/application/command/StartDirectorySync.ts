import { DomainError } from '../../../../foundation/domain/DomainError';
import type { OperationAction } from '../../../../foundation/application/ModuleOperations';
import { requireAccess } from '../../../../foundation/application/ModuleOperations';
import { bodyRecord } from '../../../../foundation/interface/Validation';
import type { DirectoryRepository } from '../port/DirectoryRepository';
import type { DirectoryJobPort } from '../port/DirectoryJobPort';

export class StartDirectorySync {
  constructor(
    private readonly repository: DirectoryRepository,
    private readonly jobs: DirectoryJobPort
  ) {}
  action(): OperationAction {
    return async (request, database) => {
      requireAccess(request);
      const id = request.input.path.directoryid;
      if (!id) throw new DomainError('VALIDATION_FAILED');
      const connection = await this.repository.require(database, id, true);
      if (!connection.synchronizable()) throw new Error('DIRECTORY_PROVIDER_DISABLED');
      const body = bodyRecord(request);
      const mode = (body.mode ?? 'incremental') as 'full' | 'incremental';
      if (!['full', 'incremental'].includes(mode)) throw new DomainError('VALIDATION_FAILED');
      const run = await this.repository.createRun(database, id, mode, request.input.idempotency!);
      await this.jobs.enqueue(database, id, run.id, 'directorysync');
      return { status: 202, body: { id: run.id, state: run.state, mode: run.mode } };
    };
  }
}
