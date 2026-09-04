import { describe, expect, it } from 'vitest';
import {
  WEB_BUSINESS_MODULES,
  WEB_BUSINESS_OPERATION_IDS,
  webBusinessManifest,
} from '.';

describe('webbusiness composition manifest', () => {
  it('keeps selected operations attached to their canonical domains', () => {
    expect(webBusinessManifest).toMatchObject({
      id: 'webbusiness',
      kind: 'composition',
      publicEntry: './index.ts',
      operations: WEB_BUSINESS_OPERATION_IDS,
    });
    expect(WEB_BUSINESS_MODULES.map(({ id }) => id)).toEqual([
      'organization',
      'member',
      'catalog',
      'pricing',
      'inventory',
      'reporting',
      'cart',
      'order',
      'benefit',
    ]);
    expect(WEB_BUSINESS_MODULES.some(({ id }) => id === webBusinessManifest.id)).toBe(false);
  });
});
