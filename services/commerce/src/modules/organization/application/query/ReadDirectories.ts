import type { OperationAction } from '../../../../foundation/application/ModuleOperations';
import { requireAccess } from '../../../../foundation/application/ModuleOperations';
import { keysetRows, queryPage } from '../../../../foundation/interface/Validation';
import type { DirectoryRepository } from '../port/DirectoryRepository';
export class ReadDirectories {
  constructor(private readonly repository: DirectoryRepository) {}
  action(): OperationAction {
    return async (request, database) => {
      const access = requireAccess(request);
      const page = queryPage(request);
      const rows = await this.repository.list(database, access.scope.id, page.id, page.fetch);
      return keysetRows(rows, page, 'id');
    };
  }
}
