import type { QueryResult } from 'pg';
import { describe, expect, it, vi } from 'vitest';
import type { OperationDatabase } from '../../../foundation/application/ModuleOperations';
import { AddressPort, type AddressInput } from '../04_adapters_shixian/persistence_cunchu/AddressPort';

describe('AddressPort default address semantics', () => {
  it('lists the persisted default flag instead of inferring it from position', async () => {
    const query = vi.fn(async (_text: string, _values: readonly unknown[] = []) => result([]));
    await new AddressPort().list({ query } as unknown as OperationDatabase, 'member:one', null, 100);
    expect(query.mock.calls[0]?.[0]).toContain('is_default');
  });

  it('clears the previous default and saves the new address in the same operation transaction', async () => {
    const query = vi.fn(async (_text: string, _values: readonly unknown[] = []) => result([]));
    await new AddressPort().save({ query } as unknown as OperationDatabase, addressInput(true));

    expect(query).toHaveBeenCalledTimes(3);
    expect(query.mock.calls[0]?.[0]).toContain('pg_advisory_xact_lock');
    expect(query.mock.calls[1]?.[0]).toContain('set is_default=false');
    expect(query.mock.calls[2]?.[0]).toContain('is_default');
    expect(query.mock.calls[2]?.[1]?.at(-1)).toBe(true);
  });

  it('switches only after the target and expected version have been found', async () => {
    const query = vi.fn(async (_text: string, _values: readonly unknown[] = []) => result([]))
      .mockResolvedValueOnce(result([]))
      .mockResolvedValueOnce(result([{ id: 'address:two' }]))
      .mockResolvedValueOnce(result([]))
      .mockResolvedValueOnce(result([{ id: 'address:two', is_default: true, version: 5 }]));

    const changed = await new AddressPort().setDefault(
      { query } as unknown as OperationDatabase,
      'address:two',
      'member:one',
      4,
    );

    expect(changed.rows[0]).toMatchObject({ id: 'address:two', is_default: true, version: 5 });
    expect(query.mock.calls[1]?.[0]).toContain('for update');
    expect(query.mock.calls[1]?.[1]).toEqual(['address:two', 'member:one', 4]);
    expect(query.mock.calls[2]?.[0]).toContain('id<>$2');
  });

  it('does not clear the current default when the target version conflicts', async () => {
    const query = vi.fn(async (_text: string, _values: readonly unknown[] = []) => result([]))
      .mockResolvedValueOnce(result([])).mockResolvedValueOnce(result([]));
    const changed = await new AddressPort().setDefault(
      { query } as unknown as OperationDatabase,
      'address:two',
      'member:one',
      3,
    );
    expect(changed.rows).toEqual([]);
    expect(query).toHaveBeenCalledTimes(2);
  });
});

function addressInput(isDefault: boolean): AddressInput {
  return {
    id: 'address:two',
    member: 'member:one',
    recipient: '李四',
    mobile: '13900000000',
    address: '文一路 1 号',
    region: '浙江省/杭州市/西湖区',
    recipientEnvelope: { ciphertext: 'recipient', fingerprint: 'recipient-fingerprint' },
    mobileEnvelope: { ciphertext: 'mobile', fingerprint: 'mobile-fingerprint' },
    addressEnvelope: { ciphertext: 'address', fingerprint: 'address-fingerprint' },
    isDefault,
    expectedVersion: null,
  } as AddressInput;
}

function result(rows: readonly Record<string, unknown>[]): QueryResult {
  return { rows, rowCount: rows.length } as unknown as QueryResult;
}
