import type { ReadTransactionContext } from '../../../../platform/database/TransactionContext';
import { requireWriteTransaction } from '../../../../platform/database/TransactionContext';
import { DomainError } from '../../../../platform/error/DomainError';

import type { SessionIssuer } from '../port/SessionIssuer';
import type { FederationProtector } from '../../domain/service/FederationProtector';
import type { MembershipSelectionPort, MembershipCandidate } from '../port/MembershipSelectionPort';
import type { IdentityAccessPort } from '../../../access/public';
import type { IdentityMemberPort } from '../../../member/public';
import type { AuthTransaction } from '../../domain/model/AuthTransaction';
import type { FederationCompletionPort } from '../port/FederationRepository';
import type { SessionCookiePort } from '../port/SessionCookiePort';
import type { MembershipDestination } from './MembershipDestination';
export class MembershipSelector {
  constructor(
    private readonly repository: MembershipSelectionPort,
    private readonly sessions: SessionIssuer,
    private readonly protector: FederationProtector,
    private readonly access: IdentityAccessPort,
    private readonly members: IdentityMemberPort,
    private readonly federations: FederationCompletionPort,
    private readonly destinations: MembershipDestination,
    private readonly cookies: SessionCookiePort
  ) {}
  async begin(
    database: ReadTransactionContext,
    input: Readonly<{ principal: string; target: 'console' | 'storefront' | 'miniapp' | 'store' | 'supplier'; memberships: readonly MembershipCandidate[]; assurance: number; authorization: AuthTransaction; returnTarget: string }>,
    context: Readonly<{ peer: string; agent: string; device: string }>
  ) {
    const selection = await this.repository.create(requireWriteTransaction(database), {
      principal: input.principal,
      target: input.target,
      memberships: input.memberships,
      assurance: input.assurance,
      returnTarget: input.returnTarget,
      authorization: Object.freeze({ stateHash: input.authorization.stateHash, nonceHash: input.authorization.nonceHash, challenge: input.authorization.challenge }),
      browser: this.protector.browser(context.peer, context.agent, context.device),
      device: this.protector.device(context.device),
    });
    return Object.freeze({ id: selection.id, headers: Object.freeze({ 'set-cookie': this.cookies.preauth(selection.token) }) });
  }
  read(database: ReadTransactionContext, id: string) {
    return this.repository.read(database, id);
  }
  async select(database: ReadTransactionContext, id: string, membership: string, context: Readonly<{ peer: string; agent: string; device: string; trace: string }>) {
    const browser = this.protector.browser(context.peer, context.agent, context.device);
    const selected = await this.repository.consume(requireWriteTransaction(database), id, browser, this.protector.device(context.device), membership);
    const member = await this.members.memberForPrincipal(database, selected.principal);
    const active = await this.access.memberships(database, member, selected.target);
    const snapshot = selected.memberships.find((candidate) => candidate.id === membership && candidate.target === selected.target);
    const current = active.find((candidate) => candidate.id === membership && candidate.target === selected.target);
    if (!snapshot || !current || current.accessVersion !== snapshot.accessVersion) throw new DomainError('MEMBERSHIP_SELECTION_REQUIRED');
    const destination = await this.destinations.resolve(database, { target: selected.target, returnTarget: selected.returnTarget, organization: current.organization });
    const issued = await this.sessions.issue(requireWriteTransaction(database), {
      principal: selected.principal,
      membership,
      assurance: selected.assurance,
      target: selected.target,
      device: context.device,
      peer: context.peer,
      agent: context.agent,
      trace: context.trace,
      expectedAccessVersion: snapshot.accessVersion,
    });
    if (selected.transaction !== null) await this.federations.complete(requireWriteTransaction(database), selected.transaction, await this.federations.version(database, selected.transaction));
    return Object.freeze({ headers: issued.headers, destination: destination.url });
  }
}
