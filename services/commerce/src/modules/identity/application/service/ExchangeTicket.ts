import { IdentityAction as OperationAction } from '../model/IdentityAction';
import { requireWriteTransaction } from '../../../../foundation/persistence/TransactionContext';
import { randomBytes } from 'node:crypto';

import { reject } from '../../../../foundation/application/OperationRejection';

import type { CsrfProtector } from '../../../../foundation/security/CsrfProtector';
import type { AuthTicketPort } from '../port/AuthTicketPort';
import type { SessionCookiePort } from '../port/SessionCookiePort';

export class ExchangeTicket {
  constructor(
    private readonly tickets: AuthTicketPort,
    private readonly csrf: CsrfProtector,
    private readonly cookies: SessionCookiePort
  ) {}
  action(): OperationAction {
    return async (request, database) => {
      const current = (['console', 'storefront'] as const).map((target) => this.cookies.read(request.input.headers.cookie, `__Host-${target}-session`)).filter((token): token is string => token !== undefined);
      if (current.length === 0) reject('AUTHENTICATION_REQUIRED');
      const token = randomBytes(48).toString('base64url');
      const exchanged = await this.tickets.consume(requireWriteTransaction(database), request.input.body, current, token);
      const expiresIn = Math.max(1, Math.min(43_200, Math.floor((exchanged.sessionExpiresAt.getTime() - Date.now()) / 1_000)));
      return { status: 200, body: { returnTarget: exchanged.returnTarget, expiresIn }, headers: this.cookies.session(exchanged.target, token, this.csrf.issue(token, exchanged.target, expiresIn), expiresIn) };
    };
  }
}
