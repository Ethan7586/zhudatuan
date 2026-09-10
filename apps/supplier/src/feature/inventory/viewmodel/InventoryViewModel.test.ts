import { expect, it } from 'vitest';
import { inventoryViewModel } from './InventoryViewModel';
it('binds inventory', () => expect(inventoryViewModel.routes).toEqual(['supplierinventory']));
