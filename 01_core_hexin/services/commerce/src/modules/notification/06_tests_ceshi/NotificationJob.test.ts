import { describe, expect, it, vi } from 'vitest';
import { IdentityNotificationJobProcessor } from '../05_interface_jieru/job/NotificationJob';

const challenge = 'challenge:00000000-0000-4000-8000-000000000001';

describe('identity notification job processor', () => {
  it('dispatches only the exact identity challenge payload', async () => {
    const dispatch = vi.fn(async () => undefined);
    const processor = new IdentityNotificationJobProcessor({ challenge: dispatch });
    await processor.process({ id: 'job:1', kind: 'identitynotification', scope_id: null, payload: { challenge }, attempts: 1 },
      new AbortController().signal);
    expect(dispatch).toHaveBeenCalledExactlyOnceWith(challenge);
  });

  it.each([
    ['generic notification kind', { id: 'job:1', kind: 'notification', scope_id: null, payload: { challenge }, attempts: 1 }],
    ['dispatch payload', { id: 'job:1', kind: 'identitynotification', scope_id: null, payload: { dispatch: 'dispatch:1' }, attempts: 1 }],
    ['mixed payload', { id: 'job:1', kind: 'identitynotification', scope_id: null, payload: { challenge, event: 'order.created' }, attempts: 1 }],
    ['untrusted challenge id', { id: 'job:1', kind: 'identitynotification', scope_id: null, payload: { challenge: 'challenge:../../payment' }, attempts: 1 }],
  ])('rejects %s', async (_label, job) => {
    const dispatch = vi.fn(async () => undefined);
    const processor = new IdentityNotificationJobProcessor({ challenge: dispatch });
    await expect(processor.process(job, new AbortController().signal)).rejects.toThrow();
    expect(dispatch).not.toHaveBeenCalled();
  });
});
