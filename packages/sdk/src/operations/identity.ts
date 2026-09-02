// Generated from definitions/operations.yml. Do not edit.
import type { OperationId } from '@shop/contract';
import { ApiClient } from '../ApiClient';
import { FetchTransport } from '../FetchTransport';
import { bindEventOperation, bindOperation, defineOperation, type EventOperationMethod, type OperationExecutor, type OperationMethod } from '../OperationDescriptor';

export const IDENTITY_OPERATION_IDS = Object.freeze([
  "identity.sessions.create",
  "identity.sessions.complete",
  "identity.tickets.exchange",
  "identity.session.read",
  "identity.session.delete",
  "identity.sessions.read",
  "identity.sessions.revoke",
  "identity.memberships.read",
  "identity.memberships.switch",
  "identity.challenges.create",
  "identity.mobile.challenges.create",
  "identity.invitations.resolve",
  "identity.invitations.read",
  "identity.invitations.create",
  "identity.invitations.revoke",
  "identity.enrollments.read",
  "identity.enrollments.complete",
  "identity.members.manage",
  "identity.password.change",
  "identity.password.verify",
  "identity.password.reset",
  "identity.mobile.manage",
  "identity.stepup.start",
  "identity.stepup.complete",
  "identity.stepup.disable",
  "identity.providers.read",
  "identity.federations.start",
  "identity.federations.callback",
  "identity.federations.selection.read",
  "identity.federations.complete",
  "identity.links.read",
  "identity.links.create",
  "identity.links.revoke",
  "identity.providers.manage",
  "identity.providers.test",
] as const satisfies readonly OperationId[]);

export interface IdentityOperations {
  readonly sessionsCreate: OperationMethod<"identity.sessions.create">;
  readonly sessionsComplete: OperationMethod<"identity.sessions.complete">;
  readonly ticketsExchange: OperationMethod<"identity.tickets.exchange">;
  readonly sessionRead: OperationMethod<"identity.session.read">;
  readonly sessionDelete: OperationMethod<"identity.session.delete">;
  readonly sessionsRead: OperationMethod<"identity.sessions.read">;
  readonly sessionsRevoke: OperationMethod<"identity.sessions.revoke">;
  readonly membershipsRead: OperationMethod<"identity.memberships.read">;
  readonly membershipsSwitch: OperationMethod<"identity.memberships.switch">;
  readonly challengesCreate: OperationMethod<"identity.challenges.create">;
  readonly mobileChallengesCreate: OperationMethod<"identity.mobile.challenges.create">;
  readonly invitationsResolve: OperationMethod<"identity.invitations.resolve">;
  readonly invitationsRead: OperationMethod<"identity.invitations.read">;
  readonly invitationsCreate: OperationMethod<"identity.invitations.create">;
  readonly invitationsRevoke: OperationMethod<"identity.invitations.revoke">;
  readonly enrollmentsRead: OperationMethod<"identity.enrollments.read">;
  readonly enrollmentsComplete: OperationMethod<"identity.enrollments.complete">;
  readonly membersManage: OperationMethod<"identity.members.manage">;
  readonly passwordChange: OperationMethod<"identity.password.change">;
  readonly passwordVerify: OperationMethod<"identity.password.verify">;
  readonly passwordReset: OperationMethod<"identity.password.reset">;
  readonly mobileManage: OperationMethod<"identity.mobile.manage">;
  readonly stepupStart: OperationMethod<"identity.stepup.start">;
  readonly stepupComplete: OperationMethod<"identity.stepup.complete">;
  readonly stepupDisable: OperationMethod<"identity.stepup.disable">;
  readonly providersRead: OperationMethod<"identity.providers.read">;
  readonly federationsStart: OperationMethod<"identity.federations.start">;
  readonly federationsCallback: OperationMethod<"identity.federations.callback">;
  readonly federationsSelectionRead: OperationMethod<"identity.federations.selection.read">;
  readonly federationsComplete: OperationMethod<"identity.federations.complete">;
  readonly linksRead: OperationMethod<"identity.links.read">;
  readonly linksCreate: OperationMethod<"identity.links.create">;
  readonly linksRevoke: OperationMethod<"identity.links.revoke">;
  readonly providersManage: OperationMethod<"identity.providers.manage">;
  readonly providersTest: OperationMethod<"identity.providers.test">;
}

