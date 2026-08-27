// Generated from definitions/operations.yml. Do not edit.
import type { OperationId } from '@shop/contract';
import { ApiClient } from '../ApiClient';
import { FetchTransport } from '../FetchTransport';
import { bindOperation, defineStructuralOperation, type OperationExecutor, type OperationMethod } from '../OperationDescriptor';

export const IDENTITY_OPERATION_IDS = /* @__PURE__ */ Object.freeze([
  "identity.sessions.create",
  "identity.tickets.exchange",
  "identity.session.read",
  "identity.session.delete",
  "identity.sessions.read",
  "identity.sessions.revoke",
  "identity.challenges.create",
  "identity.invitations.read",
  "identity.invitations.create",
  "identity.invitations.revoke",
  "identity.members.create",
  "identity.members.manage",
<<<<<<< HEAD
  "identity.members.reset",
  "identity.password.change",
  "identity.password.verify",
  "identity.password.reset",
  "identity.mobile.challenge",
=======
  "identity.password.change",
  "identity.password.verify",
  "identity.password.reset",
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
  "identity.mobile.manage",
  "identity.stepup.start",
  "identity.stepup.complete",
  "identity.wechat.session",
  "identity.wechat.bind",
] as const satisfies readonly OperationId[]);

export interface IdentityOperations {
  readonly sessionsCreate: OperationMethod<"identity.sessions.create">;
  readonly ticketsExchange: OperationMethod<"identity.tickets.exchange">;
  readonly sessionRead: OperationMethod<"identity.session.read">;
  readonly sessionDelete: OperationMethod<"identity.session.delete">;
  readonly sessionsRead: OperationMethod<"identity.sessions.read">;
  readonly sessionsRevoke: OperationMethod<"identity.sessions.revoke">;
  readonly challengesCreate: OperationMethod<"identity.challenges.create">;
  readonly invitationsRead: OperationMethod<"identity.invitations.read">;
  readonly invitationsCreate: OperationMethod<"identity.invitations.create">;
  readonly invitationsRevoke: OperationMethod<"identity.invitations.revoke">;
  readonly membersCreate: OperationMethod<"identity.members.create">;
  readonly membersManage: OperationMethod<"identity.members.manage">;
<<<<<<< HEAD
  readonly membersReset: OperationMethod<"identity.members.reset">;
  readonly passwordChange: OperationMethod<"identity.password.change">;
  readonly passwordVerify: OperationMethod<"identity.password.verify">;
  readonly passwordReset: OperationMethod<"identity.password.reset">;
  readonly mobileChallenge: OperationMethod<"identity.mobile.challenge">;
=======
  readonly passwordChange: OperationMethod<"identity.password.change">;
  readonly passwordVerify: OperationMethod<"identity.password.verify">;
  readonly passwordReset: OperationMethod<"identity.password.reset">;
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
  readonly mobileManage: OperationMethod<"identity.mobile.manage">;
  readonly stepupStart: OperationMethod<"identity.stepup.start">;
  readonly stepupComplete: OperationMethod<"identity.stepup.complete">;
  readonly wechatSession: OperationMethod<"identity.wechat.session">;
  readonly wechatBind: OperationMethod<"identity.wechat.bind">;
}

export function createFetchIdentity(baseUrl: string): IdentityOperations {
  return createIdentityOperations(new ApiClient(baseUrl, new FetchTransport()));
}

export function createIdentityOperations(client: OperationExecutor): IdentityOperations {
  return Object.freeze({
    sessionsCreate: bindSessionsCreate(client),
    ticketsExchange: bindTicketsExchange(client),
    sessionRead: bindSessionRead(client),
    sessionDelete: bindSessionDelete(client),
    sessionsRead: bindSessionsRead(client),
    sessionsRevoke: bindSessionsRevoke(client),
    challengesCreate: bindChallengesCreate(client),
    invitationsRead: bindInvitationsRead(client),
    invitationsCreate: bindInvitationsCreate(client),
    invitationsRevoke: bindInvitationsRevoke(client),
    membersCreate: bindMembersCreate(client),
    membersManage: bindMembersManage(client),
<<<<<<< HEAD
    membersReset: bindMembersReset(client),
    passwordChange: bindPasswordChange(client),
    passwordVerify: bindPasswordVerify(client),
    passwordReset: bindPasswordReset(client),
    mobileChallenge: bindMobileChallenge(client),
=======
    passwordChange: bindPasswordChange(client),
    passwordVerify: bindPasswordVerify(client),
    passwordReset: bindPasswordReset(client),
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
    mobileManage: bindMobileManage(client),
    stepupStart: bindStepupStart(client),
    stepupComplete: bindStepupComplete(client),
    wechatSession: bindWechatSession(client),
    wechatBind: bindWechatBind(client),
  });
}

