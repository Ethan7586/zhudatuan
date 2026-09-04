import { expect, it } from 'vitest';
import { cartViewModel } from './CartViewModel';
it('binds the cart route', () => expect(cartViewModel.routes).toEqual(['miniappcart']));
