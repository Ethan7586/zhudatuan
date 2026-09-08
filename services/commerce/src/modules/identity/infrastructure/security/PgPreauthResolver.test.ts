import type { QueryResult } from 'pg';
import { describe, expect, it, vi } from 'vitest';
import { OperationCatalog } from '@shop/contract';
import { FederationProtector } from '../../domain/service/FederationProtector';
import { PgPreauthResolver } from './PgPreauthResolver';

describe('PgPreauthResolver', () => {
  it('binds a preauth cookie to purpose, target, browser and device without forwarding plaintext', async () => {
    const query = vi.fn<(text: string, values?: readonly unknown[]) => Promise<QueryResult>>(
      async () =>
        ({
          rows: [{ id: 'preauth:1', purpose: 'federationselection', target: 'console', principal_id: 'principal:1', reference_id: 'transaction:1', version: 2, expires_at: new Date(Date.now() + 60_000) }],
          rowCount: 1,
        }) as unknown as QueryResult
    );
    const resolver = new PgPreauthResolver({ query } as never, new FederationProtector('p'.repeat(32)));
    const token = 'a'.repeat(64);
    const context = await resolver.resolve(
      { cookie: `__Host-preauth=${token}`, 'x-client-target': 'console', 'x-peer-address': '10.0.0.1', 'user-agent': 'browser', 'x-device-id': 'device:1' },
      OperationCatalog.get('identity.federations.complete')
    );
    expect(context).toMatchObject({ kind: 'preauth', purpose: 'federationselection', target: 'console', version: 2 });
    const values = query.mock.calls[0]?.[1] ?? [];
    expect(values).toHaveLength(5);
    expect(values).not.toContain(token);
    expect(values?.[3]).toBe('federationselection');
    expect(values?.[4]).toBe('console');
  });

  it('rejects malformed cookies before database access', async () => {
    const query = vi.fn();
    const resolver = new PgPreauthResolver({ query } as never, new FederationProtector('p'.repeat(32)));
    await expect(resolver.resolve({ cookie: '__Host-preauth=short', 'x-client-target': 'console' }, OperationCatalog.get('identity.federations.complete'))).rejects.toThrow('FEDERATION_TRANSACTION_INVALID');
    expect(query).not.toHaveBeenCalled();
  });

  it('uses the declared enrollment preauth errors for missing and expired proofs', async () => {
    const operation = OperationCatalog.get('identity.enrollments.read');
    const missing = new PgPreauthResolver({ query: vi.fn() } as never, new FederationProtector('p'.repeat(32)));
    await expect(missing.resolve({ 'x-client-target': 'storefront' }, operation)).rejects.toThrow('PREAUTH_REQUIRED');

    const query = vi.fn(async () => ({
      rows: [{ id: 'preauth:expired', purpose: 'enrollment', target: 'storefront', principal_id: null, reference_id: 'enrollment:1', version: 1, expires_at: new Date(0) }],
      rowCount: 1,
    }));
    const expired = new PgPreauthResolver({ query } as never, new FederationProtector('p'.repeat(32)));
    await expect(expired.resolve({ cookie: `__Host-preauth=${'a'.repeat(64)}`, 'x-client-target': 'storefront' }, operation)).rejects.toThrow('PREAUTH_EXPIRED');
  });
});