export function createFetchIdentity(baseUrl: string): IdentityOperations { return createIdentityOperations(new ApiClient(baseUrl, new FetchTransport())); }

export function createIdentityOperations(client: OperationExecutor): IdentityOperations { return Object.freeze({
    sessionsCreate: bindSessionsCreate(client),
    sessionsComplete: bindSessionsComplete(client),
    ticketsExchange: bindTicketsExchange(client),
    sessionRead: bindSessionRead(client),
    sessionDelete: bindSessionDelete(client),
    sessionsRead: bindSessionsRead(client),
    sessionsRevoke: bindSessionsRevoke(client),
    membershipsRead: bindMembershipsRead(client),
    membershipsSwitch: bindMembershipsSwitch(client),
    challengesCreate: bindChallengesCreate(client),
    mobileChallengesCreate: bindMobileChallengesCreate(client),
    invitationsResolve: bindInvitationsResolve(client),
    invitationsRead: bindInvitationsRead(client),
    invitationsCreate: bindInvitationsCreate(client),
    invitationsRevoke: bindInvitationsRevoke(client),
    enrollmentsRead: bindEnrollmentsRead(client),
    enrollmentsComplete: bindEnrollmentsComplete(client),
    membersManage: bindMembersManage(client),
    passwordChange: bindPasswordChange(client),
    passwordVerify: bindPasswordVerify(client),
    passwordReset: bindPasswordReset(client),
    mobileManage: bindMobileManage(client),
    stepupStart: bindStepupStart(client),
    stepupComplete: bindStepupComplete(client),
    stepupDisable: bindStepupDisable(client),
    providersRead: bindProvidersRead(client),
    federationsStart: bindFederationsStart(client),
    federationsCallback: bindFederationsCallback(client),
    federationsSelectionRead: bindFederationsSelectionRead(client),
    federationsComplete: bindFederationsComplete(client),
    linksRead: bindLinksRead(client),
    linksCreate: bindLinksCreate(client),
    linksRevoke: bindLinksRevoke(client),
    providersManage: bindProvidersManage(client),
    providersTest: bindProvidersTest(client),
  }); }

export function createFetchIdentitySessionsCreate(baseUrl: string): OperationMethod<"identity.sessions.create"> { return bindSessionsCreate(new ApiClient(baseUrl, new FetchTransport())); }

function bindSessionsCreate(client: OperationExecutor): OperationMethod<"identity.sessions.create"> { return bindOperation(client, defineOperation({"id":"identity.sessions.create","method":"POST","path":"/api/v1/identity/sessions","audience":"public","targets":["console","storefront"],"responseMode":"json","idempotent":false,"timeout":800})); }

export function createFetchIdentitySessionsComplete(baseUrl: string): OperationMethod<"identity.sessions.complete"> { return bindSessionsComplete(new ApiClient(baseUrl, new FetchTransport())); }

function bindSessionsComplete(client: OperationExecutor): OperationMethod<"identity.sessions.complete"> { return bindOperation(client, defineOperation({"id":"identity.sessions.complete","method":"POST","path":"/api/v1/identity/sessions/complete","audience":"public","targets":["console","storefront"],"responseMode":"json","idempotent":false,"timeout":800})); }

export function createFetchIdentityTicketsExchange(baseUrl: string): OperationMethod<"identity.tickets.exchange"> { return bindTicketsExchange(new ApiClient(baseUrl, new FetchTransport())); }

function bindTicketsExchange(client: OperationExecutor): OperationMethod<"identity.tickets.exchange"> { return bindOperation(client, defineOperation({"id":"identity.tickets.exchange","method":"POST","path":"/api/v1/identity/tickets/exchange","audience":"public","targets":["console","storefront"],"responseMode":"json","idempotent":false,"timeout":800})); }

export function createFetchIdentitySessionRead(baseUrl: string): OperationMethod<"identity.session.read"> { return bindSessionRead(new ApiClient(baseUrl, new FetchTransport())); }

function bindSessionRead(client: OperationExecutor): OperationMethod<"identity.session.read"> { return bindOperation(client, defineOperation({"id":"identity.session.read","method":"GET","path":"/api/v1/identity/session","audience":"public","targets":["console","storefront"],"responseMode":"json","idempotent":true,"timeout":500})); }

