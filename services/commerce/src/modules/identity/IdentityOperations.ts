import type { OperationId } from '@shop/contract';
import type { OperationRequest, OperationResult, OperationUsecase } from '../../foundation/application/OperationExecution';

export const IDENTITY_BROKER_OPERATION_IDS = Object.freeze([
  'identity.providers.read',
  'identity.federations.start',
  'identity.federations.callback',
  'identity.federations.selection.read',
  'identity.federations.complete',
  'identity.links.read',
  'identity.links.create',
  'identity.links.revoke',
  'identity.providers.manage',
  'identity.providers.test',
] as const satisfies readonly OperationId[]);

export const INVITATION_OPERATION_IDS = Object.freeze([
  'identity.sessions.create',
  'identity.sessions.complete',
  'identity.invitations.resolve',
  'identity.invitations.read',
  'identity.invitations.create',
  'identity.invitations.revoke',
  'identity.enrollments.read',
  'identity.enrollments.complete',
] as const satisfies readonly OperationId[]);

export const STANDARD_IDENTITY_OPERATION_IDS = Object.freeze([
  'identity.tickets.exchange',
  'identity.session.read',
  'identity.session.delete',
  'identity.sessions.read',
  'identity.sessions.revoke',
  'identity.memberships.read',
  'identity.memberships.switch',
  'identity.challenges.create',
  'identity.members.manage',
  'identity.password.change',
  'identity.password.verify',
  'identity.password.reset',
  'identity.mobile.manage',
  'identity.stepup.start',
  'identity.stepup.complete',
] as const satisfies readonly OperationId[]);

export class IdentityOperations implements OperationUsecase {
  private readonly invitationIds = new Set<OperationId>(INVITATION_OPERATION_IDS);
  private readonly standardIds = new Set<OperationId>(STANDARD_IDENTITY_OPERATION_IDS);
  private readonly brokerIds = new Set<OperationId>(IDENTITY_BROKER_OPERATION_IDS);
  constructor(
    private readonly invitation: OperationUsecase,
    private readonly standard: OperationUsecase,
    private readonly broker: OperationUsecase
  ) {}
  invoke(request: OperationRequest): Promise<OperationResult> {
    if (this.invitationIds.has(request.type)) return this.invitation.invoke(request);
    if (this.standardIds.has(request.type)) return this.standard.invoke(request);
    if (this.brokerIds.has(request.type)) return this.broker.invoke(request);
    throw new Error(`IDENTITY_OPERATION_NOT_ROUTED:${request.type}`);
  }
}
