import type { OperationActions } from '../../../../foundation/application/ModuleOperations';
import { keysetRows,queryPage } from '../../../../foundation/interface/Validation';
import type { ExtensionRepositoryFactory } from '../../01_public_gongkai/ExtensionLoader';

export function getExtensions(repository:ExtensionRepositoryFactory):OperationActions {
  return { 'extension.installations.read':async(request,database)=>{
    const page=queryPage(request); const rows=await repository(database).list(page,page.fetch);
    return keysetRows(rows,page,'installed_at');
  } };
}
