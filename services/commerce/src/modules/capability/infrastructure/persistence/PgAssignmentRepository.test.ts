import type { QueryResult } from 'pg';
import { describe, expect, it } from 'vitest';
import { withWriteTransaction } from '../../../../test/TransactionFixture';
import { CapabilitySet } from '../../domain/model/CapabilitySet';
import { Entitlement } from '../../domain/model/Entitlement';
import { PgAssignmentRepository } from './PgAssignmentRepository';

describe('capability assignment persistence', () => {
  it('conditions both entitlement and capability-set versions, appends history and emits navigation invalidation', async () => {
    const statements: Array<Readonly<{ sql: string; values: readonly unknown[] }>> = [];
    const at = new Date('2026-09-04T03:00:00.000Z');
    const current = new Entitlement({ id: 'entitlement:one', scope: 'mall:one', capability: 'voucher.lifecycle', state: 'enabled', quota: 20, effectiveAt: at, expiresAt: null, version: 2 });
    const change = new CapabilitySet('mall:one', 7, 'enterprise:one', 4).change(
      current,
      { id: current.id, capability: current.capability, state: 'disabled', quota: 20, expiresAt: null },
      new Date('2026-09-04T04:00:00.000Z'),
      { operations: 19, dependentCapabilities: 1 }
    );
    const query = async (sql: string, values: readonly unknown[] = []) => {
      statements.push({ sql, values });
      if (sql.startsWith('insert into capability.entitlement(')) {
        return row({ id: 'entitlement:one', scope_id: 'mall:one', capability_id: 'voucher.lifecycle', state: 'disabled', quota: 20, effective_at: '2026-09-04T04:00:00.000Z', expires_at: null, version: 3 });
      }
      if (sql.startsWith('update capability.capabilityset')) return row({ version: 8 });
      if (sql.startsWith('with effective as materialized')) {
        return row({
          id: 'entitlement:one', scope_id: 'mall:one', capability_id: 'voucher.lifecycle', name: '卡券完整生命周期', kind: 'feature',
          state: 'disabled', configured_state: 'disabled', inherited_from: null, quota: 20, effective_at: '2026-09-04T04:00:00.000Z', expires_at: null,
          version: 3, capability_version: 18, dependency_healthy: true, disabled_reason: 'explicitdisabled', dependencies: [], operations: 19, dependent_capabilities: 1,
        });
      }
      return { rows: [], rowCount: 1 } as unknown as QueryResult;
    };

    const result = await withWriteTransaction(query, (context) => new PgAssignmentRepository().save(context, change, {
      expectedSetVersion: 7,
      actor: 'membership:owner',
      reason: '暂停卡券入口',
      trace: 'trace:capability',
      descendants: 4,
    }));

    expect(result).toMatchObject({ state: 'disabled', version: 3, capabilityVersion: 18, disabledReason: 'explicitdisabled' });
    const entitlementWrite = statements.find(({ sql }) => sql.startsWith('insert into capability.entitlement('));
    expect(entitlementWrite?.sql).toContain('capability.entitlement.version=$8');
    expect(entitlementWrite?.values[7]).toBe(2);
    expect(statements.some(({ sql }) => sql.startsWith('insert into capability.entitlementhistory'))).toBe(true);
    const setWrite = statements.find(({ sql }) => sql.startsWith('update capability.capabilityset'));
    expect(setWrite?.values).toEqual(['mall:one', 7]);
    const event = statements.find(({ sql }) => sql.includes('insert into runtime.outbox'));
    expect(event?.values[1]).toBe('capability.changed');
    expect(event?.values[4]).toBe('mall:one');
    expect(JSON.parse(String(event?.values[6]))).toEqual({ scopeId: 'mall:one', capability: 'voucher.lifecycle', state: 'disabled', version: 18 });
  });
});

function row(value: Readonly<Record<string, unknown>>): QueryResult {
  return { rows: [value], rowCount: 1 } as unknown as QueryResult;
}
