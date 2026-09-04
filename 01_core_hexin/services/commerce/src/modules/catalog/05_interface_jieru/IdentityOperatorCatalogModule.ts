import { defineSelectedModule } from '../../../bootstrap/DefinedModule';
import { CATALOG_OPERATOR_READ_OPERATION_IDS, catalogOperatorReadOperations } from '../03_application_yingyong/CatalogReadOperations';

export const IdentityOperatorCatalogModule = defineSelectedModule(
  'catalog', CATALOG_OPERATOR_READ_OPERATION_IDS, catalogOperatorReadOperations, ['identity'],
);
