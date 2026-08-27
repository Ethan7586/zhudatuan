import { COMMERCE_EVENTS, CONTRACT_CHECKSUM, OperationCatalog } from '@shop/contract';
import { describe, expect, it } from 'vitest';
import type { DatabasePool } from '../foundation/persistence/Pool';
import type { ExtensionRegistry } from './ExtensionRegistry';
import { runtimeCompatibility } from './RuntimeCompatibility';

function pool(state: Readonly<Record<string, unknown>>): DatabasePool {
  return { connect: async () => ({
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
      operations: OperationCatalog.all().length,
      capabilities: OperationCatalog.all().length,
      events: COMMERCE_EVENTS.length,
    }), extensions('degraded'));
    expect(state.healthy).toBe(false);
  });
});
