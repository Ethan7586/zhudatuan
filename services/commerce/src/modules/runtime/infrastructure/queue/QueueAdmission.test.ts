import { describe, expect, it, vi } from 'vitest';
import { QueueAdmission } from './QueueAdmission';

describe('QueueAdmission', () => {
  it('reserves capacity from low priority deferred work', async () => {
    const query = vi.fn(async (_sql: string, values?: readonly unknown[]) => ({ rows: [{ existing: false, depth: Number(values?.[1]) }] }));
    const admission = new QueueAdmission({ query });
    await expect(admission.assert({ id: 'job:export', queue: 'export', priority: 100 })).rejects.toThrow('RATE_LIMITED');
    expect(query.mock.calls[0]?.[1]?.[1]).toBe(3072);
  });

  it('keeps the reserved range available to transaction work', async () => {
    const query = vi.fn(async () => ({ rows: [{ existing: false, depth: 3072 }] }));
    await expect(new QueueAdmission({ query }).assert({ id: 'job:order', queue: 'transaction', priority: 100 })).resolves.toBeUndefined();
  });

  it('allows an idempotent active job without consuming another slot', async () => {
    const query = vi.fn(async () => ({ rows: [{ existing: true, depth: 4096 }] }));
    await expect(new QueueAdmission({ query }).assert({ id: 'job:existing', queue: 'maintenance', priority: 100 })).resolves.toBeUndefined();
  });
});
