import { IdentityAction as OperationAction } from '../model/IdentityAction';
import { requireWriteTransaction } from '../../../../platform/database/TransactionContext';
import { randomBytes } from 'node:crypto';

import { reject } from '../../../../pipeline/OperationRejection';

import type { CsrfProtector } from '../../../../platform/security/CsrfProtector';
import type { AuthTicketPort } from '../port/AuthTicketPort';
import type { SessionCookiePort } from '../port/SessionCookiePort';
import type { ReturnTargetPort } from '../port/ReturnTargetPort';
import { returnDestination } from './ReturnDestination';
import { bodyRecord } from '../../../../pipeline/Validation';
import { OPERATION_TARGETS } from '@shop/contract';
import type { SessionPolicy } from '../../domain/policy/SessionPolicy';

export class ExchangeTicket {
  constructor(
    private readonly tickets: AuthTicketPort,
    private readonly returns: ReturnTargetPort,
    private readonly csrf: CsrfProtector,
    private readonly cookies: SessionCookiePort,
    private readonly policy: SessionPolicy
  ) {}
  action(): OperationAction {
    return async (request, database) => {
      const current = OPERATION_TARGETS.map((target) => this.cookies.read(request.input.headers.cookie, `__Host-${target}-session`)).filter((token): token is string => token !== undefined);
      if (current.length === 0) reject('AUTHENTICATION_REQUIRED');
      const token = randomBytes(48).toString('base64url');
      const body = bodyRecord(request.input);
      const exchanged = await this.tickets.consume(requireWriteTransaction(database), body, current, token);
      const destination = returnDestination(this.returns, exchanged.target, body.returnTarget);
      const expiresIn = Math.max(1, Math.min(this.policy.ttlSeconds, Math.floor((exchanged.sessionExpiresAt.getTime() - Date.now()) / 1_000)));
      return { status: 200, body: { returnTarget: destination, expiresIn }, headers: this.cookies.session(exchanged.target, token, this.csrf.issue(token, exchanged.target, expiresIn), expiresIn) };
    };
  }
}
