import { expect, it } from 'vitest';
import { fulfillmentViewModel } from './FulfillmentViewModel';
it('binds fulfillment', () => expect(fulfillmentViewModel.routes).toEqual(['storefulfillment']));