export function createFetchIdentitySessionsCreate(baseUrl: string): OperationMethod<"identity.sessions.create"> {
  return bindSessionsCreate(new ApiClient(baseUrl, new FetchTransport()));
}

function bindSessionsCreate(client: OperationExecutor): OperationMethod<"identity.sessions.create"> {
  return bindOperation(client, defineStructuralOperation({"id":"identity.sessions.create","method":"POST","path":"/api/v1/identity/sessions","audience":"public","idempotent":false,"pathKeys":[]}));
}

export function createFetchIdentityTicketsExchange(baseUrl: string): OperationMethod<"identity.tickets.exchange"> {
  return bindTicketsExchange(new ApiClient(baseUrl, new FetchTransport()));
}

function bindTicketsExchange(client: OperationExecutor): OperationMethod<"identity.tickets.exchange"> {
  return bindOperation(client, defineStructuralOperation({"id":"identity.tickets.exchange","method":"POST","path":"/api/v1/identity/tickets/exchange","audience":"public","idempotent":false,"pathKeys":[]}));
}

export function createFetchIdentitySessionRead(baseUrl: string): OperationMethod<"identity.session.read"> {
  return bindSessionRead(new ApiClient(baseUrl, new FetchTransport()));
}

function bindSessionRead(client: OperationExecutor): OperationMethod<"identity.session.read"> {
  return bindOperation(client, defineStructuralOperation({"id":"identity.session.read","method":"GET","path":"/api/v1/identity/session","audience":"member","idempotent":true,"pathKeys":[]}));
}

export function createFetchIdentitySessionDelete(baseUrl: string): OperationMethod<"identity.session.delete"> {
  return bindSessionDelete(new ApiClient(baseUrl, new FetchTransport()));
}

function bindSessionDelete(client: OperationExecutor): OperationMethod<"identity.session.delete"> {
  return bindOperation(client, defineStructuralOperation({"id":"identity.session.delete","method":"DELETE","path":"/api/v1/identity/session","audience":"member","idempotent":true,"pathKeys":[]}));
}

export function createFetchIdentitySessionsRead(baseUrl: string): OperationMethod<"identity.sessions.read"> {
  return bindSessionsRead(new ApiClient(baseUrl, new FetchTransport()));
}

function bindSessionsRead(client: OperationExecutor): OperationMethod<"identity.sessions.read"> {
  return bindOperation(client, defineStructuralOperation({"id":"identity.sessions.read","method":"GET","path":"/api/v1/identity/sessions","audience":"member","idempotent":true,"pathKeys":[]}));
}

export function createFetchIdentitySessionsRevoke(baseUrl: string): OperationMethod<"identity.sessions.revoke"> {
  return bindSessionsRevoke(new ApiClient(baseUrl, new FetchTransport()));
}

function bindSessionsRevoke(client: OperationExecutor): OperationMethod<"identity.sessions.revoke"> {
  return bindOperation(client, defineStructuralOperation({"id":"identity.sessions.revoke","method":"DELETE","path":"/api/v1/identity/sessions/{sessionid}","audience":"member","idempotent":true,"pathKeys":["sessionid"]}));
}

export function createFetchIdentityChallengesCreate(baseUrl: string): OperationMethod<"identity.challenges.create"> {
  return bindChallengesCreate(new ApiClient(baseUrl, new FetchTransport()));
}

