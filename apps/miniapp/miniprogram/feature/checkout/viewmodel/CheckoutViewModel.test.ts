import { expect, it } from 'vitest';
import { checkoutViewModel } from './CheckoutViewModel';
it('binds the checkout route', () => expect(checkoutViewModel.routes).toEqual(['miniappcheckout']));
