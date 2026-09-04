import { describe, expect, it } from 'vitest';
import type { OperationDatabase } from '../../foundation/application/ModuleOperations';
import { DisabledPurchaseVoucherGateway } from './DisabledPurchaseVoucherGateway';

describe('purchase-only voucher boundary', () => {
  const database = {} as OperationDatabase;

  it('permits empty preview and reserve without loading voucher state', async () => {
    const gateway = new DisabledPurchaseVoucherGateway();
    await expect(gateway.preview(database, [], 'member:one', 'mall:one')).resolves.toEqual([]);
    await expect(gateway.reserve(database, 'order:one', 'member:one', 'mall:one', [])).resolves.toBeUndefined();
  });

  it('rejects every voucher selection and consume attempt', async () => {
    const gateway = new DisabledPurchaseVoucherGateway();
    await expect(gateway.preview(database, ['voucher:one'], 'member:one', 'mall:one'))
      .rejects.toThrow('PURCHASE_VOUCHER_FORBIDDEN');
    await expect(gateway.reserve(database, 'order:one', 'member:one', 'mall:one', [
      { reference: 'voucher:one', amountMinor: 100 },
    ])).rejects.toThrow('PURCHASE_VOUCHER_FORBIDDEN');
    await expect(gateway.consume(database, 'order:one', 'member:one', 'voucher:one', 100))
      .rejects.toThrow('PURCHASE_VOUCHER_FORBIDDEN');
  });
});