function bindChallengesCreate(client: OperationExecutor): OperationMethod<"identity.challenges.create"> {
  return bindOperation(client, defineStructuralOperation({"id":"identity.challenges.create","method":"POST","path":"/api/v1/identity/challenges","audience":"public","idempotent":false,"pathKeys":[]}));
}

export function createFetchIdentityInvitationsRead(baseUrl: string): OperationMethod<"identity.invitations.read"> {
  return bindInvitationsRead(new ApiClient(baseUrl, new FetchTransport()));
}

function bindInvitationsRead(client: OperationExecutor): OperationMethod<"identity.invitations.read"> {
  return bindOperation(client, defineStructuralOperation({"id":"identity.invitations.read","method":"POST","path":"/api/v1/identity/invitations/resolve","audience":"public","idempotent":false,"pathKeys":[]}));
}

export function createFetchIdentityInvitationsCreate(baseUrl: string): OperationMethod<"identity.invitations.create"> {
  return bindInvitationsCreate(new ApiClient(baseUrl, new FetchTransport()));
}

function bindInvitationsCreate(client: OperationExecutor): OperationMethod<"identity.invitations.create"> {
  return bindOperation(client, defineStructuralOperation({"id":"identity.invitations.create","method":"POST","path":"/api/v1/identity/invitations","audience":"operator","idempotent":false,"pathKeys":[]}));
}

export function createFetchIdentityInvitationsRevoke(baseUrl: string): OperationMethod<"identity.invitations.revoke"> {
  return bindInvitationsRevoke(new ApiClient(baseUrl, new FetchTransport()));
}

function bindInvitationsRevoke(client: OperationExecutor): OperationMethod<"identity.invitations.revoke"> {
  return bindOperation(client, defineStructuralOperation({"id":"identity.invitations.revoke","method":"DELETE","path":"/api/v1/identity/invitations/{invitationid}","audience":"operator","idempotent":true,"pathKeys":["invitationid"]}));
}

export function createFetchIdentityMembersCreate(baseUrl: string): OperationMethod<"identity.members.create"> {
  return bindMembersCreate(new ApiClient(baseUrl, new FetchTransport()));
}

function bindMembersCreate(client: OperationExecutor): OperationMethod<"identity.members.create"> {
  return bindOperation(client, defineStructuralOperation({"id":"identity.members.create","method":"POST","path":"/api/v1/identity/members","audience":"public","idempotent":false,"pathKeys":[]}));
}

export function createFetchIdentityMembersManage(baseUrl: string): OperationMethod<"identity.members.manage"> {
  return bindMembersManage(new ApiClient(baseUrl, new FetchTransport()));
}

function bindMembersManage(client: OperationExecutor): OperationMethod<"identity.members.manage"> {
  return bindOperation(client, defineStructuralOperation({"id":"identity.members.manage","method":"PUT","path":"/api/v1/identity/members/{membershipid}","audience":"operator","idempotent":true,"pathKeys":["membershipid"]}));
}

<<<<<<< HEAD
export function createFetchIdentityMembersReset(baseUrl: string): OperationMethod<"identity.members.reset"> {
  return bindMembersReset(new ApiClient(baseUrl, new FetchTransport()));
}

function bindMembersReset(client: OperationExecutor): OperationMethod<"identity.members.reset"> {
  return bindOperation(client, defineStructuralOperation({"id":"identity.members.reset","method":"PUT","path":"/api/v1/identity/members/{membershipid}/registration","audience":"operator","idempotent":true,"pathKeys":["membershipid"]}));
}

=======
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
export function createFetchIdentityPasswordChange(baseUrl: string): OperationMethod<"identity.password.change"> {
  return bindPasswordChange(new ApiClient(baseUrl, new FetchTransport()));
}

function bindPasswordChange(client: OperationExecutor): OperationMethod<"identity.password.change"> {
  return bindOperation(client, defineStructuralOperation({"id":"identity.password.change","method":"PUT","path":"/api/v1/identity/password","audience":"member","idempotent":true,"pathKeys":[]}));
}

