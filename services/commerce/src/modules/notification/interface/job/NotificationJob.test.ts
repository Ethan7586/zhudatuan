import { describe, expect, it, vi } from 'vitest';
import { IdentityNotificationJobProcessor } from './NotificationJob';

const challenge = 'challenge:00000000-0000-4000-8000-000000000001';
const authorization = Object.freeze({ kind: 'system', actor: 'test', scope: null, operation: 'test', source: 'jobs', capturedAt: new Date().toISOString() });

describe('identity notification job processor', () => {
  it('dispatches only the exact identity challenge payload', async () => {
    const dispatch = vi.fn(async () => undefined);
    const processor = new IdentityNotificationJobProcessor({ challenge: dispatch });
    await processor.process({ id: 'job:1', kind: 'identitynotification', scope: null, payload: { challenge }, authorization, attempts: 1, token: 1 }, new AbortController().signal);
    expect(dispatch).toHaveBeenCalledExactlyOnceWith(challenge, expect.objectContaining({ scope: 'identity', trace: 'job:1', signal: expect.any(AbortSignal), deadline: expect.any(Number) }));
  });

  it.each([
    ['generic notification kind', { id: 'job:1', kind: 'notification', scope: null, payload: { challenge }, authorization, attempts: 1, token: 1 }],
    ['dispatch payload', { id: 'job:1', kind: 'identitynotification', scope: null, payload: { dispatch: 'dispatch:1' }, authorization, attempts: 1, token: 1 }],
    ['mixed payload', { id: 'job:1', kind: 'identitynotification', scope: null, payload: { challenge, event: 'order.created' }, authorization, attempts: 1, token: 1 }],
    ['untrusted challenge id', { id: 'job:1', kind: 'identitynotification', scope: null, payload: { challenge: 'challenge:../../payment' }, authorization, attempts: 1, token: 1 }],
  ])('rejects %s', async (_label, job) => {
    const dispatch = vi.fn(async () => undefined);
    const processor = new IdentityNotificationJobProcessor({ challenge: dispatch });
    await expect(processor.process(job, new AbortController().signal)).rejects.toThrow();
    expect(dispatch).not.toHaveBeenCalled();
  });
});