export function createFetchIdentitySessionDelete(baseUrl: string): OperationMethod<"identity.session.delete"> { return bindSessionDelete(new ApiClient(baseUrl, new FetchTransport())); }

function bindSessionDelete(client: OperationExecutor): OperationMethod<"identity.session.delete"> { return bindOperation(client, defineOperation({"id":"identity.session.delete","method":"DELETE","path":"/api/v1/identity/session","audience":"public","targets":["console","storefront"],"responseMode":"json","idempotent":true,"timeout":800})); }

export function createFetchIdentitySessionsRead(baseUrl: string): OperationMethod<"identity.sessions.read"> { return bindSessionsRead(new ApiClient(baseUrl, new FetchTransport())); }

function bindSessionsRead(client: OperationExecutor): OperationMethod<"identity.sessions.read"> { return bindOperation(client, defineOperation({"id":"identity.sessions.read","method":"GET","path":"/api/v1/identity/sessions","audience":"public","targets":["console","storefront"],"responseMode":"json","idempotent":true,"timeout":500})); }

export function createFetchIdentitySessionsRevoke(baseUrl: string): OperationMethod<"identity.sessions.revoke"> { return bindSessionsRevoke(new ApiClient(baseUrl, new FetchTransport())); }

function bindSessionsRevoke(client: OperationExecutor): OperationMethod<"identity.sessions.revoke"> { return bindOperation(client, defineOperation({"id":"identity.sessions.revoke","method":"DELETE","path":"/api/v1/identity/sessions/{sessionid}","audience":"public","targets":["console","storefront"],"responseMode":"json","idempotent":true,"timeout":800})); }

export function createFetchIdentityMembershipsRead(baseUrl: string): OperationMethod<"identity.memberships.read"> { return bindMembershipsRead(new ApiClient(baseUrl, new FetchTransport())); }

function bindMembershipsRead(client: OperationExecutor): OperationMethod<"identity.memberships.read"> { return bindOperation(client, defineOperation({"id":"identity.memberships.read","method":"GET","path":"/api/v1/identity/memberships","audience":"storefront","targets":["storefront"],"responseMode":"json","idempotent":true,"timeout":500})); }

export function createFetchIdentityMembershipsSwitch(baseUrl: string): OperationMethod<"identity.memberships.switch"> { return bindMembershipsSwitch(new ApiClient(baseUrl, new FetchTransport())); }

function bindMembershipsSwitch(client: OperationExecutor): OperationMethod<"identity.memberships.switch"> { return bindOperation(client, defineOperation({"id":"identity.memberships.switch","method":"PUT","path":"/api/v1/identity/memberships/current","audience":"storefront","targets":["storefront"],"responseMode":"json","idempotent":false,"timeout":800})); }

export function createFetchIdentityChallengesCreate(baseUrl: string): OperationMethod<"identity.challenges.create"> { return bindChallengesCreate(new ApiClient(baseUrl, new FetchTransport())); }

function bindChallengesCreate(client: OperationExecutor): OperationMethod<"identity.challenges.create"> { return bindOperation(client, defineOperation({"id":"identity.challenges.create","method":"POST","path":"/api/v1/identity/challenges","audience":"public","targets":["console","storefront"],"responseMode":"json","idempotent":false,"timeout":800})); }

export function createFetchIdentityMobileChallengesCreate(baseUrl: string): OperationMethod<"identity.mobile.challenges.create"> { return bindMobileChallengesCreate(new ApiClient(baseUrl, new FetchTransport())); }

function bindMobileChallengesCreate(client: OperationExecutor): OperationMethod<"identity.mobile.challenges.create"> { return bindOperation(client, defineOperation({"id":"identity.mobile.challenges.create","method":"POST","path":"/api/v1/identity/mobile/challenges","audience":"public","targets":["console","storefront"],"responseMode":"json","idempotent":false,"timeout":800})); }

export function createFetchIdentityInvitationsResolve(baseUrl: string): OperationMethod<"identity.invitations.resolve"> { return bindInvitationsResolve(new ApiClient(baseUrl, new FetchTransport())); }

