import { COMMERCE_EVENTS } from '@shop/contract';
import type { PoolClient, QueryResult } from 'pg';
import { describe, expect, it } from 'vitest';
import { EVENT_SCHEMA_TYPES, eventVersion } from '../../src/generated/EventCatalog';
import { EVENT_SUBSCRIPTIONS } from '../../src/generated/EventSubscriptions';
import type { DatabasePool } from '../../src/platform/database/Pool';
import { RuntimeEventPublisher } from '../../src/platform/messaging/RuntimeEventPublisher';
import type { OutboxMessage } from '../../src/platform/messaging/Outbox';
import { EventRegistry } from '../../src/composition/EventRegistry';

describe('event contract and replay', () => {
  it('has one exact runtime version and only declared event subscriptions', () => {
    expect(EVENT_SCHEMA_TYPES).toEqual(COMMERCE_EVENTS.map(({ type }) => type));
    expect(new Set(EVENT_SCHEMA_TYPES).size).toBe(EVENT_SCHEMA_TYPES.length);
    for (const event of COMMERCE_EVENTS) {
      expect(eventVersion(event.type)).toBe(event.version);
    }
    expect(
      Object.values(EVENT_SUBSCRIPTIONS)
        .flat()
        .every((event) => EVENT_SCHEMA_TYPES.includes(event as never))
    ).toBe(true);
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
        if (text.includes('select exists(select 1 from runtime.jobs')) {
          return { rows: [{ existing: false, depth: 0 }], rowCount: 1 } as unknown as QueryResult;
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
    await publisher.publish(event, new AbortController().signal, Date.now() + 10_000);
    await publisher.publish(event, new AbortController().signal, Date.now() + 10_000);
    expect(observed.filter((value) => value.startsWith('insert into'))).toHaveLength(subscribers(event.event_type).length);
    expect(observed.filter((value) => value === 'commit')).toHaveLength(2);
    expect(observed).not.toContain('rollback');
  });

  it('rejects an unsupported event version before opening a transaction', async () => {
    const connect = async () => {
      throw new Error('DATABASE_MUST_NOT_BE_REACHED');
    };
    const pool: DatabasePool = { connect, query: async () => ({ rows: [], rowCount: 0 }) as unknown as QueryResult, workload: () => pool, end: async () => undefined };
    await expect(new RuntimeEventPublisher(pool, eventRegistry()).publish({ ...sampleEvent(), event_version: 999 }, new AbortController().signal, Date.now() + 10_000)).rejects.toThrow('EVENT_VERSION_UNSUPPORTED');
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
  for (const event of EVENT_SCHEMA_TYPES) registry.declare(event);
  for (const [subscriber, events] of Object.entries(EVENT_SUBSCRIPTIONS)) for (const event of events) registry.subscribe(event, subscriber);
  registry.freeze();
  return registry;
}

function subscribers(event: string): readonly string[] {
  return Object.entries(EVENT_SUBSCRIPTIONS)
    .filter(([, events]) => events.includes(event as never))
    .map(([subscriber]) => subscriber);
}
