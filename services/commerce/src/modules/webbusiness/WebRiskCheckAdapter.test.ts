import { describe, expect, it } from 'vitest';
import type { DatabasePool } from '../../foundation/persistence/Pool';
import { WebRiskCheckAdapter } from './WebRiskCheckAdapter';

describe('WebRiskCheckAdapter', () => {
  it('enforces canonical deny policy without risk-domain writes or outbox access', async () => {
    const statements: string[] = [];
    const client = {
      query: async (sql: string) => {
        statements.push(sql);
        if (sql.includes('closure.ancestor_id')) return result([{ id: 'mall:one' }, { id: 'tenant:one' }]);
        if (sql.includes('from risk.policy policy')) return result([{
          id: 'policy:web',
          activeVersion: 1,
          activeRule: { denyOperations: ['catalog.listings.read'] },
          activeRollout: 100,
          baselineVersion: null,
          baselineRule: null,
        }]);
        if (sql.includes('from risk.signal')) return result([]);
        if (sql.includes('from risk.listentry')) return result([{ blocked: false }]);
        if (sql.includes('from unnest')) return result([{ seconds: 3600, count: 0 }]);
        return result([]);
      },
      release: () => undefined,
    };
    const pool = { connect: async () => client } as unknown as DatabasePool;
    const assessment = await new WebRiskCheckAdapter(pool).evaluate({
      actor: {
        id: 'principal:one',
        session: 'session:one',
        membership: 'membership:one',
        credentialVersion: 1,
        accessVersion: 1,
        target: 'storefront',
        assurance: { level: 1 },
      },
      operation: 'catalog.listings.read',
      scope: { kind: 'mall', id: 'mall:one', tenant: 'tenant:one', path: [] },
      trace: 'trace:one',
    });
    expect(assessment).toEqual({ outcome: 'deny', safeReason: 'policy', decision: null });
    expect(statements.some((sql) => /\b(insert|update|delete)\b/i.test(sql))).toBe(false);
    expect(statements.some((sql) => sql.includes('runtime.outbox'))).toBe(false);
    expect(statements.some((sql) => sql.includes('access.decisionaudit decision'))).toBe(true);
    expect(statements.some((sql) => sql.includes('risk.decision decision'))).toBe(false);
    expect(statements[0]).toBe('begin read only');
    expect(statements.at(-1)).toBe('commit');
  });

  it('fails closed when risk policy reads fail', async () => {
    const client = {
      query: async (sql: string) => {
        if (sql === 'rollback') return result([]);
        if (sql.includes('from risk.policy policy')) throw new Error('RISK_DATABASE_UNAVAILABLE');
        return result([]);
      },
      release: () => undefined,
    };
    const pool = { connect: async () => client } as unknown as DatabasePool;
    await expect(new WebRiskCheckAdapter(pool).evaluate({
      actor: {
        id: 'principal:one', session: 'session:one', membership: 'membership:one',
        credentialVersion: 1, accessVersion: 1, target: 'storefront', assurance: { level: 1 },
      },
      operation: 'catalog.listings.read',
      scope: { kind: 'mall', id: 'mall:one', path: [] },
      trace: 'trace:one',
    })).rejects.toThrow('RISK_DATABASE_UNAVAILABLE');
  });

  it('counts the current attempt when applying a velocity maximum', async () => {
    const client = {
      query: async (sql: string) => {
        if (sql.includes('closure.ancestor_id')) return result([{ id: 'mall:one' }]);
        if (sql.includes('from risk.policy policy')) return result([{
          id: 'policy:velocity', activeVersion: 1,
          activeRule: { velocity: { windowSeconds: 60, maximum: 1, outcome: 'deny' } },
          activeRollout: 100, baselineVersion: null, baselineRule: null,
        }]);
        if (sql.includes('from risk.signal')) return result([]);
        if (sql.includes('from risk.listentry')) return result([{ blocked: false }]);
        if (sql.includes('from unnest')) return result([{ seconds: 60, count: 1 }]);
        return result([]);
      },
      release: () => undefined,
    };
    const pool = { connect: async () => client } as unknown as DatabasePool;
    await expect(new WebRiskCheckAdapter(pool).evaluate({
      actor: {
        id: 'principal:one', session: 'session:one', membership: 'membership:one',
        credentialVersion: 1, accessVersion: 1, target: 'storefront', assurance: { level: 1 },
      },
      operation: 'cart.current.read',
      scope: { kind: 'owner', id: 'member:one', path: [] },
      trace: 'trace:velocity',
    })).resolves.toEqual({ outcome: 'deny', safeReason: 'velocity', decision: null });
  });
});

function result(rows: readonly unknown[]) {
  return { rows, rowCount: rows.length, command: '', oid: 0, fields: [] };
}
