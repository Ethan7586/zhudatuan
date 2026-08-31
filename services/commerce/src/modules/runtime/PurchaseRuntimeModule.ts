import { defineSelectedModule } from '../../bootstrap/DefinedModule';
import { PURCHASE_RUNTIME_OPERATION_IDS, purchaseRuntimeOperations } from './PurchaseRuntimeOperations';

export const PurchaseRuntimeModule = defineSelectedModule(
  'runtime', PURCHASE_RUNTIME_OPERATION_IDS, purchaseRuntimeOperations,
);
