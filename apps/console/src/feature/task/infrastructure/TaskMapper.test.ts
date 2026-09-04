import { describe, expect, it } from 'vitest';
import { TaskMapper } from './TaskMapper';

describe('TaskMapper', () => {
  it('maps a service-owned import task into a frozen domain model', () => {
    const task = new TaskMapper().task('member', {
      id: 'memberimport:one',
      state: 'running',
      total_count: 20,
      cursor_value: 10,
      success_count: 9,
      failure_count: 1,
      validation_summary: { format: 'csv', rows: 20, columns: ['employeeNo', 'displayName'], shardSize: 500, processed: 10, errors: 1, ignored: 'server-private' },
      last_error: null,
      errors: [{ row_number: 4, reason_code: 'FORMAT_INVALID', field: 'employeeNo', detail: { expected: 'text' } }],
      report: { sha256: 'a'.repeat(64), size: 128, download: 'https://object.test/report' },
      created_at: '2026-09-03T00:00:00.000Z',
      updated_at: '2026-09-03T00:01:00.000Z',
    });
    expect(task).toMatchObject({ kind: 'member', state: 'running', validation: { format: 'csv', rows: 20, processed: 10, errors: 1 }, issues: [{ row: 4, detail: '{"expected":"text"}' }] });
    expect('ignored' in task.validation).toBe(false);
    expect(Object.isFrozen(task)).toBe(true);
    expect(Object.isFrozen(task.validation.columns)).toBe(true);
  });

  it('rejects an unknown service state instead of inventing client behavior', () => {
    expect(() => new TaskMapper().task('catalog', { ...fixture, state: 'mystery' })).toThrow('IMPORT_STATE_INVALID');
  });
});

const fixture = {
  id: 'catalogimport:one',
  state: 'completed',
  total_count: 0,
  cursor_value: 0,
  success_count: 0,
  failure_count: 0,
  validation_summary: {},
  last_error: null,
  errors: [],
  created_at: '2026-09-03T00:00:00.000Z',
  updated_at: '2026-09-03T00:00:00.000Z',
};