function bindInvitationsResolve(client: OperationExecutor): OperationMethod<"identity.invitations.resolve"> { return bindOperation(client, defineOperation({"id":"identity.invitations.resolve","method":"POST","path":"/api/v1/identity/invitations/resolve","audience":"public","targets":["console","storefront"],"responseMode":"json","idempotent":false,"timeout":800})); }

export function createFetchIdentityInvitationsRead(baseUrl: string): OperationMethod<"identity.invitations.read"> { return bindInvitationsRead(new ApiClient(baseUrl, new FetchTransport())); }

function bindInvitationsRead(client: OperationExecutor): OperationMethod<"identity.invitations.read"> { return bindOperation(client, defineOperation({"id":"identity.invitations.read","method":"GET","path":"/api/v1/identity/invitations","audience":"console","targets":["console"],"responseMode":"json","idempotent":true,"timeout":500})); }

export function createFetchIdentityInvitationsCreate(baseUrl: string): OperationMethod<"identity.invitations.create"> { return bindInvitationsCreate(new ApiClient(baseUrl, new FetchTransport())); }

function bindInvitationsCreate(client: OperationExecutor): OperationMethod<"identity.invitations.create"> { return bindOperation(client, defineOperation({"id":"identity.invitations.create","method":"POST","path":"/api/v1/identity/invitations","audience":"console","targets":["console"],"responseMode":"json","idempotent":true,"timeout":800})); }

export function createFetchIdentityInvitationsRevoke(baseUrl: string): OperationMethod<"identity.invitations.revoke"> { return bindInvitationsRevoke(new ApiClient(baseUrl, new FetchTransport())); }

function bindInvitationsRevoke(client: OperationExecutor): OperationMethod<"identity.invitations.revoke"> { return bindOperation(client, defineOperation({"id":"identity.invitations.revoke","method":"DELETE","path":"/api/v1/identity/invitations/{id}","audience":"console","targets":["console"],"responseMode":"json","idempotent":true,"timeout":800})); }

export function createFetchIdentityEnrollmentsRead(baseUrl: string): OperationMethod<"identity.enrollments.read"> { return bindEnrollmentsRead(new ApiClient(baseUrl, new FetchTransport())); }

function bindEnrollmentsRead(client: OperationExecutor): OperationMethod<"identity.enrollments.read"> { return bindOperation(client, defineOperation({"id":"identity.enrollments.read","method":"GET","path":"/api/v1/identity/enrollments/{id}","audience":"public","targets":["console","storefront"],"responseMode":"json","idempotent":true,"timeout":500})); }

export function createFetchIdentityEnrollmentsComplete(baseUrl: string): OperationMethod<"identity.enrollments.complete"> { return bindEnrollmentsComplete(new ApiClient(baseUrl, new FetchTransport())); }

function bindEnrollmentsComplete(client: OperationExecutor): OperationMethod<"identity.enrollments.complete"> { return bindOperation(client, defineOperation({"id":"identity.enrollments.complete","method":"POST","path":"/api/v1/identity/enrollments/{id}/complete","audience":"public","targets":["console","storefront"],"responseMode":"json","idempotent":true,"timeout":800})); }

export function createFetchIdentityMembersManage(baseUrl: string): OperationMethod<"identity.members.manage"> { return bindMembersManage(new ApiClient(baseUrl, new FetchTransport())); }

function bindMembersManage(client: OperationExecutor): OperationMethod<"identity.members.manage"> { return bindOperation(client, defineOperation({"id":"identity.members.manage","method":"PUT","path":"/api/v1/identity/members/{membershipid}","audience":"console","targets":["console"],"responseMode":"json","idempotent":true,"timeout":800})); }

export function createFetchIdentityPasswordChange(baseUrl: string): OperationMethod<"identity.password.change"> { return bindPasswordChange(new ApiClient(baseUrl, new FetchTransport())); }

function bindPasswordChange(client: OperationExecutor): OperationMethod<"identity.password.change"> { return bindOperation(client, defineOperation({"id":"identity.password.change","method":"PUT","path":"/api/v1/identity/password","audience":"public","targets":["console","storefront"],"responseMode":"json","idempotent":true,"timeout":800})); }

export function createFetchIdentityPasswordVerify(baseUrl: string): OperationMethod<"identity.password.verify"> { return bindPasswordVerify(new ApiClient(baseUrl, new FetchTransport())); }

