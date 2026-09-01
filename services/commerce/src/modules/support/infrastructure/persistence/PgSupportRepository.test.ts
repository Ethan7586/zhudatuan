import { describe, expect, it, vi } from 'vitest';
import type { SqlExecutor } from '../../../../adapter/database/PgTransactionAccess';
import { PgSupportRepository } from './PgSupportRepository';

function repository(rows: ReadonlyArray<Record<string, unknown>> = []) {
  const database = {
    transaction: {} as never,
    query: vi.fn(async () => ({ rows: [...rows], rowCount: rows.length, command: '', oid: 0, fields: [] })),
  } as unknown as SqlExecutor;
  return { database, value: new PgSupportRepository(database, {} as never, {} as never, {} as never, {} as never) };
}

describe('PgSupportRepository SLA resolution', () => {
  it('uses the scope-authorized inherited policy resolver', async () => {
    const { database, value } = repository([{ response_seconds: 14400, resolution_seconds: 172800 }]);
    await expect(value.sla('mall:one', 'normal')).resolves.toEqual({ response: 14400, resolution: 172800 });
    expect(database.query).toHaveBeenCalledWith('select response_seconds,resolution_seconds from support.resolve_sla($1,$2)', ['mall:one', 'normal']);
  });

  it('rejects case creation when no inherited policy exists', async () => {
    const { value } = repository();
    await expect(value.sla('mall:one', 'urgent')).rejects.toThrow('SUPPORT_SLA_NOT_CONFIGURED');
  });
});
