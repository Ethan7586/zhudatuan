import { token } from '../../bootstrap/Container';

export type DatabaseWorkload = 'query' | 'command' | 'worker' | 'migration';

export interface QueryMetric {
  readonly workload: DatabaseWorkload;
  readonly count: number;
  readonly failures: number;
  readonly totalMilliseconds: number;
  readonly maximumMilliseconds: number;
}

export class QueryMetrics {
  private readonly values = new Map<DatabaseWorkload, { count: number; failures: number; total: number; maximum: number }>();

  observe(workload: DatabaseWorkload, milliseconds: number, failed: boolean): void {
    const value = this.values.get(workload) ?? { count: 0, failures: 0, total: 0, maximum: 0 };
    value.count += 1;
    value.failures += failed ? 1 : 0;
    value.total += milliseconds;
    value.maximum = Math.max(value.maximum, milliseconds);
    this.values.set(workload, value);
  }

  snapshot(): readonly QueryMetric[] {
    return Object.freeze(
      [...this.values]
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([workload, value]) =>
          Object.freeze({
            workload,
            count: value.count,
            failures: value.failures,
            totalMilliseconds: value.total,
            maximumMilliseconds: value.maximum,
          })
        )
    );
  }
}

export const QUERY_METRICS = token<QueryMetrics>('database.querymetrics');
