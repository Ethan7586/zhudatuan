import { expect, it } from 'vitest';
import { orderViewModel } from './OrderViewModel';
it('binds order list and detail routes', () => expect(orderViewModel.routes).toEqual(['miniapporders', 'miniapporder']));
