import { expect, it } from 'vitest';
import { voucherViewModel } from './VoucherViewModel';
it('binds voucher history', () => expect(voucherViewModel.routes).toEqual(['storevoucherswork']));
