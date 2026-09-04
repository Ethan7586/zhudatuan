import { defineSelectedModule } from '../../bootstrap/DefinedModule';
import { CATALOG_OPERATOR_READ_OPERATION_IDS, catalogOperatorReadOperations } from './CatalogReadOperations';

export const IdentityOperatorCatalogModule = defineSelectedModule(
  'catalog', CATALOG_OPERATOR_READ_OPERATION_IDS, catalogOperatorReadOperations, ['identity'],
);