function bindPasswordVerify(client: OperationExecutor): OperationMethod<"identity.password.verify"> { return bindOperation(client, defineOperation({"id":"identity.password.verify","method":"POST","path":"/api/v1/identity/password/verify","audience":"public","targets":["console","storefront"],"responseMode":"json","idempotent":false,"timeout":800})); }

export function createFetchIdentityPasswordReset(baseUrl: string): OperationMethod<"identity.password.reset"> { return bindPasswordReset(new ApiClient(baseUrl, new FetchTransport())); }

function bindPasswordReset(client: OperationExecutor): OperationMethod<"identity.password.reset"> { return bindOperation(client, defineOperation({"id":"identity.password.reset","method":"POST","path":"/api/v1/identity/password/reset","audience":"public","targets":["console","storefront"],"responseMode":"json","idempotent":false,"timeout":800})); }

export function createFetchIdentityMobileManage(baseUrl: string): OperationMethod<"identity.mobile.manage"> { return bindMobileManage(new ApiClient(baseUrl, new FetchTransport())); }

function bindMobileManage(client: OperationExecutor): OperationMethod<"identity.mobile.manage"> { return bindOperation(client, defineOperation({"id":"identity.mobile.manage","method":"PUT","path":"/api/v1/identity/mobile","audience":"public","targets":["console","storefront"],"responseMode":"json","idempotent":true,"timeout":800})); }

export function createFetchIdentityStepupStart(baseUrl: string): OperationMethod<"identity.stepup.start"> { return bindStepupStart(new ApiClient(baseUrl, new FetchTransport())); }

function bindStepupStart(client: OperationExecutor): OperationMethod<"identity.stepup.start"> { return bindOperation(client, defineOperation({"id":"identity.stepup.start","method":"POST","path":"/api/v1/identity/stepup/challenges","audience":"public","targets":["console","storefront"],"responseMode":"json","idempotent":false,"timeout":800})); }

export function createFetchIdentityStepupComplete(baseUrl: string): OperationMethod<"identity.stepup.complete"> { return bindStepupComplete(new ApiClient(baseUrl, new FetchTransport())); }

function bindStepupComplete(client: OperationExecutor): OperationMethod<"identity.stepup.complete"> { return bindOperation(client, defineOperation({"id":"identity.stepup.complete","method":"POST","path":"/api/v1/identity/stepup/verifications","audience":"public","targets":["console","storefront"],"responseMode":"json","idempotent":false,"timeout":800})); }

export function createFetchIdentityStepupDisable(baseUrl: string): OperationMethod<"identity.stepup.disable"> { return bindStepupDisable(new ApiClient(baseUrl, new FetchTransport())); }

function bindStepupDisable(client: OperationExecutor): OperationMethod<"identity.stepup.disable"> { return bindOperation(client, defineOperation({"id":"identity.stepup.disable","method":"DELETE","path":"/api/v1/identity/stepup","audience":"public","targets":["console","storefront"],"responseMode":"json","idempotent":true,"timeout":800})); }

export function createFetchIdentityProvidersRead(baseUrl: string): OperationMethod<"identity.providers.read"> { return bindProvidersRead(new ApiClient(baseUrl, new FetchTransport())); }

function bindProvidersRead(client: OperationExecutor): OperationMethod<"identity.providers.read"> { return bindOperation(client, defineOperation({"id":"identity.providers.read","method":"GET","path":"/api/v1/identity/providers","audience":"public","targets":["console","storefront"],"responseMode":"json","idempotent":true,"timeout":300})); }

export function createFetchIdentityFederationsStart(baseUrl: string): OperationMethod<"identity.federations.start"> { return bindFederationsStart(new ApiClient(baseUrl, new FetchTransport())); }

function bindFederationsStart(client: OperationExecutor): OperationMethod<"identity.federations.start"> { return bindOperation(client, defineOperation({"id":"identity.federations.start","method":"POST","path":"/api/v1/identity/federations","audience":"public","targets":["console","storefront"],"responseMode":"redirect","idempotent":false,"timeout":1000})); }

