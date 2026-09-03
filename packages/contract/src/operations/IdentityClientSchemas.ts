// Generated from definitions/operations.yml. Do not edit.
import type { OperationId, OperationInputFor, OperationOutputFor, Schema } from '..';
import { identityInputSchema } from '../schema/IdentityInputSchema';
import { SECURITY_OUTPUT_SCHEMAS } from '../schema/AccessSchema';
import { IDENTITY_OUTPUT_SCHEMAS } from '../schema/IdentitySchema';

const outputs = Object.freeze({ ...SECURITY_OUTPUT_SCHEMAS, ...IDENTITY_OUTPUT_SCHEMAS });
const schemas = Object.freeze({
  "identity.sessions.create": Object.freeze({ input: identityInputSchema("IdentitySessionsCreateInput", [], true), output: identityOutputSchema("IdentitySessionsCreateOutput") }),
  "identity.sessions.complete": Object.freeze({ input: identityInputSchema("IdentitySessionsCompleteInput", [], true), output: identityOutputSchema("IdentitySessionsCompleteOutput") }),
  "identity.tickets.exchange": Object.freeze({ input: identityInputSchema("IdentityTicketsExchangeInput", [], true), output: identityOutputSchema("IdentityTicketsExchangeOutput") }),
  "identity.session.read": Object.freeze({ input: identityInputSchema("IdentitySessionReadInput", [], false), output: identityOutputSchema("IdentitySessionReadOutput") }),
  "identity.session.delete": Object.freeze({ input: identityInputSchema("IdentitySessionDeleteInput", [], true), output: identityOutputSchema("IdentitySessionDeleteOutput") }),
  "identity.sessions.read": Object.freeze({ input: identityInputSchema("IdentitySessionsReadInput", [], false), output: identityOutputSchema("IdentitySessionsReadOutput") }),
  "identity.sessions.revoke": Object.freeze({ input: identityInputSchema("IdentitySessionsRevokeInput", ["sessionid"], true), output: identityOutputSchema("IdentitySessionsRevokeOutput") }),
  "identity.memberships.read": Object.freeze({ input: identityInputSchema("IdentityMembershipsReadInput", [], false), output: identityOutputSchema("IdentityMembershipsReadOutput") }),
  "identity.memberships.switch": Object.freeze({ input: identityInputSchema("IdentityMembershipsSwitchInput", [], true), output: identityOutputSchema("IdentityMembershipsSwitchOutput") }),
  "identity.challenges.create": Object.freeze({ input: identityInputSchema("IdentityChallengesCreateInput", [], true), output: identityOutputSchema("IdentityChallengesCreateOutput") }),
  "identity.mobile.challenges.create": Object.freeze({ input: identityInputSchema("IdentityMobileChallengesCreateInput", [], true), output: identityOutputSchema("IdentityMobileChallengesCreateOutput") }),
  "identity.invitations.resolve": Object.freeze({ input: identityInputSchema("IdentityInvitationsResolveInput", [], true), output: identityOutputSchema("IdentityInvitationsResolveOutput") }),
  "identity.invitations.read": Object.freeze({ input: identityInputSchema("IdentityInvitationsReadInput", [], false), output: identityOutputSchema("IdentityInvitationsReadOutput") }),
  "identity.invitations.create": Object.freeze({ input: identityInputSchema("IdentityInvitationsCreateInput", [], true), output: identityOutputSchema("IdentityInvitationsCreateOutput") }),
  "identity.invitations.revoke": Object.freeze({ input: identityInputSchema("IdentityInvitationsRevokeInput", ["id"], true), output: identityOutputSchema("IdentityInvitationsRevokeOutput") }),
  "identity.enrollments.read": Object.freeze({ input: identityInputSchema("IdentityEnrollmentsReadInput", ["id"], false), output: identityOutputSchema("IdentityEnrollmentsReadOutput") }),
  "identity.enrollments.complete": Object.freeze({ input: identityInputSchema("IdentityEnrollmentsCompleteInput", ["id"], true), output: identityOutputSchema("IdentityEnrollmentsCompleteOutput") }),
  "identity.members.manage": Object.freeze({ input: identityInputSchema("IdentityMembersManageInput", ["membershipid"], true), output: identityOutputSchema("IdentityMembersManageOutput") }),
  "identity.password.change": Object.freeze({ input: identityInputSchema("IdentityPasswordChangeInput", [], true), output: identityOutputSchema("IdentityPasswordChangeOutput") }),
  "identity.password.verify": Object.freeze({ input: identityInputSchema("IdentityPasswordVerifyInput", [], true), output: identityOutputSchema("IdentityPasswordVerifyOutput") }),
  "identity.password.reset": Object.freeze({ input: identityInputSchema("IdentityPasswordResetInput", [], true), output: identityOutputSchema("IdentityPasswordResetOutput") }),
  "identity.mobile.manage": Object.freeze({ input: identityInputSchema("IdentityMobileManageInput", [], true), output: identityOutputSchema("IdentityMobileManageOutput") }),
  "identity.stepup.start": Object.freeze({ input: identityInputSchema("IdentityStepupStartInput", [], true), output: identityOutputSchema("IdentityStepupStartOutput") }),
  "identity.stepup.complete": Object.freeze({ input: identityInputSchema("IdentityStepupCompleteInput", [], true), output: identityOutputSchema("IdentityStepupCompleteOutput") }),
  "identity.stepup.disable": Object.freeze({ input: identityInputSchema("IdentityStepupDisableInput", [], true), output: identityOutputSchema("IdentityStepupDisableOutput") }),
  "identity.bootstrap.read": Object.freeze({ input: identityInputSchema("IdentityBootstrapReadInput", [], false), output: identityOutputSchema("IdentityBootstrapReadOutput") }),
  "identity.providers.read": Object.freeze({ input: identityInputSchema("IdentityProvidersReadInput", [], false), output: identityOutputSchema("IdentityProvidersReadOutput") }),
  "identity.federations.start": Object.freeze({ input: identityInputSchema("IdentityFederationsStartInput", [], true), output: identityOutputSchema("IdentityFederationsStartOutput") }),
  "identity.federations.callback": Object.freeze({ input: identityInputSchema("IdentityFederationsCallbackInput", ["providerid"], false), output: identityOutputSchema("IdentityFederationsCallbackOutput") }),
  "identity.federations.selection.read": Object.freeze({ input: identityInputSchema("IdentityFederationsSelectionReadInput", [], false), output: identityOutputSchema("IdentityFederationsSelectionReadOutput") }),
  "identity.federations.complete": Object.freeze({ input: identityInputSchema("IdentityFederationsCompleteInput", [], true), output: identityOutputSchema("IdentityFederationsCompleteOutput") }),
  "identity.links.read": Object.freeze({ input: identityInputSchema("IdentityLinksReadInput", [], false), output: identityOutputSchema("IdentityLinksReadOutput") }),
  "identity.links.create": Object.freeze({ input: identityInputSchema("IdentityLinksCreateInput", [], true), output: identityOutputSchema("IdentityLinksCreateOutput") }),
  "identity.links.revoke": Object.freeze({ input: identityInputSchema("IdentityLinksRevokeInput", ["linkid"], true), output: identityOutputSchema("IdentityLinksRevokeOutput") }),
  "identity.providers.manage": Object.freeze({ input: identityInputSchema("IdentityProvidersManageInput", ["providerid"], true), output: identityOutputSchema("IdentityProvidersManageOutput") }),
  "identity.providers.test": Object.freeze({ input: identityInputSchema("IdentityProvidersTestInput", ["providerid"], true), output: identityOutputSchema("IdentityProvidersTestOutput") }),
});
export type IdentityOperationId = Extract<OperationId, `identity.${string}`>;
export function identityClientSchema<TKey extends IdentityOperationId>(id: TKey): Readonly<{ input: Schema<OperationInputFor<TKey>>; output: Schema<OperationOutputFor<TKey>> }> {
  const pair = schemas[id];
  if (pair === undefined) throw new Error('IDENTITY_OPERATION_SCHEMA_MISSING');
  return pair as unknown as Readonly<{ input: Schema<OperationInputFor<TKey>>; output: Schema<OperationOutputFor<TKey>> }>;
}
function identityOutputSchema(name: string): Schema<unknown> {
  const schema = Reflect.get(outputs, name) as Schema<unknown> | undefined;
  if (schema === undefined) throw new Error(`IDENTITY_OUTPUT_SCHEMA_MISSING:${name}`);
  return schema;
}
