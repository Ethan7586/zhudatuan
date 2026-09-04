import { describe, expect, it } from 'vitest';
import type { OperationSecurityContext } from '../../../foundation/security/OperationSecurityContext';
import { CurrentIdentityReadPort } from '../infrastructure/persistence/CurrentIdentityReadPort';

describe('CurrentIdentityReadPort', () => {
  it('projects the API-host CSRF value only for the authenticated storefront session', () => {
    const identity = new CurrentIdentityReadPort();
    expect(identity.resolve(session(), { cookie: '__Host-storefront-csrf=csrf-token-from-api-session' })).toMatchObject({
      state: 'member',
      membership: 'membership:one',
      version: 7,
      csrf: 'csrf-token-from-api-session',
    });
    expect(identity.resolve({ kind: 'anonymous', channel: 'public', target: 'storefront', trace: 'trace:anonymous' }, {})).toEqual({
      state: 'anonymous',
      member: null,
      membership: null,
      scope: null,
      version: 0,
    });
  });
});

function session(): OperationSecurityContext {
  return {
    kind: 'session',
    access: {
      actor: {
        id: 'principal:one',
        session: 'session:one',
        membership: 'membership:one',
        credentialVersion: 1,
        accessVersion: 7,
        target: 'storefront',
        assurance: { level: 1 },
      },
      membership: {
        id: 'membership:one',
        permissions: { allows: new Set(), denies: new Set() },
        scopes: [],
        active: true,
        accessVersion: 7,
      },
      roles: [],
      organization: 'mall:one',
      scope: { kind: 'mall', id: 'mall:one', path: [] },
      capabilities: new Set(),
      capabilityVersion: 1,
      accessVersion: 7,
      assurance: { level: 1 },
      trace: 'trace:one',
    },
  };
}
