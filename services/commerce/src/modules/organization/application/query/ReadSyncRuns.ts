import { DomainError } from '../../../../foundation/domain/DomainError';
import type { OperationAction } from '../../../../foundation/application/ModuleOperations';
import { requireAccess } from '../../../../foundation/application/ModuleOperations';
import { keysetRows, queryPage } from '../../../../foundation/interface/Validation';
import type { DirectoryRepository } from '../port/DirectoryRepository';
export class ReadSyncRuns {
  constructor(private readonly repository: DirectoryRepository) {}
  action(): OperationAction {
    return async (request, database) => {
      requireAccess(request);
      const connection = request.input.path.directoryid;
      if (!connection) throw new DomainError('VALIDATION_FAILED');
      await this.repository.require(database, connection);
      const page = queryPage(request);
      const rows = await this.repository.runs(database, connection, page.id, page.fetch);
      return keysetRows(rows, page, 'id');
    };
  }
}
