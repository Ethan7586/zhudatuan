import type { WriteTransactionContext } from '../../../../foundation/persistence/TransactionContext';
import { requireWriteTransaction } from '../../../../foundation/persistence/TransactionContext';
import { createHmac } from 'node:crypto';

import { reject } from '../../../../foundation/application/OperationRejection';

import type { OperationRequest } from '../../../../foundation/application/OperationRequest';
import { textField } from '../../../../foundation/interface/Validation';
import type { ReturnTargetPort } from '../port/ReturnTargetPort';
import type { SessionIssuer } from '../port/SessionIssuer';
import type { ChallengePort } from '../port/ChallengePort';
import type { AuthTicketPort } from '../port/AuthTicketPort';
import { identitySubjectVariants } from '../../domain/value/IdentitySubject';
import type { AuthenticationBody, AuthenticationReply, AuthenticationStrategy } from './AuthenticationStrategy';
import { AuthTransaction } from '../../domain/model/AuthTransaction';
import type { IdentityAccessPort } from '../../../access/public';
import type { IdentityMemberPort } from '../../../member/public';
import type { MembershipSelector } from '../service/MembershipSelector';
import type { AssuranceRepository } from '../port/AssuranceRepository';
import { returnDestination } from './ReturnDestination';
import { membershipCandidate, membershipView } from '../model/MembershipCandidate';

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
    private readonly assurances: AssuranceRepository
  ) {}
  async authenticate(request: OperationRequest, database: WriteTransactionContext, body: AuthenticationBody): Promise<AuthenticationReply> {
    if (body.method !== this.method) throw new Error('AUTHENTICATION_METHOD_MISMATCH');
    const target = targetOf(body.target);
    const destination = returnDestination(this.returns, target, body.returnTarget);
    const subject = this.digest(identitySubjectVariants(textField(body, 'subject'))[0]!);
    const challenge = textField(body, 'challenge');
    const code = textField(body, 'code', 16);
    const verified = await this.challenges.verify(requireWriteTransaction(database), challenge, code, (id, value) => this.code(id, value), { purpose: 'login', destinationHash: subject });
    if (!verified.principal_id) reject('CREDENTIAL_INVALID');
    const member = await this.members.memberForPrincipal(database, verified.principal_id);
    const memberships = await this.access.memberships(database, member, target);
    await this.challenges.consume(requireWriteTransaction(database), challenge, code, (id, value) => this.code(id, value), verified.principal_id, { purpose: 'login', destinationHash: subject });
    await this.assurances.record(requireWriteTransaction(database), { principal: verified.principal_id, method: 'phone_otp', level: 2, evidenceHash: this.digest(challenge), expiresIn: '15minutes' });
    const authorization = AuthTransaction.start(body.authorization);
    if (memberships.length !== 1) {
      const candidates = memberships.map(membershipCandidate);
      const selection = await this.selector.begin(database, { principal: verified.principal_id, target, memberships: candidates, assurance: 2, authorization, returnTarget: destination.proof }, this.context(request));
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
function targetOf(value: unknown): 'console' | 'storefront' {
  if (value !== 'console' && value !== 'storefront') throw new Error('AUTH_RETURN_TARGET_INVALID');
  return value;
}
