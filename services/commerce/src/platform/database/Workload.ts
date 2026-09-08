import type { DatabaseWorkload } from './QueryMetrics';

export type RuntimeWorkload = 'api' | 'jobs' | 'provider';
export type ReadDatabaseWorkload = Extract<DatabaseWorkload, 'query' | 'worker'>;
export type WriteDatabaseWorkload = Extract<DatabaseWorkload, 'command' | 'worker'>;

export function readDatabaseWorkload(workload: RuntimeWorkload): ReadDatabaseWorkload {
  return workload === 'api' ? 'query' : 'worker';
}

export function writeDatabaseWorkload(workload: RuntimeWorkload): WriteDatabaseWorkload {
  return workload === 'api' ? 'command' : 'worker';
}
