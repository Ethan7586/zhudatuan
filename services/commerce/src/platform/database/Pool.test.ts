import { describe, expect, it } from 'vitest';
import { RUNTIME_LIMITS } from '@shop/config/runtime';
import { poolConfiguration } from './Pool';

describe('database pool profiles', () => {
  it('keeps query, command and worker capacity isolated from the generated capacity source', () => {
    const query = poolConfiguration('query');
    const command = poolConfiguration('command');
    const worker = poolConfiguration('worker');
    expect(query.max).toBe(RUNTIME_LIMITS.pool.query.maximumConnections);
    expect(command.max).toBe(RUNTIME_LIMITS.pool.command.maximumConnections);
    expect(worker.max).toBe(RUNTIME_LIMITS.pool.worker.maximumConnections);
    expect(new Set([query.application_name, command.application_name, worker.application_name]).size).toBe(3);
    expect(query.options).toContain(`statement_timeout=${RUNTIME_LIMITS.pool.query.statementTimeoutMilliseconds}`);
    expect(query.options).toContain('jit=off');
    expect(command.options).toContain('jit=off');
    expect(worker.options).toContain('jit=off');
    expect(poolConfiguration('migration').options).toContain('jit=on');
  });
});
