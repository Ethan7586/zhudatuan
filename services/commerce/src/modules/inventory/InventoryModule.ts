import { defineModule } from '../../bootstrap/DefinedModule';
import { inventoryOperations } from './InventoryOperations';
export const InventoryModule = defineModule('inventory', ['catalog'], inventoryOperations);
export { InventoryPort, inventoryPort, type StockDemand } from './InventoryPort';
