import { expect, it } from 'vitest';
import { voucherViewModel } from './VoucherViewModel';
it('binds the voucher route', () => expect(voucherViewModel.routes).toEqual(['miniappvouchers']));
