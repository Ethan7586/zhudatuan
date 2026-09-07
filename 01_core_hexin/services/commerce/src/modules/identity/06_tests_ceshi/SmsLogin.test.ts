import type { QueryResult } from 'pg';
import { describe, expect, it } from 'vitest';
import type { OperationDatabase } from '../../../foundation/application/ModuleOperations';
import {
  consumeSmsLoginChallenge,
  recordInvalidSmsLoginChallenge,
  resolveBoundMobileAccount,
  resolvePasswordLoginCredential,
  verifySmsLoginChallenge,
} from '../03_application_yingyong/services_fuwu/SmsLogin';

describe('SMS login database boundary', () => {
  it('only resolves a mobile when exactly one active account owns it inside the requested realm', async () => {
    const owned = { account_id: 'account:l0', realm_id: 'realm:l0', principal_id: 'principal:one', credential_version: 1 };
    await expect(resolveBoundMobileAccount(database([owned]), 'realm:l0', ['token'])).resolves.toEqual(owned);
    await expect(resolveBoundMobileAccount(database([]), 'realm:l1', ['token'])).resolves.toBeNull();
    await expect(resolveBoundMobileAccount(database([owned, { ...owned, account_id: 'account:other' }]), 'realm:l0', ['token']))
      .rejects.toThrow('IDENTITY_SUBJECT_EXISTS');
  });

  it('keeps the original account subject as the password credential lookup', async () => {
    const db = databaseSequence([{
      account_id: 'account:l0', realm_id: 'realm:l0', principal_id: 'principal:owner', secret_hash: 'scrypt:hash', credential_version: 4,
    }]);

    await expect(resolvePasswordLoginCredential(db, { realmId: 'realm:l0', subjectHash: 'account-hash' })).resolves.toMatchObject({
      account_id: 'account:l0', principal_id: 'principal:owner', secret_hash: 'scrypt:hash', credential_version: 4,
    });
    expect(db.calls).toHaveLength(1);
    expect(db.calls[0]?.values).toEqual(['realm:l0', 'account-hash', null]);
    expect(db.calls[0]?.text).toContain('credential.subject_hash=$2');
  });

  it('allows the same login subject to resolve different accounts and passwords in different realms', async () => {
    const calls: Array<Readonly<{ text: string; values: readonly unknown[] }>> = [];
    const db = {
      calls,
      query: async (text: string, values: readonly unknown[] = []) => {
        calls.push({ text, values });
        const realm = String(values[0]);
        const rows = realm === 'realm:l0'
          ? [{ account_id: 'account:l0', realm_id: realm, principal_id: 'principal:l0', credential_version: 2, secret_hash: 'hash:l0' }]
          : [{ account_id: 'account:l11', realm_id: realm, principal_id: 'principal:l11', credential_version: 9, secret_hash: 'hash:l11' }];
        return { rows, rowCount: 1 } as unknown as QueryResult;
      },
    } as unknown as OperationDatabase;

    await expect(resolvePasswordLoginCredential(db, { realmId: 'realm:l0', subjectHash: 'same-phone' }))
      .resolves.toMatchObject({ account_id: 'account:l0', principal_id: 'principal:l0', secret_hash: 'hash:l0' });
    await expect(resolvePasswordLoginCredential(db, { realmId: 'realm:l11', subjectHash: 'same-phone' }))
      .resolves.toMatchObject({ account_id: 'account:l11', principal_id: 'principal:l11', secret_hash: 'hash:l11' });
    expect(calls.map(({ values }) => values.slice(0, 2))).toEqual([
      ['realm:l0', 'same-phone'], ['realm:l11', 'same-phone'],
    ]);
  });

  it('resolves a bound mobile to the principal before reading its unchanged password credential', async () => {
    const db = databaseSequence(
      [{ account_id: 'account:l0', realm_id: 'realm:l0', principal_id: 'principal:owner', credential_version: 5 }],
      [{ account_id: 'account:l0', realm_id: 'realm:l0', principal_id: 'principal:owner', secret_hash: 'scrypt:hash', credential_version: 5 }],
    );

    await expect(resolvePasswordLoginCredential(db, {
      realmId: 'realm:l0', subjectHash: 'mobile-hash', mobileTokens: ['mobile-hash', 'mobile-fingerprint'],
    })).resolves.toMatchObject({ principal_id: 'principal:owner', credential_version: 5 });
    expect(db.calls[0]?.values).toEqual(['realm:l0', ['mobile-hash', 'mobile-fingerprint']]);
    expect(db.calls[0]?.text).toContain('account.mobile_token=any');
    expect(db.calls[1]?.values).toEqual(['realm:l0', 'mobile-hash', 'account:l0']);
    expect(db.calls[1]?.text).toContain('credential.account_id=$3');
  });

  it('never falls back to a password credential when a mobile resolves to multiple principals', async () => {
    const db = databaseSequence([{ account_id: 'account:one' }, { account_id: 'account:two' }]);

    await expect(resolvePasswordLoginCredential(db, {
      realmId: 'realm:l0', subjectHash: 'mobile-hash', mobileTokens: ['mobile-hash', 'mobile-fingerprint'],
    })).rejects.toThrow('IDENTITY_SUBJECT_EXISTS');
    expect(db.calls).toHaveLength(1);
  });

  it('binds verification to login purpose, destination, expiry and an unconsumed locked row', async () => {
    const verified = { account_id: 'account:l0', realm_id: 'realm:l0', principal_id: 'principal:one', credential_version: 7 };
    const db = database([verified]);
    await expect(verifySmsLoginChallenge(db, { realmId: 'realm:l0', id: 'challenge:one', codeHash: 'code', destinationHash: 'mobile' }))
      .resolves.toEqual(verified);
    expect(db.calls[0]?.text).toContain("challenge.purpose='login'");
    expect(db.calls[0]?.text).toContain('challenge.consumed_at is null');
    expect(db.calls[0]?.text).toContain('challenge.expires_at>clock_timestamp()');
    expect(db.calls[0]?.text).toContain('for update of challenge,account');
    expect(db.calls[0]?.values).toEqual(['challenge:one', 'code', 'realm:l0', 'mobile']);
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
      id: 'challenge:one', codeHash: 'code', account: 'account:l0', realmId: 'realm:l0', destinationHash: 'mobile',
    })).resolves.toBe(true);
    expect(accepted.calls[0]?.text).toContain('consumed_at=clock_timestamp()');
    expect(accepted.calls[0]?.text).toContain('account_id=$3');

    await expect(consumeSmsLoginChallenge(database([]), {
      id: 'challenge:one', codeHash: 'code', account: 'account:l1', realmId: 'realm:l1', destinationHash: 'mobile',
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

function databaseSequence(...responses: readonly (readonly Record<string, unknown>[])[]): OperationDatabase & {
  readonly calls: Array<Readonly<{ text: string; values: readonly unknown[] }>>;
} {
  const calls: Array<Readonly<{ text: string; values: readonly unknown[] }>> = [];
  let index = 0;
  return {
    calls,
    query: async (text: string, values: readonly unknown[] = []) => {
      calls.push({ text, values });
      const rows = responses[index++] ?? [];
      return { rows, rowCount: rows.length } as unknown as QueryResult;
    },
  } as unknown as OperationDatabase & { calls: Array<Readonly<{ text: string; values: readonly unknown[] }>> };
}
