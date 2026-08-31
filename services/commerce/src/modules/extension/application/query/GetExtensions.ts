import { requireAccess, type OperationActions } from '../../../../foundation/application/ModuleOperations';
import { keysetRows, queryPage } from '../../../../foundation/interface/Validation';
import { organizationScope } from '../../../../foundation/security/OrganizationScope';
import type { OrganizationReadPort } from '../../../organization/public';
import type { ExtensionRepositoryFactory } from '../port/ExtensionLoader';

export function getExtensions(repository: ExtensionRepositoryFactory, organizations: OrganizationReadPort): OperationActions {
  return {
    'extension.installations.read': async (request, database) => {
      const page = queryPage(request);
      const scopes = await organizations.descendants(database, organizationScope(requireAccess(request).scope));
      const rows = await repository(database).list(scopes, page, page.fetch);
      return keysetRows(rows, page, 'installed_at');
    },
  };
}
