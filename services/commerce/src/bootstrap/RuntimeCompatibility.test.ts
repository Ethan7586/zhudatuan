import { COMMERCE_EVENTS, CONTRACT_CHECKSUM, OperationCatalog } from '@shop/contract';
import { describe, expect, it } from 'vitest';
import type { DatabasePool } from '../foundation/persistence/Pool';
import type { ExtensionRegistry } from './ExtensionRegistry';
import { assertRuntimeCompatibility, runtimeCompatibility } from './RuntimeCompatibility';

function pool(state: Readonly<Record<string, unknown>>, boundary = databaseBoundary('shopjob')): DatabasePool {
  return { query: async (statement: string) => statement.includes('deployment.runtime_database_boundary')
    ? { rows: [boundary], rowCount: 1 }
    : { rows: [], rowCount: 0 }, connect: async () => ({
    query: async (statement: string) => statement.startsWith('select not pg_is_in_recovery')
      ? { rows: [state], rowCount: 1 }
      : { rows: [], rowCount: 0 },
    release: () => undefined,
  }) } as unknown as DatabasePool;
}

function extensions(state: 'healthy' | 'degraded' = 'healthy'): ExtensionRegistry {
  return {
    healthAll: async () => Object.freeze([{ provider: 'jdproduct', scope: 'mall:1', state, checkedAt: '2026-08-21T00:00:00.000Z' }]),
  } as unknown as ExtensionRegistry;
}

describe('runtime compatibility', () => {
  it('accepts only the exact generated contract and all runtime registries', async () => {
    const state = await runtimeCompatibility(pool({
      writable: true,
      schema: true,
      contract: true,
      scope_resolver: true,
      operations: OperationCatalog.all().length,
      capabilities: OperationCatalog.all().length,
      events: COMMERCE_EVENTS.length,
    }), extensions());
    expect(state.healthy).toBe(true);
    expect(state.contract).toEqual({ checksum: CONTRACT_CHECKSUM, matches: true });
    expect(state.registries.jobs).toBeGreaterThan(0);
  });

  it('fails closed when an enabled extension is degraded', async () => {
    const state = await runtimeCompatibility(pool({
      writable: true,
      schema: true,
      contract: true,
      scope_resolver: true,
      operations: OperationCatalog.all().length,
      capabilities: OperationCatalog.all().length,
      events: COMMERCE_EVENTS.length,
    }), extensions('degraded'));
    expect(state.healthy).toBe(false);
  });

  it('fails closed when the target schema is missing', async () => {
    const state = await runtimeCompatibility(pool({
      writable: true,
      schema: false,
      contract: true,
      scope_resolver: true,
      operations: OperationCatalog.all().length,
      capabilities: OperationCatalog.all().length,
      events: COMMERCE_EVENTS.length,
    }), extensions());
    expect(state.healthy).toBe(false);
  });

  it('requires an available cache for jobs without changing API degradation semantics', async () => {
    const database = pool({
      writable: true,
      schema: true,
      contract: true,
      scope_resolver: true,
      operations: OperationCatalog.all().length,
      capabilities: OperationCatalog.all().length,
      events: COMMERCE_EVENTS.length,
    });
    await expect(runtimeCompatibility(database, extensions(), 'jobs', { available: false, reason: 'ECONNREFUSED' }))
      .resolves.toMatchObject({ healthy: false, cache: { available: false, reason: 'ECONNREFUSED' } });
    await expect(runtimeCompatibility(database, extensions(), 'jobs', { available: true }))
      .resolves.toMatchObject({ healthy: true, cache: { available: true } });
    await expect(runtimeCompatibility(database, extensions(), 'api', { available: false, reason: 'ECONNREFUSED' }))
      .resolves.toMatchObject({ healthy: true });
  });

  it('fails closed when the four-argument scope resolver is missing', async () => {
    const state = await runtimeCompatibility(pool({
      writable: true,
      schema: true,
      contract: true,
      scope_resolver: false,
      operations: OperationCatalog.all().length,
      capabilities: OperationCatalog.all().length,
      events: COMMERCE_EVENTS.length,
    }), extensions());
    expect(state.healthy).toBe(false);
  });

  it('requires the retired database boundary before full Jobs can start', async () => {
    const database = pool({
      writable: true,
      schema: true,
      contract: true,
      scope_resolver: true,
      operations: OperationCatalog.all().length,
      capabilities: OperationCatalog.all().length,
      events: COMMERCE_EVENTS.length,
    });
    await expect(assertRuntimeCompatibility(database, extensions(), 'jobs', { available: true }))
      .resolves.toMatchObject({ healthy: true });
    const unretired = pool({
      writable: true,
      schema: true,
      contract: true,
      scope_resolver: true,
      operations: OperationCatalog.all().length,
      capabilities: OperationCatalog.all().length,
      events: COMMERCE_EVENTS.length,
    }, { ...databaseBoundary('shopjob'), retired_membership_count: 1 });
    await expect(assertRuntimeCompatibility(unretired, extensions(), 'jobs', { available: true }))
      .rejects.toThrow('LIVE_DATABASE_BOUNDARY_ASSERTION_FAILED');
  });
});

function databaseBoundary(current_user: string) {
  return {
    current_user, current_database: 'zhudatuan_registration', active_platform_owner_count: 1, migration_head_valid: true,
    retired_roles_valid: true, business_roles_valid: true, runtime_roles_valid: true, boundary_roles_valid: true, retired_membership_count: 0,
    registration_boundary_owner: 'zhudatuanregistrationboundary', migration_boundary_owner: 'zhudatuanregistrationboundary',
    runtime_boundary_owner: 'zhudatuanregistrationboundary', database_owner: 'shopmigration',
  };
}
