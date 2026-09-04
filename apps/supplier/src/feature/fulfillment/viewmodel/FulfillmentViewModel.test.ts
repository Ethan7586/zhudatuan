import { expect, it } from 'vitest'; import { fulfillmentViewModel } from './FulfillmentViewModel';
it('binds shipments', () => expect(fulfillmentViewModel.routes).toEqual(['suppliershipments']));
