import { expect, it } from 'vitest';
import { orderViewModel } from './OrderViewModel';
it('binds order list and detail', () => expect(orderViewModel.routes).toEqual(['storeorderswork', 'storeorderwork']));
