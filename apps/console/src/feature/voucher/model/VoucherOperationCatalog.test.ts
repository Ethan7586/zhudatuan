import { VOUCHER_OPERATION_IDS } from '@shop/contract/ids';
import { describe, expect, it } from 'vitest';
import { voucherOperations, voucherReadOperations } from './VoucherOperationCatalog';

describe('Voucher operation catalog', () => {
  it('classifies all 57 operations and gives every write one real form', () => {
    const reads = [...voucherReadOperations];
    const writes = Object.keys(voucherOperations);
    expect(reads).toHaveLength(23);
    expect(writes).toHaveLength(34);
    expect(new Set([...reads, ...writes])).toEqual(new Set(VOUCHER_OPERATION_IDS));
    expect(writes.some((operation) => voucherReadOperations.has(operation as never))).toBe(false);
  });
});
