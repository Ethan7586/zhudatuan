import assert from 'node:assert/strict';
import { test } from 'node:test';
import { OperationCatalog, operationSchema } from '@shop/contract';
import { DomainError } from '../../services/commerce/src/foundation/domain/DomainError';
import { DelegationPolicy } from '../../services/commerce/src/modules/access/domain/policy/DelegationPolicy';
import { GrantPlan } from '../../services/commerce/src/modules/access/domain/model/GrantPlan';
import { Invitation, type InvitationState } from '../../services/commerce/src/modules/identity/domain/model/Invitation';
import { InvitationCode } from '../../services/commerce/src/modules/identity/domain/model/InvitationCode';
import { InvitationHasher } from '../../services/commerce/src/modules/identity/infrastructure/security/InvitationHasher';
import { NAVIGATION_CATALOG } from '../../services/commerce/src/modules/navigation/infrastructure/registry/NavigationCatalog';

const ACTIVE_AT = new Date('2026-08-30T00:00:00.000Z');

test('invite01_storefront_signin_success', () => {
  const invitation = signin();
  assert.equal(invitation.requiresEnrollment(), false);
  assert.equal(invitation.requiresProof(), false);
  assert.deepEqual(invitation.consume(ACTIVE_AT).state, { ...invitation.state, useCount: 1, status: 'exhausted', version: 2 });
  assert.equal(OperationCatalog.get('identity.sessions.create').targetPolicy, 'exact');
});

test('invite02_console_signin_proof_success', () => {
  const invitation = signin({ target: 'console', recipientHash: Buffer.alloc(32, 1), assurance: 2 });
  assert.equal(invitation.requiresProof(), true);
  assert.equal(OperationCatalog.get('identity.sessions.complete').assuranceLevel, 'preauth');
  assert.equal(operationSchema('identity.sessions.complete').input.safeParse({ body: { proof: 'challenge', code: '123456', authorization: { state: 'state', nonce: 'nonce', challenge: 'challenge' } } }).success, true);
});

test('invite03_enrollment_success', () => {
  const invitation = enrollment();
  assert.equal(invitation.requiresEnrollment(), true);
  assert.equal(invitation.requiresProof(), false);
  assert.equal(
    operationSchema('identity.enrollments.complete').input.safeParse({
      path: { id: 'claim:one' },
      body: {
        subject: '+85291234567',
        challenge: 'challenge',
        code: '123456',
        termsAccepted: true,
        termsHash: 'b'.repeat(64),
        password: 'LongPassword1!',
        displayName: 'Member',
        authorization: { state: 'state', nonce: 'nonce', challenge: 'challenge' },
      },
    }).success,
    true
  );
});

test('invite04_invalid_code', () => {
  assert.throws(() => InvitationCode.parse('not-an-invitation'), invitationInvalid);
  assert.equal(
    operationSchema('identity.sessions.create').input.safeParse({ body: { method: 'invitation', code: 'bad', target: 'storefront', authorization: { state: 'state', nonce: 'nonce', challenge: 'challenge' }, roleId: 'owner' } }).success,
    false
  );
});

test('invite05_expired_code', () => {
  assert.throws(() => signin().assertRedeemable(new Date('2100-01-01T00:00:00.000Z'), 'storefront'), invitationInvalid);
});

test('invite06_revoked_code', () => {
  assert.throws(() => signin({ status: 'revoked' }).assertRedeemable(ACTIVE_AT, 'storefront'), invitationInvalid);
});

test('invite07_replayed_code', () => {
  const consumed = signin().consume(ACTIVE_AT);
  assert.throws(() => consumed.consume(ACTIVE_AT), invitationInvalid);
});

test('invite08_wrong_target', () => {
  assert.throws(() => signin().assertRedeemable(ACTIVE_AT, 'console'), invitationInvalid);
});

test('invite09_wrong_recipient', () => {
  const hasher = new InvitationHasher(JSON.stringify({ current: { version: 'current', value: 'invitation-key-value-at-least-thirty-two-bytes' }, previous: [] }));
  const expected = hasher.recipient('+85291234567');
  assert.equal(hasher.matchesRecipient('+85291234567', expected), true);
  assert.equal(hasher.matchesRecipient('+85290000000', expected), false);
});

test('invite10_stale_issuer', () => {
  assert.notEqual(plan({ issuerVersion: 7 }).digest(), plan({ issuerVersion: 8 }).digest());
});