export function createFetchIdentityPasswordVerify(baseUrl: string): OperationMethod<"identity.password.verify"> {
  return bindPasswordVerify(new ApiClient(baseUrl, new FetchTransport()));
}

function bindPasswordVerify(client: OperationExecutor): OperationMethod<"identity.password.verify"> {
  return bindOperation(client, defineStructuralOperation({"id":"identity.password.verify","method":"POST","path":"/api/v1/identity/password/verify","audience":"member","idempotent":false,"pathKeys":[]}));
}

export function createFetchIdentityPasswordReset(baseUrl: string): OperationMethod<"identity.password.reset"> {
  return bindPasswordReset(new ApiClient(baseUrl, new FetchTransport()));
}

function bindPasswordReset(client: OperationExecutor): OperationMethod<"identity.password.reset"> {
  return bindOperation(client, defineStructuralOperation({"id":"identity.password.reset","method":"POST","path":"/api/v1/identity/password/reset","audience":"public","idempotent":false,"pathKeys":[]}));
}

<<<<<<< HEAD
export function createFetchIdentityMobileChallenge(baseUrl: string): OperationMethod<"identity.mobile.challenge"> {
  return bindMobileChallenge(new ApiClient(baseUrl, new FetchTransport()));
}

function bindMobileChallenge(client: OperationExecutor): OperationMethod<"identity.mobile.challenge"> {
  return bindOperation(client, defineStructuralOperation({"id":"identity.mobile.challenge","method":"POST","path":"/api/v1/identity/mobile/challenges","audience":"member","idempotent":false,"pathKeys":[]}));
}

=======
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
export function createFetchIdentityMobileManage(baseUrl: string): OperationMethod<"identity.mobile.manage"> {
  return bindMobileManage(new ApiClient(baseUrl, new FetchTransport()));
}

function bindMobileManage(client: OperationExecutor): OperationMethod<"identity.mobile.manage"> {
  return bindOperation(client, defineStructuralOperation({"id":"identity.mobile.manage","method":"PUT","path":"/api/v1/identity/mobile","audience":"member","idempotent":true,"pathKeys":[]}));
}

export function createFetchIdentityStepupStart(baseUrl: string): OperationMethod<"identity.stepup.start"> {
  return bindStepupStart(new ApiClient(baseUrl, new FetchTransport()));
}

function bindStepupStart(client: OperationExecutor): OperationMethod<"identity.stepup.start"> {
  return bindOperation(client, defineStructuralOperation({"id":"identity.stepup.start","method":"POST","path":"/api/v1/identity/stepup/challenges","audience":"member","idempotent":false,"pathKeys":[]}));
}

export function createFetchIdentityStepupComplete(baseUrl: string): OperationMethod<"identity.stepup.complete"> {
  return bindStepupComplete(new ApiClient(baseUrl, new FetchTransport()));
}

function bindStepupComplete(client: OperationExecutor): OperationMethod<"identity.stepup.complete"> {
  return bindOperation(client, defineStructuralOperation({"id":"identity.stepup.complete","method":"POST","path":"/api/v1/identity/stepup/verifications","audience":"member","idempotent":false,"pathKeys":[]}));
}

export function createFetchIdentityWechatSession(baseUrl: string): OperationMethod<"identity.wechat.session"> {
  return bindWechatSession(new ApiClient(baseUrl, new FetchTransport()));
}

function bindWechatSession(client: OperationExecutor): OperationMethod<"identity.wechat.session"> {
  return bindOperation(client, defineStructuralOperation({"id":"identity.wechat.session","method":"POST","path":"/api/v1/identity/wechat/sessions","audience":"public","idempotent":false,"pathKeys":[]}));
}

export function createFetchIdentityWechatBind(baseUrl: string): OperationMethod<"identity.wechat.bind"> {
  return bindWechatBind(new ApiClient(baseUrl, new FetchTransport()));
}

function bindWechatBind(client: OperationExecutor): OperationMethod<"identity.wechat.bind"> {
  return bindOperation(client, defineStructuralOperation({"id":"identity.wechat.bind","method":"POST","path":"/api/v1/identity/wechat/bindings","audience":"member","idempotent":true,"pathKeys":[]}));
}
