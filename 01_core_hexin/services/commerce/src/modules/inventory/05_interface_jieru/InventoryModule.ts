import { defineModule } from '../../../bootstrap/DefinedModule';
import { inventoryOperations } from '../03_application_yingyong/InventoryOperations';
export const InventoryModule = defineModule('inventory', ['catalog'], inventoryOperations);
export { InventoryPort, inventoryPort, type StockDemand } from '../01_public_gongkai/InventoryPort';
