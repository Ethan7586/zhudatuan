import type { QueryResult } from 'pg';
import { describe, expect, it } from 'vitest';
import type { OperationDatabase } from '../../foundation/application/ModuleOperations';
import {
  consumeSmsLoginChallenge,
  recordInvalidSmsLoginChallenge,
  resolveBoundMobilePrincipal,
  verifySmsLoginChallenge,
} from './SmsLogin';

describe('SMS login database boundary', () => {
  it('only resolves a mobile when exactly one active principal owns it', async () => {
    await expect(resolveBoundMobilePrincipal(database([{ principal_id: 'principal:one' }]), ['token'])).resolves.toBe('principal:one');
    await expect(resolveBoundMobilePrincipal(database([]), ['token'])).resolves.toBeNull();
    await expect(resolveBoundMobilePrincipal(database([{ principal_id: 'one' }, { principal_id: 'two' }]), ['token'])).resolves.toBeNull();
  });

  it('binds verification to login purpose, destination, expiry and an unconsumed locked row', async () => {
    const db = database([{ principal_id: 'principal:one', credential_version: 7 }]);
    await expect(verifySmsLoginChallenge(db, { id: 'challenge:one', codeHash: 'code', destinationHash: 'mobile' }))
      .resolves.toEqual({ principal_id: 'principal:one', credential_version: 7 });
    expect(db.calls[0]?.text).toContain("challenge.purpose='login'");
    expect(db.calls[0]?.text).toContain('challenge.consumed_at is null');
    expect(db.calls[0]?.text).toContain('challenge.expires_at>clock_timestamp()');
    expect(db.calls[0]?.text).toContain('for update of challenge,principal');
    expect(db.calls[0]?.values).toEqual(['challenge:one', 'code', 'mobile']);
  });

  it('increments attempts only for the same login destination', async () => {
    const db = database([]);
    await recordInvalidSmsLoginChallenge(db, 'challenge:one', 'mobile');
    expect(db.calls[0]?.text).toContain("purpose='login'");
    expect(db.calls[0]?.text).toContain('destination_hash=$2');
  });

  it('consumes exactly one matching challenge with one conditional update', async () => {
    const accepted = database([{ principal_id: 'principal:one' }]);
    await expect(consumeSmsLoginChallenge(accepted, {
      id: 'challenge:one', codeHash: 'code', principal: 'principal:one', destinationHash: 'mobile',
    })).resolves.toBe(true);
    expect(accepted.calls[0]?.text).toContain('consumed_at=clock_timestamp()');
    expect(accepted.calls[0]?.text).toContain('principal_id=$3');

    await expect(consumeSmsLoginChallenge(database([]), {
      id: 'challenge:one', codeHash: 'code', principal: 'principal:one', destinationHash: 'mobile',
    })).resolves.toBe(false);
  });
});

function database(rows: readonly Record<string, unknown>[]): OperationDatabase & {
  readonly calls: Array<Readonly<{ text: string; values: readonly unknown[] }>>;
} {
  const calls: Array<Readonly<{ text: string; values: readonly unknown[] }>> = [];
  return {
    calls,
    query: async (text: string, values: readonly unknown[] = []) => {
      calls.push({ text, values });
      return { rows, rowCount: rows.length } as unknown as QueryResult;
    },
  } as unknown as OperationDatabase & { calls: Array<Readonly<{ text: string; values: readonly unknown[] }>> };
}
