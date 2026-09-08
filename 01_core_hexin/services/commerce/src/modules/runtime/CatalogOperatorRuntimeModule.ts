import { defineSelectedModule } from '../../bootstrap/DefinedModule';
import { CATALOG_OPERATOR_RUNTIME_OPERATION_IDS, catalogOperatorRuntimeOperations } from './CatalogOperatorRuntimeOperations';

export const CatalogOperatorRuntimeModule = defineSelectedModule(
  'runtime', CATALOG_OPERATOR_RUNTIME_OPERATION_IDS, catalogOperatorRuntimeOperations,
);