export function createFetchIdentityFederationsCallback(baseUrl: string): OperationMethod<"identity.federations.callback"> { return bindFederationsCallback(new ApiClient(baseUrl, new FetchTransport())); }

function bindFederationsCallback(client: OperationExecutor): OperationMethod<"identity.federations.callback"> { return bindOperation(client, defineOperation({"id":"identity.federations.callback","method":"GET","path":"/api/v1/identity/federations/{providerid}/callback","audience":"public","targets":["console","storefront"],"responseMode":"redirect","idempotent":true,"timeout":3000})); }

export function createFetchIdentityFederationsSelectionRead(baseUrl: string): OperationMethod<"identity.federations.selection.read"> { return bindFederationsSelectionRead(new ApiClient(baseUrl, new FetchTransport())); }

function bindFederationsSelectionRead(client: OperationExecutor): OperationMethod<"identity.federations.selection.read"> { return bindOperation(client, defineOperation({"id":"identity.federations.selection.read","method":"GET","path":"/api/v1/identity/federations/selection","audience":"public","targets":["console","storefront"],"responseMode":"json","idempotent":true,"timeout":300})); }

export function createFetchIdentityFederationsComplete(baseUrl: string): OperationMethod<"identity.federations.complete"> { return bindFederationsComplete(new ApiClient(baseUrl, new FetchTransport())); }

function bindFederationsComplete(client: OperationExecutor): OperationMethod<"identity.federations.complete"> { return bindOperation(client, defineOperation({"id":"identity.federations.complete","method":"POST","path":"/api/v1/identity/federations/selection","audience":"public","targets":["console","storefront"],"responseMode":"redirect","idempotent":false,"timeout":1000})); }

export function createFetchIdentityLinksRead(baseUrl: string): OperationMethod<"identity.links.read"> { return bindLinksRead(new ApiClient(baseUrl, new FetchTransport())); }

function bindLinksRead(client: OperationExecutor): OperationMethod<"identity.links.read"> { return bindOperation(client, defineOperation({"id":"identity.links.read","method":"GET","path":"/api/v1/identity/links","audience":"public","targets":["console","storefront"],"responseMode":"json","idempotent":true,"timeout":300})); }

export function createFetchIdentityLinksCreate(baseUrl: string): OperationMethod<"identity.links.create"> { return bindLinksCreate(new ApiClient(baseUrl, new FetchTransport())); }

function bindLinksCreate(client: OperationExecutor): OperationMethod<"identity.links.create"> { return bindOperation(client, defineOperation({"id":"identity.links.create","method":"POST","path":"/api/v1/identity/links","audience":"public","targets":["console","storefront"],"responseMode":"redirect","idempotent":false,"timeout":1500})); }

export function createFetchIdentityLinksRevoke(baseUrl: string): OperationMethod<"identity.links.revoke"> { return bindLinksRevoke(new ApiClient(baseUrl, new FetchTransport())); }

function bindLinksRevoke(client: OperationExecutor): OperationMethod<"identity.links.revoke"> { return bindOperation(client, defineOperation({"id":"identity.links.revoke","method":"DELETE","path":"/api/v1/identity/links/{linkid}","audience":"public","targets":["console","storefront"],"responseMode":"empty","idempotent":false,"timeout":800})); }

export function createFetchIdentityProvidersManage(baseUrl: string): OperationMethod<"identity.providers.manage"> { return bindProvidersManage(new ApiClient(baseUrl, new FetchTransport())); }

function bindProvidersManage(client: OperationExecutor): OperationMethod<"identity.providers.manage"> { return bindOperation(client, defineOperation({"id":"identity.providers.manage","method":"PUT","path":"/api/v1/identity/providers/{providerid}","audience":"console","targets":["console"],"responseMode":"json","idempotent":false,"timeout":1000})); }

export function createFetchIdentityProvidersTest(baseUrl: string): OperationMethod<"identity.providers.test"> { return bindProvidersTest(new ApiClient(baseUrl, new FetchTransport())); }

function bindProvidersTest(client: OperationExecutor): OperationMethod<"identity.providers.test"> { return bindOperation(client, defineOperation({"id":"identity.providers.test","method":"POST","path":"/api/v1/identity/providers/{providerid}/tests","audience":"console","targets":["console"],"responseMode":"json","idempotent":false,"timeout":3000})); }
