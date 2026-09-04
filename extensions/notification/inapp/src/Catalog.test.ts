import { describe, expect, it } from 'vitest';

import { InappCatalog, inappMiniappLink } from './Catalog';

describe('in-app notification catalog', () => {
  it('binds acknowledgement and allowlisted business deep links', () => {
    expect(InappCatalog.acknowledgement.operation).toBe('notification.notifications.ack');
    expect(inappMiniappLink({ route: 'orderdetail', id: 'order:one' })).toBe('/page/orderdetail/index?id=order%3Aone');
  });
});
