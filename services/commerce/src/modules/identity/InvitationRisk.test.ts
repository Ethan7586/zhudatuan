import { describe, expect, it, vi } from 'vitest';
import type { PoolClient, QueryResult } from 'pg';
import type { DatabasePool } from '../../foundation/persistence/Pool';
import { InvitationCode } from './domain/model/InvitationCode';
import { FederationProtector } from './domain/service/FederationProtector';
import { PgInvitationRate } from './infrastructure/security/PgInvitationRate';
import { InvitationGuard } from './application/service/InvitationGuard';
import type { OperationRequest } from '../../foundation/application/OperationExecution';

const code = InvitationCode.issue(Buffer.alloc(20, 7));

describe('invitation public risk boundary', () => {
  it('evaluates risk and consumes independent code, device and network windows before lookup', async () => {
    let consumed: unknown;
    const rates = {
      consume: vi.fn(async (value) => {
        consumed = value;
      }),
    };
    const risk = { evaluate: vi.fn(async () => ({ outcome: 'allow' as const, safeReason: 'policy' as const, decision: null })) };
    const guard = new InvitationGuard(rates, risk, new FederationProtector('session-test-secret-value-at-least-thirty-two-bytes'));
    const request = {
      type: 'identity.sessions.create',
      security: { kind: 'anonymous', channel: 'public', target: 'console', trace: 'trace:risk' },
      input: {
        path: {},
        query: {},
        headers: { 'x-client-target': 'console', 'x-device-id': 'device:one', 'x-peer-address': '203.0.113.10', 'user-agent': 'browser' },
        body: { method: 'invitation', code: code.display(), target: 'console' },
        rawBody: '',
        deadline: Date.now() + 1000,
        signal: new AbortController().signal,
        idempotency: 'risk-key',
        publicActor: `public:${'a'.repeat(64)}`,
      },
    } satisfies OperationRequest;
    await guard.assert(request, 'console');
    const rules = (consumed as { rules: readonly { fingerprint: string; bucket: string; maximum: number; windowSeconds: number }[] }).rules;
    expect(rules).toHaveLength(3);
    expect(new Set(rules.map(({ bucket }) => bucket)).size).toBe(3);
    expect(rules.every(({ fingerprint, bucket }) => /^[0-9a-f]{64}$/.test(fingerprint) && /^[0-9a-f]{64}$/.test(bucket))).toBe(true);
    expect(JSON.stringify(consumed)).not.toContain(code.display());
    expect(JSON.stringify(consumed)).not.toContain('device:one');
    expect(risk.evaluate).toHaveBeenCalledWith(expect.objectContaining({ signals: { 'invitation.code': 1, 'invitation.device': 1, 'invitation.network': 1 } }));
  });

  it('commits allowed counters and rolls back a rejected atomic window update', async () => {
    const statements: string[] = [];
    let failures = 1;
    const client = {
      query: vi.fn(async (text: string) => {
        statements.push(text);
        return { rows: text.includes('returning failures') ? [{ failures }] : [], rowCount: 0 } as unknown as QueryResult;
      }),
      release: vi.fn(),
    } as unknown as PoolClient;
    const pool: DatabasePool = { connect: async () => client, query: async () => ({ rows: [], rowCount: 0 }) as unknown as QueryResult, workload: () => pool, end: async () => undefined };
    const metrics = { count: vi.fn() };
    const limiter = new PgInvitationRate(pool, { metrics } as never);
    const input = {
      operation: 'identity.sessions.create',
      actor: `public:${'a'.repeat(64)}`,
      trace: 'trace:rate',
      rules: [
        {
          fingerprint: 'b'.repeat(64),
          bucket: 'c'.repeat(64),
          maximum: 2,
          windowSeconds: 900,
        },
      ],
    };
    await expect(limiter.consume(input)).resolves.toBeUndefined();
    expect(statements).toContain('commit');
    statements.length = 0;
    failures = 3;
    await expect(limiter.consume(input)).rejects.toMatchObject({ code: 'RATE_LIMITED' });
    expect(statements).toContain('rollback');
    expect(metrics.count).toHaveBeenCalledWith('identity_invitation_rate_limited_total', 1, expect.objectContaining({ result: 'denied' }));
  });
});
