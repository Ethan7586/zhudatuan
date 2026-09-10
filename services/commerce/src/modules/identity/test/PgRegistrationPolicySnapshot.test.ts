import { describe, expect, it, vi } from 'vitest';
import type { ExecutionContext } from '../../../pipeline/HandlerContext';
import type { DatabasePool } from '../../../platform/database/Pool';
import { PgRegistrationPolicySnapshot } from '../infrastructure/persistence/PgRegistrationPolicySnapshot';

const POLICY = Object.freeze({
  id: 'registration:one',
  terms_title: '服务协议',
  terms_body: '服务协议正文',
  privacy_title: '隐私政策',
  privacy_body: '隐私政策正文',
  terms_hash: 'a'.repeat(64),
});

describe('PgRegistrationPolicySnapshot', () => {
  it('coalesces concurrent reads and reuses the immutable release snapshot', async () => {
    let resolveQuery: ((value: unknown) => void) | undefined;
    const query = vi.fn(
      (_text: string, _values?: readonly unknown[]) =>
        new Promise((resolve) => {
          resolveQuery = resolve;
        })
    );
    const snapshot = new PgRegistrationPolicySnapshot(pool(query));

    const first = snapshot.current(execution());
    const second = snapshot.current(execution());
    resolveQuery?.({ rows: [{ ...POLICY, valid_until: null }] });

    await expect(Promise.all([first, second])).resolves.toEqual([POLICY, POLICY]);
    await expect(snapshot.current(execution())).resolves.toEqual(POLICY);
    expect(query).toHaveBeenCalledOnce();
    expect(String(query.mock.calls[0]?.[0])).toContain('request_context as materialized');
  });

  it('reloads when the active policy boundary has elapsed', async () => {
    let now = Date.parse('2026-09-11T00:00:00Z');
    const query = vi
      .fn()
      .mockResolvedValueOnce({ rows: [{ ...POLICY, valid_until: new Date(now + 1_000) }] })
      .mockResolvedValueOnce({ rows: [{ ...POLICY, id: 'registration:two', valid_until: null }] });
    const snapshot = new PgRegistrationPolicySnapshot(pool(query), () => now);

    await expect(snapshot.current(execution(now))).resolves.toMatchObject({ id: 'registration:one' });
    now += 1_001;
    await expect(snapshot.current(execution(now))).resolves.toMatchObject({ id: 'registration:two' });
    expect(query).toHaveBeenCalledTimes(2);
  });

  it('does not retain a failed load', async () => {
    const query = vi
      .fn()
      .mockRejectedValueOnce(new Error('temporary'))
      .mockResolvedValueOnce({ rows: [{ ...POLICY, valid_until: null }] });
    const snapshot = new PgRegistrationPolicySnapshot(pool(query));

    await expect(snapshot.current(execution())).rejects.toThrow('temporary');
    await expect(snapshot.current(execution())).resolves.toEqual(POLICY);
    expect(query).toHaveBeenCalledTimes(2);
  });
});

function pool(query: ReturnType<typeof vi.fn>): DatabasePool {
  const selected = { query } as unknown as DatabasePool;
  return { workload: vi.fn(() => selected) } as unknown as DatabasePool;
}

function execution(now = Date.now()): ExecutionContext<'identity.bootstrap.read'> {
  return {
    requestId: 'request:bootstrap',
    traceId: 'trace:bootstrap',
    deadline: now + 10_000,
    signal: new AbortController().signal,
    operation: 'identity.bootstrap.read',
    security: { kind: 'anonymous', channel: 'public', target: 'storefront', trace: 'trace:bootstrap' },
    headers: { 'x-client-target': 'storefront' },
    rawBody: '',
    publicActor: `public:${'b'.repeat(64)}`,
  };
}
