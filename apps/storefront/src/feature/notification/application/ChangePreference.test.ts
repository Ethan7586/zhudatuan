import { describe, expect, it, vi } from 'vitest';
import type { StorefrontSession } from '../../../entity/session';
import type { NotificationPreference } from '../model/NotificationPreference';
import { ChangePreference } from './ChangePreference';

const session = { membership: 'membership:one', scope: { kind: 'mall', id: 'mall:one' }, accessVersion: 1, csrfToken: 'csrf:one' } as const satisfies StorefrontSession;
const preference = Object.freeze({
  channel: 'wechat',
  eventType: 'order.created',
  providerTemplate: null,
  enabled: false,
  authorization: 'unknown',
  authorizedAt: null,
  consentSource: 'member',
  quietStart: null,
  quietEnd: null,
  quietTimezone: null,
  version: 1,
}) satisfies NotificationPreference;

describe('notification preference command', () => {
  it('never manufactures provider authorization from a member toggle', async () => {
    const changePreference = vi.fn().mockResolvedValue(undefined);
    await new ChangePreference({ changePreference }).execute(session, preference, { enabled: true });
    expect(changePreference.mock.calls[0]?.[2]).toEqual({ enabled: true, quietHours: null });
    expect(changePreference.mock.calls[0]?.[2]).not.toHaveProperty('authorization');
  });
});
