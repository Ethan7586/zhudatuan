import { describe, expect, it } from 'vitest';
import {
  PURCHASE_MODULES,
  PURCHASE_OPERATION_IDS,
  purchaseManifest,
} from '.';

describe('purchase composition manifest', () => {
  it('keeps operation ownership with checkout, order, and payment', () => {
    expect(purchaseManifest).toMatchObject({
      id: 'purchase',
      kind: 'composition',
      publicEntry: './index.ts',
      operations: PURCHASE_OPERATION_IDS,
    });
    expect(PURCHASE_MODULES.map(({ id }) => id)).toEqual(['checkout', 'order', 'payment']);
    expect(PURCHASE_MODULES.some(({ id }) => id === purchaseManifest.id)).toBe(false);
  });
});
