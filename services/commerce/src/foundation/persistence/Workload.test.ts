import { describe, expect, it } from 'vitest';
import { readDatabaseWorkload, writeDatabaseWorkload } from './Workload';

describe('database workload selection', () => {
  it('keeps API reads and writes on separate least-privilege pools', () => {
    expect(readDatabaseWorkload('api')).toBe('query');
    expect(writeDatabaseWorkload('api')).toBe('command');
  });

  it('routes every background database intent through the worker pool', () => {
    for (const runtime of ['jobs', 'provider'] as const) {
      expect(readDatabaseWorkload(runtime)).toBe('worker');
      expect(writeDatabaseWorkload(runtime)).toBe('worker');
    }
  });
});
