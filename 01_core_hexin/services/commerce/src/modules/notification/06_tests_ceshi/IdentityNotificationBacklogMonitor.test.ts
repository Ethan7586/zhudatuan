import { createTelemetry } from '@shop/telemetry';
import { describe, expect, it, vi } from 'vitest';
import type { DatabasePool } from '../../../foundation/persistence/Pool';
import { IdentityNotificationBacklogMonitor, type IdentityNotificationBacklogSnapshot } from '../05_interface_jieru/job/IdentityNotificationBacklogMonitor';

describe('identity notification backlog monitor', () => {
  it('records healthy queue metrics without creating an alert', async () => {
    const records: Readonly<Record<string, unknown>>[] = [];
    const query = vi.fn(async (_statement: string) => result([snapshot()]));
    const monitor = new IdentityNotificationBacklogMonitor({ query } as unknown as DatabasePool,
      createTelemetry((record) => { records.push(record); }));

    await expect(monitor.inspect()).resolves.toEqual(snapshot());

    expect(query).toHaveBeenCalledTimes(1);
    expect(String(query.mock.calls[0]?.[0])).toContain("available_at<=clock_timestamp()");
    expect(String(query.mock.calls[0]?.[0])).toContain("source_id like 'identitynotification:delivery:%'");
    expect(records.filter(({ kind }) => kind === 'metric')).toHaveLength(4);
    expect(records.some(({ event }) => event === 'identity.notification.queue.backlog')).toBe(false);
  });

  it('persists one alert for an overdue queue and emits recovery when it drains', async () => {
    const records: Readonly<Record<string, unknown>>[] = [];
    let current = snapshot({ queued: 2, oldest_seconds: 31 });
    const query = vi.fn(async (statement: string, values?: readonly unknown[]) => statement.startsWith('select')
      ? result([current]) : result([], 1, values));
    const monitor = new IdentityNotificationBacklogMonitor({ query } as unknown as DatabasePool,
      createTelemetry((record) => { records.push(record); }));

    await monitor.inspect();
    await monitor.inspect();
    current = snapshot();
    await monitor.inspect();

    const alertWrites = query.mock.calls.filter(([statement]) => String(statement).includes('insert into runtime.deadletter'));
    expect(alertWrites).toHaveLength(1);
    expect(alertWrites[0]?.[1]?.[0]).toBe('alert:identitynotification:backlog');
    expect(alertWrites[0]?.[1]?.[1]).toContain('"oldest_seconds":31');
    expect(records.filter(({ event }) => event === 'identity.notification.queue.backlog')).toHaveLength(1);
    expect(records.filter(({ event }) => event === 'identity.notification.queue.recovered')).toHaveLength(1);
  });

  it('alerts immediately for failed jobs or an expired running lease', async () => {
    for (const current of [snapshot({ failed: 1 }), snapshot({ running: 1, stale_running: 1 })]) {
      const records: Readonly<Record<string, unknown>>[] = [];
      const query = vi.fn(async (statement: string) => statement.startsWith('select') ? result([current]) : result([], 1));
      const monitor = new IdentityNotificationBacklogMonitor({ query } as unknown as DatabasePool,
        createTelemetry((record) => { records.push(record); }));
      await monitor.inspect();
      expect(query.mock.calls.some(([statement]) => String(statement).includes('insert into runtime.deadletter'))).toBe(true);
      expect(records.some(({ event }) => event === 'identity.notification.queue.backlog')).toBe(true);
    }
  });

  it('alerts when a provider delivery failure is unresolved after the queue completed', async () => {
    const records: Readonly<Record<string, unknown>>[] = [];
    const current = snapshot({ delivery_alerts: 1 });
    const query = vi.fn(async (statement: string) => statement.startsWith('select') ? result([current]) : result([], 1));
    const monitor = new IdentityNotificationBacklogMonitor({ query } as unknown as DatabasePool,
      createTelemetry((record) => { records.push(record); }));

    await monitor.inspect();

    expect(query.mock.calls.some(([statement]) => String(statement).includes('insert into runtime.deadletter'))).toBe(true);
    expect(records.some(({ event }) => event === 'identity.notification.queue.backlog')).toBe(true);
  });
});

function snapshot(overrides: Partial<IdentityNotificationBacklogSnapshot> = {}): IdentityNotificationBacklogSnapshot {
  return { queued: 0, running: 0, failed: 0, stale_running: 0, oldest_seconds: 0, delivery_alerts: 0, ...overrides };
}

function result(rows: readonly unknown[], rowCount = rows.length, values?: readonly unknown[]) {
  void values;
  return { rows, rowCount, command: '', oid: 0, fields: [] };
}
