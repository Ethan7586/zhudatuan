import type { OperationRequest, OperationResult } from '../../../../foundation/application/OperationExecution';
import type { OperationDatabase } from '../../../../foundation/application/ModuleOperations';
import { requireAccess } from '../../../../foundation/application/ModuleOperations';
import { keysetRows, queryPage } from '../../../../foundation/interface/Validation';
import type { AccessRepository } from '../port/AccessRepository';

export class ReadAccessCenter {
  constructor(private readonly repository: AccessRepository) {}
  async execute(request: OperationRequest, database: OperationDatabase): Promise<OperationResult> {
    const access = requireAccess(request);
    const page = queryPage(request);
    const rows = await this.repository.center(database, { organization: access.scope.id, after: page.id, limit: page.fetch });
    return keysetRows(
      rows.map((row) => Object.freeze({ id: row.id, client: row.client, status: row.status, access_version: row.accessVersion, roles: row.roles, scopes: row.scopes, overrides: row.overrides })),
      page,
      'id'
    );
  }
}
