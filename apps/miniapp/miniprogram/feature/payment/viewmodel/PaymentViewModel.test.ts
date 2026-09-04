import { expect, it } from 'vitest';
import { paymentViewModel } from './PaymentViewModel';
it('binds the payment result route', () => expect(paymentViewModel.routes).toEqual(['miniapppayment']));
