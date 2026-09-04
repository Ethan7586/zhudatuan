import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { HandlerContext } from '../../../../foundation/application/HandlerContext';
import type { OperationHandler, OperationReply } from '../../../../foundation/application/OperationHandler';
import { keysetPage, queryPage } from '../../../../foundation/application/Validation';
import { requireSession } from '../../../../foundation/security/OperationSecurityContext';
import type { SessionRepository } from '../port/SessionRepository';

export class SessionsReadHandler implements OperationHandler<'verification.sessions.read', 'read'> {
  readonly operation = 'verification.sessions.read' as const;
  readonly mode = 'read' as const;
  constructor(private readonly sessions: SessionRepository) {}
  async execute(input: OperationInputFor<'verification.sessions.read'>, context: HandlerContext<'verification.sessions.read'>): Promise<OperationReply<OperationOutputFor<'verification.sessions.read'>>> {
    const access = requireSession(context.security);
    const page = queryPage(input, 100);
    const rows = await this.sessions.read(context.transaction, access.scope.id, access.membership.id, page);
    return { status: 200, body: keysetPage(rows, page, 'expires_at') as OperationOutputFor<'verification.sessions.read'> };
  }
}
