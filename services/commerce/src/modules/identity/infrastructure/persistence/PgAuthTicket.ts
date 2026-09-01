import { PgTransactionAccess } from '../../../../adapter/database/PgTransactionAccess';
import type { ReadTransactionContext, WriteTransactionContext } from '../../../../foundation/persistence/TransactionContext';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import type { AuthTarget } from '@shop/config/server';
import { DomainError } from '../../../../foundation/domain/DomainError';
import type { AuthTicketBinding, AuthTicketPort } from '../../application/port/AuthTicketPort';
import { AuthTransaction } from '../../domain/model/AuthTransaction';
export class PgAuthTicket implements AuthTicketPort {
  private readonly transactions = new PgTransactionAccess();
  async issue(
    context: WriteTransactionContext,
    session: string,
    target: AuthTarget,
    transaction: AuthTransaction
  ): Promise<
    Readonly<{
      ticket: string;
      state: string;
    }>
  > {
    const database = this.transactions.database(context);
    const issued = await this.issueBound(context, session, target, transaction);
    return Object.freeze({ ...issued, state: transaction.state });
  }
  async issueBound(
    context: WriteTransactionContext,
    session: string,
    target: AuthTarget,
    binding: AuthTicketBinding
  ): Promise<
    Readonly<{
      ticket: string;
    }>
  > {
    const database = this.transactions.database(context);
    const ticket = randomBytes(64).toString('base64url');
    await database.query(
      `insert into identity.authticket(id,session_id,token_hash,state_hash,nonce_hash,pkce_challenge,target,expires_at,created_at)
      values($1,$2,$3,$4,$5,$6,$7,clock_timestamp()+interval '5 minutes',clock_timestamp())`,
      [`ticket:${randomUUID()}`, session, hash(ticket), binding.stateHash, binding.nonceHash, binding.challenge, target]
    );
    return Object.freeze({ ticket });
  }
  async consume(
    context: WriteTransactionContext,
    value: unknown,
    currentSessionTokens: readonly string[],
    nextSessionToken: string
  ): Promise<
    Readonly<{
      sessionExpiresAt: Date;
      target: AuthTarget;
    }>
  > {
    const database = this.transactions.database(context);
    const exchange = AuthTransaction.complete(value);
    const result = await database.query<{
      target: AuthTarget;
      expires_at: Date;
    }>(
      `with accepted as (
        select ticket.id,ticket.target,session.id session_id,session.expires_at
        from identity.authticket ticket join identity.session session on session.id=ticket.session_id
        where ticket.token_hash=$1 and ticket.state_hash=$2 and ticket.nonce_hash=$3 and ticket.pkce_challenge=$4
          and session.token_hash=any($5::text[])
          and ticket.consumed_at is null and ticket.expires_at>clock_timestamp()
          and session.revoked_at is null and session.expires_at>clock_timestamp() for update of ticket,session
      ), consumed as (
        update identity.authticket ticket set consumed_at=clock_timestamp() from accepted
        where ticket.id=accepted.id returning accepted.target,accepted.session_id,accepted.expires_at
      ), rotated as (
        update identity.session session set token_hash=$6,last_seen_at=clock_timestamp() from consumed
        where session.id=consumed.session_id and session.token_hash=any($5::text[]) returning consumed.target,consumed.expires_at
      ) select target,expires_at from rotated`,
      [hash(exchange.ticket), exchange.stateHash, exchange.nonceHash, exchange.challenge, currentSessionTokens.map(hash), hash(nextSessionToken)]
    );
    const accepted = result.rows[0];
    if (!accepted) throw new DomainError('AUTH_TICKET_EXCHANGE_REJECTED');
    return Object.freeze({ sessionExpiresAt: accepted.expires_at, target: accepted.target });
  }
}
function hash(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}