test('invite11_stale_role', () => {
  assert.notEqual(plan({ roleVersion: 4 }).digest(), plan({ roleVersion: 5 }).digest());
});

test('invite12_scope_escalation_denied', () => {
  assert.throws(() => new DelegationPolicy().assert({ roleKinds: ['custom'], issuerPermissions: new Set(['order.read']), issuerDenies: new Set<string>(), targetPermissions: ['order.read'], scopeAllowed: false }), delegationDenied);
});

test('invite13_owner_delegation_denied', () => {
  assert.throws(() => new DelegationPolicy().assert({ roleKinds: ['owner'], issuerPermissions: new Set(['order.read']), issuerDenies: new Set<string>(), targetPermissions: ['order.read'], scopeAllowed: true }), ownerTransferRequired);
});

test('invite14_concurrent_redeem_one_wins', async () => {
  const store = new VersionedInvitationStore(signin());
  const outcomes = await Promise.allSettled(Array.from({ length: 100 }, () => store.consume(ACTIVE_AT, 1)));
  assert.equal(outcomes.filter(({ status }) => status === 'fulfilled').length, 1);
  assert.equal(outcomes.filter(({ status }) => status === 'rejected').length, 99);
});

test('invite15_navigation_api_consistency', () => {
  const navigation = OperationCatalog.get('navigation.tree.read');
  assert.equal(navigation.assuranceLevel, 'session');
  assert.equal(navigation.cachePolicy, 'etag');
  assert.equal(navigation.permission, null);
  for (const node of NAVIGATION_CATALOG) {
    const entry = OperationCatalog.get(node.entry);
    assert.ok(node.capabilities.includes(entry.capability), `${node.id} capability differs from ${entry.id}`);
    if (entry.permission !== null) assert.ok(node.permissions.includes(entry.permission), `${node.id} permission differs from ${entry.id}`);
  }
});

function signin(override: Partial<InvitationState> = {}): Invitation {
  return new Invitation(Object.freeze({ ...base(), ...override }));
}
function enrollment(): Invitation {
  return new Invitation(Object.freeze({ ...base(), kind: 'enrollment', membership: 'membership:invited', principal: null, recipientHash: Buffer.alloc(32, 2), policy: 'registration:one', termsHash: 'b'.repeat(64) }));
}
function base(): InvitationState {
  return Object.freeze({
    id: 'invitation:one',
    kind: 'signin',
    target: 'storefront',
    organization: 'mall:one',
    membership: 'membership:one',
    principal: 'principal:one',
    recipientHash: null,
    keyVersion: 'current',
    issuer: 'membership:issuer',
    issuerAccessVersion: 7,
    grantDigest: 'a'.repeat(64),
    assurance: 1,
    maxUses: 1,
    useCount: 0,
    notBefore: new Date('2026-01-01T00:00:00.000Z'),
    expiresAt: new Date('2099-01-01T00:00:00.000Z'),
    status: 'active',
    policy: null,
    termsHash: null,
    reason: 'member invitation',
    version: 1,
  });
}
function plan(change: Readonly<{ issuerVersion?: number; roleVersion?: number }>): GrantPlan {
  return new GrantPlan(
    'storefront',
    'mall:one',
    'membership:one',
    'principal:one',
    [{ id: 'role:member', version: change.roleVersion ?? 4, kind: 'custom', expiresAt: null }],
    [{ code: 'order.read', effect: 'allow', role: 'role:member', roleVersion: change.roleVersion ?? 4 }],
    [{ id: 'scope:one', kind: 'mall', scope: 'mall:one', path: 'mall:one', effect: 'allow', version: change.issuerVersion ?? 7, effectiveAt: '2026-01-01T00:00:00.000Z', expiresAt: null }],
    1,
    null,
    null
  );
}
class VersionedInvitationStore {
  constructor(private invitation: Invitation) {}

  async consume(now: Date, expectedVersion: number): Promise<Invitation> {
    await Promise.resolve();
    if (this.invitation.state.version !== expectedVersion) throw new DomainError('VERSION_CONFLICT');
    const next = this.invitation.consume(now);
    this.invitation = next;
    return next;
  }
}
function invitationInvalid(error: unknown): boolean {
  return error instanceof DomainError && error.code === 'INVITATION_INVALID';
}
function delegationDenied(error: unknown): boolean {
  return error instanceof DomainError && error.code === 'DELEGATION_DENIED';
}
function ownerTransferRequired(error: unknown): boolean {
  return error instanceof DomainError && error.code === 'OWNER_TRANSFER_REQUIRED';
}
