import type { OperationId } from '@shop/contract';

export const SESSION_TICKET_OPERATION_IDS = Object.freeze([
  'identity.sessions.create',
  'identity.tickets.exchange',
  'identity.session.read',
  'identity.session.delete',
  'identity.sessions.read',
  'identity.sessions.revoke',
] as const satisfies readonly OperationId[]);

export const REGISTRATION_OPERATION_IDS = Object.freeze([
  'identity.challenges.create',
  'identity.members.create',
] as const satisfies readonly OperationId[]);

export const MEMBERSHIP_INVITATION_OPERATION_IDS = Object.freeze([
  'identity.invitations.read',
  'identity.storefronts.read',
  'identity.invitations.create',
  'identity.invitations.revoke',
  'identity.members.manage',
] as const satisfies readonly OperationId[]);

export const CREDENTIAL_OPERATION_IDS = Object.freeze([
  'identity.members.reset',
  'identity.password.change',
  'identity.password.verify',
  'identity.password.reset',
] as const satisfies readonly OperationId[]);

export const MOBILE_WECHAT_OPERATION_IDS = Object.freeze([
  'identity.mobile.challenge',
  'identity.mobile.manage',
  'identity.stepup.start',
  'identity.stepup.complete',
] as const satisfies readonly OperationId[]);

export const IDENTITY_CORE_OPERATION_IDS = Object.freeze([
  'identity.sessions.create',
  'identity.tickets.exchange',
  'identity.session.read',
  'identity.session.delete',
  'identity.sessions.read',
  'identity.sessions.revoke',
  'identity.challenges.create',
  'identity.invitations.read',
  'identity.storefronts.read',
  'identity.invitations.create',
  'identity.invitations.revoke',
  'identity.members.create',
  'identity.members.manage',
  'identity.members.reset',
  'identity.password.change',
  'identity.password.verify',
  'identity.password.reset',
  'identity.mobile.challenge',
  'identity.mobile.manage',
  'identity.stepup.start',
  'identity.stepup.complete',
] as const satisfies readonly OperationId[]);

const IDENTITY_REGISTRATION_CORE_OPERATION_IDS = Object.freeze([
  'identity.sessions.create',
  'identity.tickets.exchange',
  'identity.session.read',
  'identity.session.delete',
  'identity.challenges.create',
  'identity.invitations.read',
  'identity.storefronts.read',
  'identity.invitations.create',
  'identity.invitations.revoke',
  'identity.members.create',
  'identity.password.reset',
  'identity.password.verify',
  'identity.mobile.challenge',
  'identity.mobile.manage',
  'identity.stepup.start',
  'identity.stepup.complete',
] as const satisfies readonly OperationId[]);

export const IDENTITY_REGISTRATION_OPERATION_IDS = Object.freeze([
  ...IDENTITY_REGISTRATION_CORE_OPERATION_IDS,
  'identity.wechat.session',
  'identity.wechat.bind',
] as const satisfies readonly OperationId[]);

export function identityRegistrationCoreOperationIds(): readonly OperationId[] {
  return IDENTITY_REGISTRATION_CORE_OPERATION_IDS;
}
