import { COMMERCE_EVENTS } from '@shop/contract';
import type { PoolClient, QueryResult } from 'pg';
import { describe, expect, it } from 'vitest';
import { EVENT_HANDLERS, EVENT_SCHEMA_TYPES, eventVersion } from '../../src/app/events';
import type { DatabasePool } from '../../src/foundation/persistence/Pool';
import { RuntimeEventPublisher } from '../../src/adapter/messaging/RuntimeEventPublisher';
import type { OutboxMessage } from '../../src/foundation/messaging/Outbox';
import { EventRegistry } from '../../src/bootstrap/EventRegistry';

describe('event contract and replay', () => {
  it('has one exact runtime version and handler declaration for every event schema', () => {
    expect(EVENT_SCHEMA_TYPES).toEqual(COMMERCE_EVENTS.map(({ type }) => type));
    expect(new Set(EVENT_SCHEMA_TYPES).size).toBe(EVENT_SCHEMA_TYPES.length);
    for (const event of COMMERCE_EVENTS) {
      expect(eventVersion(event.type)).toBe(event.version);
      expect(EVENT_HANDLERS.has(event.type)).toBe(true);
    }
    expect(() => eventVersion('undeclared.event')).toThrow('EVENT_SCHEMA_UNKNOWN');
  });

  it('claims inbox idempotency before scheduling each declared consumer', async () => {
    const observed: string[] = [];
    const accepted = new Set<string>();
    const client = {
      query: async (text: string, values?: readonly unknown[]) => {
        observed.push(text.trim().split(/\s+/, 2).join(' '));
        if (text.includes('runtime.accept_inbox')) {
          const key = `${values?.[0]}:${values?.[1]}:${values?.[2]}`;
          const inserted = !accepted.has(key);
          accepted.add(key);
          return { rows: [{ inserted }], rowCount: 1 } as unknown as QueryResult;
        }
        return { rows: [], rowCount: text.includes('insert into runtime.job') ? 1 : null } as unknown as QueryResult;
      },
      release: () => observed.push('release'),
    } as unknown as PoolClient;
    const pool: DatabasePool = {
      connect: async () => client,
      query: async () => ({ rows: [], rowCount: 0 }) as unknown as QueryResult,
      workload: () => pool,
      end: async () => undefined,
    };
    const event = sampleEvent();
    const publisher = new RuntimeEventPublisher(pool, eventRegistry());
    await publisher.publish(event);
    await publisher.publish(event);
    expect(observed.filter((value) => value.startsWith('insert into'))).toHaveLength(EVENT_HANDLERS.get(event.event_type)!.length);
    expect(observed.filter((value) => value === 'commit')).toHaveLength(2);
    expect(observed).not.toContain('rollback');
  });

  it('rejects an unsupported event version before opening a transaction', async () => {
    const connect = async () => {
      throw new Error('DATABASE_MUST_NOT_BE_REACHED');
    };
    const pool: DatabasePool = { connect, query: async () => ({ rows: [], rowCount: 0 }) as unknown as QueryResult, workload: () => pool, end: async () => undefined };
    await expect(new RuntimeEventPublisher(pool, eventRegistry()).publish({ ...sampleEvent(), event_version: 999 })).rejects.toThrow('EVENT_VERSION_UNSUPPORTED');
  });
});

function sampleEvent(): OutboxMessage {
  return {
    id: 'event-contract',
    event_type: 'payment.captured',
    event_version: eventVersion('payment.captured'),
    aggregate_id: 'payment-contract',
    aggregate_version: 1,
    scope_id: 'mall-contract',
    actor_id: 'member-contract',
    correlation_id: 'correlation-contract',
    causation_id: 'command-contract',
    payload_version: 1,
    payload: {
      payment: 'payment-contract',
      order: 'order-contract',
      amountMinor: 100,
      currency: 'CNY',
      member: 'member-contract',
      snapshot: null,
    },
    trace_id: 'trace-contract',
    attempts: 1,
    fencing_token: 1,
  };
}

function eventRegistry(): EventRegistry {
  const registry = new EventRegistry();
  for (const [event, subscribers] of EVENT_HANDLERS) registry.register(event, subscribers);
  registry.freeze();
  return registry;
}
