import type { QueryResult } from 'pg';
import { describe, expect, it } from 'vitest';
import type { OperationDatabase } from '../../../foundation/application/ModuleOperations';
import {
  consumeSmsLoginChallenge,
  recordInvalidSmsLoginChallenge,
  resolveBoundMobileAccount,
  resolveMembershipAccount,
  resolvePasswordLoginCredential,
  verifySmsLoginChallenge,
} from '../03_application_yingyong/services_fuwu/SmsLogin';

describe('SMS login database boundary', () => {
  it('treats multiple Realm accounts for one principal as one identity and rejects different principals', async () => {
    const owned = { account_id: 'account:l0', realm_id: 'realm:l0', principal_id: 'principal:one', credential_version: 1 };
    await expect(resolveBoundMobileAccount(database([owned]), 'realm:l0', ['token'])).resolves.toEqual(owned);
    await expect(resolveBoundMobileAccount(database([]), 'realm:l1', ['token'])).resolves.toBeNull();
    await expect(resolveBoundMobileAccount(database([owned, { ...owned, account_id: 'account:other' }]), 'realm:l0', ['token']))
      .resolves.toEqual(owned);
    await expect(resolveBoundMobileAccount(database([owned, {
      ...owned, account_id: 'account:other', principal_id: 'principal:other',
    }]), 'realm:l0', ['token']))
      .rejects.toThrow('IDENTITY_SUBJECT_EXISTS');
  });

  it('selects the account carrying the requested client and organization membership', async () => {
    const operator = { account_id: 'account:operator', realm_id: 'realm:l1', principal_id: 'principal:one', credential_version: 2 };
    const db = database([operator]);
    await expect(resolveMembershipAccount(db, {
      entryRealmId: 'realm:l1', principalId: 'principal:one',
      membershipClient: 'operator', membershipOrganizationId: 'mall:one',
    })).resolves.toEqual(operator);
    expect(db.calls[0]?.values).toEqual(['realm:l1', 'principal:one', 'operator', 'mall:one']);
    expect(db.calls[0]?.text).toContain('membership.client=$3');
    expect(db.calls[0]?.text).toContain('membership.organization_id=$4');
  });

  it('lets an entry Realm discover only its registered hosted member account Realm', async () => {
    const hosted = { account_id: 'account:mall-a', realm_id: 'realm:member-a', principal_id: 'principal:a', credential_version: 3 };
    const db = database([hosted]);
    await expect(resolveBoundMobileAccount(db, 'realm:mall-a', ['same-phone'])).resolves.toEqual(hosted);
    expect(db.calls[0]?.text).toContain('identity.realm_contains_account_realm($1,account.realm_id)');
    expect(db.calls[0]?.values[0]).toBe('realm:mall-a');
  });

  it('keeps the original account subject as the password credential lookup', async () => {
    const db = databaseSequence([{
      account_id: 'account:l0', realm_id: 'realm:l0', principal_id: 'principal:owner', secret_hash: 'scrypt:hash', credential_version: 4,
    }]);

    await expect(resolvePasswordLoginCredential(db, {
      realmId: 'realm:l0', subjectHash: 'account-hash',
      membershipClient: 'operator', membershipOrganizationId: 'tenant:one',
    })).resolves.toMatchObject({
      account_id: 'account:l0', principal_id: 'principal:owner', secret_hash: 'scrypt:hash', credential_version: 4,
    });
    expect(db.calls).toHaveLength(1);
    expect(db.calls[0]?.values).toEqual(['realm:l0', 'account-hash', null, 'operator', 'tenant:one']);
    expect(db.calls[0]?.text).toContain('credential.subject_hash=$2');
    expect(db.calls[0]?.text).toContain('identity.realm_contains_account_realm($1,credential.realm_id)');
    expect(db.calls[0]?.text).toContain('membership.client=$4');
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

    await expect(resolvePasswordLoginCredential(db, {
      realmId: 'realm:l0', subjectHash: 'same-phone',
      membershipClient: 'operator', membershipOrganizationId: 'tenant:l0',
    }))
      .resolves.toMatchObject({ account_id: 'account:l0', principal_id: 'principal:l0', secret_hash: 'hash:l0' });
    await expect(resolvePasswordLoginCredential(db, {
      realmId: 'realm:l11', subjectHash: 'same-phone',
      membershipClient: 'storefront', membershipOrganizationId: 'mall:l11',
    }))
      .resolves.toMatchObject({ account_id: 'account:l11', principal_id: 'principal:l11', secret_hash: 'hash:l11' });
    expect(calls.map(({ values }) => values)).toEqual([
      ['realm:l0', 'same-phone', null, 'operator', 'tenant:l0'],
      ['realm:l11', 'same-phone', null, 'storefront', 'mall:l11'],
    ]);
  });

  it('selects the mobile credential through the requested membership instead of another identity domain', async () => {
    const db = databaseSequence(
      [{ account_id: 'account:operator', realm_id: 'realm:l1', principal_id: 'principal:owner', secret_hash: 'scrypt:hash', credential_version: 5 }],
    );

    await expect(resolvePasswordLoginCredential(db, {
      realmId: 'realm:l0', subjectHash: 'mobile-hash', mobileTokens: ['mobile-hash', 'mobile-fingerprint'],
      membershipClient: 'operator', membershipOrganizationId: 'tenant:one',
    })).resolves.toMatchObject({ principal_id: 'principal:owner', credential_version: 5 });
    expect(db.calls[0]?.values).toEqual([
      'realm:l0', 'mobile-hash', ['mobile-hash', 'mobile-fingerprint'], 'operator', 'tenant:one',
    ]);
    expect(db.calls[0]?.text).toContain('account.mobile_token=any');
    expect(db.calls[0]?.text).toContain('join access.membership membership');
  });

  it('never falls back to a password credential when a mobile resolves to multiple principals', async () => {
    const db = databaseSequence([{ account_id: 'account:one' }, { account_id: 'account:two' }]);

    await expect(resolvePasswordLoginCredential(db, {
      realmId: 'realm:l0', subjectHash: 'mobile-hash', mobileTokens: ['mobile-hash', 'mobile-fingerprint'],
      membershipClient: 'operator', membershipOrganizationId: 'tenant:one',
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
