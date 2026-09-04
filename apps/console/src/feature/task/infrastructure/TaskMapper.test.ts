import { describe, expect, it } from 'vitest';
import { TaskMapper } from './TaskMapper';

describe('TaskMapper', () => {
  it('maps the unified runtime page into frozen task models', () => {
    const page = new TaskMapper().page({ items: [fixture], count: 1, nextCursor: 'next' });
    expect(page).toMatchObject({ count: 1, nextCursor: 'next', items: [{ type: 'import', owner: 'member', state: 'running', processed: 10 }] });
    expect(Object.isFrozen(page)).toBe(true);
    expect(Object.isFrozen(page.items[0])).toBe(true);
  });

  it('rejects an unknown runtime state instead of inventing client behavior', () => {
    expect(() => new TaskMapper().task({ ...fixture, state: 'mystery' })).toThrow();
  });
});

const fixture = {
  id: 'import:one',
  type: 'import',
  owner: 'member',
  kind: 'member',
  title: '成员导入',
  state: 'running',
  processed: 10,
  total: 20,
  succeeded: 9,
  failed: 1,
  retryableItems: 1,
  cancellable: true,
  retryable: false,
  version: 2,
  createdAt: '2026-09-03T00:00:00.000Z',
  updatedAt: '2026-09-03T00:01:00.000Z',
  expiresAt: '2026-09-04T00:00:00.000Z',
  fileName: 'member.csv',
  downloadAvailable: false,
  confirmationRequired: false,
  previewHash: null,
  columns: [],
  validationErrors: 0,
};
