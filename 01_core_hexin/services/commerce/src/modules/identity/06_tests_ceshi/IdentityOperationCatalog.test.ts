import { OperationCatalog } from '@shop/contract';
import { describe, expect, it } from 'vitest';
import {
  CREDENTIAL_OPERATION_IDS,
  identityRegistrationCoreOperationIds,
  MEMBERSHIP_INVITATION_OPERATION_IDS,
  MOBILE_WECHAT_OPERATION_IDS,
  REGISTRATION_OPERATION_IDS,
  SESSION_TICKET_OPERATION_IDS,
} from '../05_interface_jieru/http/IdentityOperationCatalog';
import {
  IDENTITY_CORE_OPERATION_IDS,
  IDENTITY_REGISTRATION_OPERATION_IDS,
} from '../05_interface_jieru/http/IdentityOperations';

const CORE_CHARACTERISTICS = [
  ['identity.sessions.create', 'POST', '/api/v1/identity/sessions'],
  ['identity.tickets.exchange', 'POST', '/api/v1/identity/tickets/exchange'],
  ['identity.session.read', 'GET', '/api/v1/identity/session'],
  ['identity.session.delete', 'DELETE', '/api/v1/identity/session'],
  ['identity.sessions.read', 'GET', '/api/v1/identity/sessions'],
  ['identity.sessions.revoke', 'DELETE', '/api/v1/identity/sessions/{sessionid}'],
  ['identity.challenges.create', 'POST', '/api/v1/identity/challenges'],
  ['identity.invitations.read', 'POST', '/api/v1/identity/invitations/resolve'],
  ['identity.storefronts.read', 'POST', '/api/v1/identity/storefronts/resolve'],
  ['identity.invitations.create', 'POST', '/api/v1/identity/invitations'],
  ['identity.invitations.revoke', 'DELETE', '/api/v1/identity/invitations/{invitationid}'],
  ['identity.members.create', 'POST', '/api/v1/identity/members'],
  ['identity.members.manage', 'PUT', '/api/v1/identity/members/{membershipid}'],
  ['identity.members.reset', 'PUT', '/api/v1/identity/members/{membershipid}/registration'],
  ['identity.password.change', 'PUT', '/api/v1/identity/password'],
  ['identity.password.verify', 'POST', '/api/v1/identity/password/verify'],
  ['identity.password.reset', 'POST', '/api/v1/identity/password/reset'],
  ['identity.mobile.challenge', 'POST', '/api/v1/identity/mobile/challenges'],
  ['identity.mobile.manage', 'PUT', '/api/v1/identity/mobile'],
  ['identity.stepup.start', 'POST', '/api/v1/identity/stepup/challenges'],
  ['identity.stepup.complete', 'POST', '/api/v1/identity/stepup/verifications'],
] as const;

describe('identity operation catalog characterization', () => {
  it('freezes the public operation order and critical HTTP declarations', () => {
    expect(IDENTITY_CORE_OPERATION_IDS).toEqual(CORE_CHARACTERISTICS.map(([id]) => id));
    expect(IDENTITY_CORE_OPERATION_IDS.map((id) => {
      const operation = OperationCatalog.get(id);
      return [operation.id, operation.method, operation.path];
    })).toEqual(CORE_CHARACTERISTICS);
  });

  it('partitions every core operation exactly once without changing registration ownership', () => {
    const partitioned = [
      ...SESSION_TICKET_OPERATION_IDS,
      ...REGISTRATION_OPERATION_IDS,
      ...MEMBERSHIP_INVITATION_OPERATION_IDS,
      ...CREDENTIAL_OPERATION_IDS,
      ...MOBILE_WECHAT_OPERATION_IDS,
    ];
    expect(new Set(partitioned).size).toBe(partitioned.length);
    expect([...partitioned].sort()).toEqual([...IDENTITY_CORE_OPERATION_IDS].sort());
    expect(IDENTITY_REGISTRATION_OPERATION_IDS).toEqual([
      ...identityRegistrationCoreOperationIds(),
      'identity.wechat.session',
      'identity.wechat.bind',
    ]);
  });
});
