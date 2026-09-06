import { defineSelectedModule } from '../../../bootstrap/DefinedModule';
import { CATALOG_OPERATOR_OPERATION_IDS, catalogOperatorOperations } from '../03_application_yingyong/CatalogOperatorOperations';

export const IdentityOperatorCatalogModule = defineSelectedModule(
  'catalog', CATALOG_OPERATOR_OPERATION_IDS, catalogOperatorOperations, ['identity'],
);
