import { escapeLiteral } from 'pg';
import type { TransactionOptions } from './TransactionManager';

const SETTINGS = Object.freeze([
  'app.tenant_id',
  'app.membership_id',
  'app.scope_id',
  'app.actor_id',
  'app.trace_id',
  'app.operation_id',
  'app.workload',
  'app.authorization_snapshot',
  'statement_timeout',
] as const);

export function pgContextParameters(first = 1): string {
  return `select ${SETTINGS.map((setting, index) => `set_config('${setting}',$${first + index},true)`).join(',')}`;
}

export function pgContextValues(options: TransactionOptions): readonly string[] {
  return Object.freeze([
    options.tenant,
    options.membership,
    options.scope,
    options.actor,
    options.trace,
    options.operation,
    options.workload === 'jobs' ? 'jobs' : 'api',
    options.authorization === undefined ? '' : JSON.stringify(options.authorization),
    String(Math.max(1, Math.ceil(options.deadline - Date.now()))),
  ]);
}

export function pgContextLiteral(options: TransactionOptions): string {
  const values = pgContextValues(options);
  return `select ${SETTINGS.map((setting, index) => `set_config('${setting}',${escapeLiteral(values[index]!)},true)`).join(',')}`;
}
