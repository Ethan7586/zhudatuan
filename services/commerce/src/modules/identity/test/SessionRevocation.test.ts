import { describe, expect, it, vi } from 'vitest';
import { RevokeStaleSessions } from '../application/process/RevokeStaleSessions';
import { SessionRevocationJob } from '../interface/job/SessionRevocationJob';

describe('access version session revocation', () => {
  it('revokes stale sessions and completes the event inbox in one transaction', async () => {
    const revokeStale = vi.fn(async () => ['session:old']);
    const complete = vi.fn(async () => undefined);
    const write = vi.fn(async (_execution, work) => work({ transaction: 'one' }));
    const process = new RevokeStaleSessions({ write } as never, { complete } as never, { revokeStale } as never);
    const signal = new AbortController().signal;
    await process.execute('event:one', { membership: 'membership:one', version: 4, reason: 'ownertransferred' }, { scope: 'mall:one', trace: 'job:one', signal, deadline: 10_000 });
    expect(revokeStale).toHaveBeenCalledWith({ transaction: 'one' }, { membership: 'membership:one', version: 4, reason: 'ownertransferred', trace: 'job:one' });
    expect(complete).toHaveBeenCalledWith({ transaction: 'one' }, 'internal', 'job:sessionrevocation', 'event:one');
  });

  it('accepts only the declared access version event and matching scope', async () => {
    const execute = vi.fn(async () => undefined);
    const job = new SessionRevocationJob({ execute } as never);
    const signal = new AbortController().signal;
    await job.process(
      {
        id: 'job:one',
        kind: 'sessionrevocation',
        scope: 'mall:one',
        attempts: 0,
        payload: { eventId: 'event:one', event: 'access.version.changed', scopeId: 'mall:one', payload: { membership: 'membership:one', version: 4, reason: 'roleassigned' } },
      } as never,
      signal,
      20_000
    );
    expect(execute).toHaveBeenCalledWith('event:one', { membership: 'membership:one', version: 4, reason: 'roleassigned' }, { scope: 'mall:one', trace: 'job:one', signal, deadline: 20_000 });
  });
});
