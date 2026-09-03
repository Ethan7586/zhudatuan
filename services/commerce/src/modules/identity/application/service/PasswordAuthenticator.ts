import type { WriteTransactionContext } from '../../../../foundation/persistence/TransactionContext';
import { requireWriteTransaction } from '../../../../foundation/persistence/TransactionContext';
import { createHmac } from 'node:crypto';

import { reject } from '../../../../foundation/application/OperationRejection';

import type { OperationRequest } from '../../../../foundation/application/OperationRequest';
import { textField } from '../../../../foundation/interface/Validation';
import type { SessionIssuer } from '../port/SessionIssuer';
import type { ReturnTargetPort } from '../port/ReturnTargetPort';
import type { LoginGuardPort } from '../port/ChallengePort';
import type { AuthTicketPort } from '../port/AuthTicketPort';
import { PasswordPolicy } from '../../domain/policy/PasswordPolicy';
import { identitySubjectVariants } from '../../domain/value/IdentitySubject';
import type { AuthenticationBody, AuthenticationReply, AuthenticationStrategy } from './AuthenticationStrategy';
import { AuthTransaction } from '../../domain/model/AuthTransaction';
import type { IdentityAccessPort } from '../../../access/public';
import type { IdentityMemberPort } from '../../../member/public';
import type { MembershipSelector } from '../service/MembershipSelector';
import type { CredentialRepository } from '../port/CredentialRepository';
import { returnDestination } from './ReturnDestination';
import { membershipCandidate, membershipView } from '../model/MembershipCandidate';

export class PasswordAuthenticator implements AuthenticationStrategy {
  readonly method = 'password' as const;
  constructor(
    private readonly key: string,
    private readonly issuer: SessionIssuer,
    private readonly returns: ReturnTargetPort,
    private readonly tickets: AuthTicketPort,
    private readonly guard: LoginGuardPort,
    private readonly access: IdentityAccessPort,
    private readonly members: IdentityMemberPort,
    private readonly selector: MembershipSelector,
    private readonly credentials: CredentialRepository,
    private readonly passwords = new PasswordPolicy()
  ) {}
  async authenticate(request: OperationRequest, database: WriteTransactionContext, body: AuthenticationBody): Promise<AuthenticationReply> {
    if (body.method !== this.method) throw new Error('AUTHENTICATION_METHOD_MISMATCH');
    const target = targetOf(body.target);
    const destination = returnDestination(this.returns, target, body.returnTarget);
    const subjects = identitySubjectVariants(textField(body, 'subject'));
    const hashes = subjects.map((value) => this.digest(value));
    const subject = hashes[0]!;
    const client = this.client(request);
    const keys = [
      [subject, client],
      [subject, 'account'],
    ] as const;
    await this.guard.assertAllowed(requireWriteTransaction(database), keys);
    const credential = await this.credentials.matchPassword(database, hashes);
    if (!(await this.passwords.verify(textField(body, 'password', 128), credential?.secretHash ?? null))) {
      await this.guard.recordFailure(requireWriteTransaction(database), keys);
      reject('CREDENTIAL_INVALID');
    }
    const member = await this.members.memberForPrincipal(database, credential!.principal);
    const memberships = await this.access.memberships(database, member, target);
    const authorization = AuthTransaction.start(body.authorization);
    await this.guard.clear(requireWriteTransaction(database), hashes, client);
    if (memberships.length !== 1) {
      const candidates = memberships.map(membershipCandidate);
      const selection = await this.selector.begin(database, { principal: credential!.principal, target, memberships: candidates, assurance: 1, authorization, returnTarget: destination.proof }, this.context(request));
      return { status: 200, headers: selection.headers, result: { kind: 'selection', transaction: selection.id, memberships: candidates.map(membershipView) } };
    }
    const membership = memberships[0]!;
    const trace = request.input.headers['x-trace-id'] ?? request.input.idempotency!;
    const session = await this.issuer.issue(requireWriteTransaction(database), {
      principal: credential!.principal,
      membership: membership.id,
      assurance: 1,
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
    return createHmac('sha256', this.key).update(value.trim().toLowerCase()).digest('hex');
  }
  private client(request: OperationRequest): string {
    return this.digest(`${request.input.headers['x-peer-address'] ?? 'unknown'}:${request.input.headers['user-agent'] ?? 'unknown'}:${request.input.headers['x-device-id'] ?? 'browser'}`);
  }
  private context(request: OperationRequest) {
    return Object.freeze({ peer: request.input.headers['x-peer-address'] ?? 'unknown', agent: request.input.headers['user-agent'] ?? 'unknown', device: request.input.headers['x-device-id'] ?? 'browser' });
  }
}

function targetOf(value: unknown): 'console' | 'storefront' {
  if (value !== 'console' && value !== 'storefront') throw new Error('AUTH_RETURN_TARGET_INVALID');
  return value;
}
