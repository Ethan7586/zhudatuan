import { describe, expect, it } from 'vitest';
import type { NavigationInvalidation } from '../infrastructure/cache/NavigationInvalidator';
import { NavigationEventHandler } from '../interface/event/NavigationEventHandler';

describe('NavigationEventHandler', () => {
  it('uses the authenticated envelope scope when the payload omits scopeId', async () => {
    let received: NavigationInvalidation | undefined;
    const handler = new NavigationEventHandler({
      invalidate: async (value) => {
        received = value;
        return true;
      },
      lastEventAt: () => null,
    });

    await expect(handler.handle({ id: 'event:one', type: 'membership.updated', scope: 'tenant:one', payload: {} })).resolves.toBe(true);
    expect(received).toEqual({ event: 'event:one', scope: 'tenant:one' });
  });

  it('rejects a payload scope that conflicts with the authenticated envelope', () => {
    const handler = new NavigationEventHandler({ invalidate: async () => true, lastEventAt: () => null });

    expect(() => handler.handle({ id: 'event:two', type: 'membership.updated', scope: 'tenant:one', payload: { scopeId: 'tenant:two' } })).toThrow('NAVIGATION_EVENT_SCOPE_MISMATCH');
  });
});
