import { expect, it } from 'vitest'; import { orderViewModel } from './OrderViewModel';
it('binds orders', () => expect(orderViewModel.routes).toEqual(['supplierorders']));
