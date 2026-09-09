import type { ReadTransactionContext, WriteTransactionContext } from '../../../../platform/database/TransactionContext';
import { requireWriteTransaction } from '../../../../platform/database/TransactionContext';
import { createHmac } from 'node:crypto';
import { isOperationTarget, type OperationTarget } from '@shop/contract';

import { reject } from '../../../../pipeline/OperationRejection';

import type { OperationRequest } from '../../../../pipeline/OperationRequest';
import { textField } from '../../../../pipeline/Validation';
import type { ReturnTargetPort } from '../port/ReturnTargetPort';
import type { SessionIssuer } from '../port/SessionIssuer';
import type { ChallengePort } from '../port/ChallengePort';
import type { AuthTicketPort } from '../port/AuthTicketPort';
import { identitySubjectVariants } from '../../domain/value/IdentitySubject';
import type { AuthenticationBody, AuthenticationReply, AuthenticationStrategy, LoadedAuthentication, PreparedAuthentication } from './AuthenticationStrategy';
import { AuthTransaction } from '../../domain/model/AuthTransaction';
import type { IdentityAccessPort } from '../../../access/public';
import type { IdentityMemberPort } from '../../../member/public';
import type { MembershipSelector } from '../service/MembershipSelector';
import type { AssuranceRepository } from '../port/AssuranceRepository';
import { returnDestination } from './ReturnDestination';
import { membershipCandidate, membershipView } from '../model/MembershipCandidate';
import type { MembershipDestination } from './MembershipDestination';

export class OtpAuthenticator implements AuthenticationStrategy {
  readonly method = 'otp' as const;
  constructor(
    private readonly identityKey: string,
    private readonly sessionKey: string,
    private readonly issuer: SessionIssuer,
    private readonly returns: ReturnTargetPort,
    private readonly tickets: AuthTicketPort,
    private readonly challenges: ChallengePort,
    private readonly access: IdentityAccessPort,
    private readonly members: IdentityMemberPort,
    private readonly selector: MembershipSelector,
    private readonly destinations: MembershipDestination,
    private readonly assurances: AssuranceRepository
  ) {}
  async load(_request: OperationRequest, _database: ReadTransactionContext, body: AuthenticationBody): Promise<LoadedAuthentication> {
    if (body.method !== this.method) throw new Error('AUTHENTICATION_METHOD_MISMATCH');
    const target = targetOf(body.target);
    const destination = returnDestination(this.returns, target, body.returnTarget);
    const subject = this.digest(identitySubjectVariants(textField(body, 'subject'))[0]!);
    const challenge = textField(body, 'challenge');
    const authorization = AuthTransaction.start(body.authorization);
    return new LoadedOtpAuthentication(Object.freeze({ target, returnTarget: destination.proof, subject, challenge, authorization }), (request, database, prepared) => this.complete(request, database, prepared));
  }

  private async complete(request: OperationRequest, database: WriteTransactionContext, prepared: PreparedOtp): Promise<AuthenticationReply> {
    const { target, returnTarget, subject, challenge, code, authorization } = prepared;
    const verified = await this.challenges.verify(requireWriteTransaction(database), challenge, code, (id, value) => this.code(id, value), { purpose: 'login', destinationHash: subject });
    if (!verified.principal_id) reject('CREDENTIAL_INVALID');
    const member = await this.members.memberForPrincipal(database, verified.principal_id);
    const memberships = await this.access.memberships(database, member, target);
    await this.challenges.consume(requireWriteTransaction(database), challenge, code, (id, value) => this.code(id, value), verified.principal_id, { purpose: 'login', destinationHash: subject });
    await this.assurances.record(requireWriteTransaction(database), { principal: verified.principal_id, method: 'phone_otp', level: 2, evidenceHash: this.digest(challenge), expiresIn: '15minutes' });
    if (memberships.length !== 1) {
      const candidates = memberships.map(membershipCandidate);
      const selection = await this.selector.begin(database, { principal: verified.principal_id, target, memberships: candidates, assurance: 2, authorization, returnTarget }, this.context(request));
      return { status: 200, headers: selection.headers, result: { kind: 'selection', transaction: selection.id, memberships: candidates.map(membershipView) } };
    }
    const membership = memberships[0]!;
    const trace = request.input.headers['x-trace-id'] ?? request.input.idempotency!;
    const session = await this.issuer.issue(requireWriteTransaction(database), {
      principal: verified.principal_id,
      membership: membership.id,
      assurance: 2,
      target,
      device: request.input.headers['x-device-id'] ?? 'browser',
      peer: request.input.headers['x-peer-address'] ?? 'unknown',
      agent: request.input.headers['user-agent'] ?? 'unknown',
      trace,
    });
    const ticket = await this.tickets.issue(requireWriteTransaction(database), session.session, target, authorization);
    const destination = await this.destinations.resolve(database, { target, returnTarget, organization: membership.organization });
    return { status: 201, headers: session.headers, result: { kind: 'session', ticket: ticket.ticket, returnTarget: destination.proof } };
  }
  private digest(value: string): string {
    return createHmac('sha256', this.identityKey).update(value.trim().toLowerCase()).digest('hex');
  }
  private code(id: string, value: string): string {
    return createHmac('sha256', this.sessionKey).update(`${id}:${value}`).digest('hex');
  }
  private context(request: OperationRequest) {
    return Object.freeze({ peer: request.input.headers['x-peer-address'] ?? 'unknown', agent: request.input.headers['user-agent'] ?? 'unknown', device: request.input.headers['x-device-id'] ?? 'browser' });
  }
}

type OtpAttempt = Readonly<{
  target: OperationTarget;
  returnTarget: string;
  subject: string;
  challenge: string;
  authorization: ReturnType<typeof AuthTransaction.start>;
}>;
type PreparedOtp = OtpAttempt & Readonly<{ code: string }>;
type CompleteOtp = (request: OperationRequest, database: WriteTransactionContext, prepared: PreparedOtp) => Promise<AuthenticationReply>;

class LoadedOtpAuthentication implements LoadedAuthentication {
  constructor(
    private readonly attempt: OtpAttempt,
    private readonly complete: CompleteOtp
  ) {}

  async prepare(_request: OperationRequest, body: AuthenticationBody): Promise<PreparedAuthentication> {
    if (body.method !== 'otp') throw new Error('AUTHENTICATION_METHOD_MISMATCH');
    return new PreparedOtpAuthentication(Object.freeze({ ...this.attempt, code: textField(body, 'code', 16) }), this.complete);
  }
}

class PreparedOtpAuthentication implements PreparedAuthentication {
  constructor(
    private readonly prepared: PreparedOtp,
    private readonly complete: CompleteOtp
  ) {}

  authenticate(request: OperationRequest, database: WriteTransactionContext): Promise<AuthenticationReply> {
    return this.complete(request, database, this.prepared);
  }
}

function targetOf(value: unknown): OperationTarget {
  if (!isOperationTarget(value)) throw new Error('AUTH_RETURN_TARGET_INVALID');
  return value;
}
