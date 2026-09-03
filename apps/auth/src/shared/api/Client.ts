import type { OperationMethod } from '@shop/sdk';
import {
  createFetchIdentityBootstrapRead,
  createFetchIdentityChallengesCreate,
  createFetchIdentityEnrollmentsComplete,
  createFetchIdentityEnrollmentsRead,
  createFetchIdentityFederationsComplete,
  createFetchIdentityFederationsSelectionRead,
  createFetchIdentityFederationsStart,
  createFetchIdentityInvitationsResolve,
  createFetchIdentityPasswordReset,
  createFetchIdentityProvidersRead,
  createFetchIdentitySessionsComplete,
  createFetchIdentitySessionsCreate,
  createFetchIdentityTicketsExchange,
} from '@shop/sdk/identity';
import type { AuthEnvironment } from '../../config/Environment';

export interface IdentitySdk {
  readonly bootstrapRead: OperationMethod<'identity.bootstrap.read'>;
  readonly challengesCreate: OperationMethod<'identity.challenges.create'>;
  readonly enrollmentsComplete: OperationMethod<'identity.enrollments.complete'>;
  readonly enrollmentsRead: OperationMethod<'identity.enrollments.read'>;
  readonly federationsComplete: OperationMethod<'identity.federations.complete'>;
  readonly federationsSelectionRead: OperationMethod<'identity.federations.selection.read'>;
  readonly federationsStart: OperationMethod<'identity.federations.start'>;
  readonly invitationsResolve: OperationMethod<'identity.invitations.resolve'>;
  readonly passwordReset: OperationMethod<'identity.password.reset'>;
  readonly providersRead: OperationMethod<'identity.providers.read'>;
  readonly sessionsComplete: OperationMethod<'identity.sessions.complete'>;
  readonly sessionsCreate: OperationMethod<'identity.sessions.create'>;
  readonly ticketsExchange: OperationMethod<'identity.tickets.exchange'>;
}

export function createClient(environment: AuthEnvironment): IdentitySdk {
  const origin = environment.apiOrigin;
  return Object.freeze({
    bootstrapRead: createFetchIdentityBootstrapRead(origin),
    challengesCreate: createFetchIdentityChallengesCreate(origin),
    enrollmentsComplete: createFetchIdentityEnrollmentsComplete(origin),
    enrollmentsRead: createFetchIdentityEnrollmentsRead(origin),
    federationsComplete: createFetchIdentityFederationsComplete(origin),
    federationsSelectionRead: createFetchIdentityFederationsSelectionRead(origin),
    federationsStart: createFetchIdentityFederationsStart(origin),
    invitationsResolve: createFetchIdentityInvitationsResolve(origin),
    passwordReset: createFetchIdentityPasswordReset(origin),
    providersRead: createFetchIdentityProvidersRead(origin),
    sessionsComplete: createFetchIdentitySessionsComplete(origin),
    sessionsCreate: createFetchIdentitySessionsCreate(origin),
    ticketsExchange: createFetchIdentityTicketsExchange(origin),
  });
}
