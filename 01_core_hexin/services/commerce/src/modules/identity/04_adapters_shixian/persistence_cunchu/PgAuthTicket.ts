import { createHash, randomBytes, randomUUID } from 'node:crypto';
import type { AuthTarget } from '@shop/config/server';
import type { OperationDatabase } from '../../../../foundation/application/ModuleOperations';
import { AuthTransaction } from '../../02_domain_yewu/models_moxing/AuthTransaction';
import { ReturnTargetSigner, type SignedReturnTarget } from '../providers_waibu/ReturnTargetSigner';

export class PgAuthTicket {
  constructor(private readonly signer: ReturnTargetSigner) {}

  async issue(database: OperationDatabase, session: string, target: AuthTarget, transaction: AuthTransaction): Promise<Readonly<{ ticket: string; state: string }>> {
    const ticket = randomBytes(64).toString('base64url');
    await database.query(`insert into identity.authticket(id,session_id,token_hash,state_hash,nonce_hash,pkce_challenge,target,expires_at,created_at)
      values($1,$2,$3,$4,$5,$6,$7,clock_timestamp()+interval '5 minutes',clock_timestamp())`, [`ticket:${randomUUID()}`, session,
      hash(ticket), transaction.stateHash, transaction.nonceHash, transaction.challenge, target]);
    return Object.freeze({ ticket, state: transaction.state });
  }

  async consume(
    database: OperationDatabase,
    value: unknown,
    currentSessionToken: string
  ): Promise<Readonly<{ returnTarget: SignedReturnTarget; sessionExpiresAt: Date }>> {
    const exchange = AuthTransaction.complete(value);
    const result = await database.query<{ target: AuthTarget; expires_at: Date }>(`with accepted as (
        select ticket.id,ticket.target,session.expires_at
        from identity.authticket ticket join identity.session session on session.id=ticket.session_id
        where ticket.token_hash=$1 and ticket.state_hash=$2 and ticket.nonce_hash=$3 and ticket.pkce_challenge=$4
          and session.token_hash=$5
          and ticket.consumed_at is null and ticket.expires_at>clock_timestamp()
          and session.revoked_at is null and session.expires_at>clock_timestamp() for update of ticket
      )
        update identity.authticket ticket set consumed_at=clock_timestamp() from accepted
        where ticket.id=accepted.id returning accepted.target,accepted.expires_at`,
    [hash(exchange.ticket), exchange.stateHash, exchange.nonceHash, exchange.challenge, hash(currentSessionToken)]);
    const accepted = result.rows[0];
    if (!accepted) throw new Error('AUTH_TICKET_EXCHANGE_REJECTED');
    return Object.freeze({ returnTarget: this.signer.issue(accepted.target), sessionExpiresAt: accepted.expires_at });
  }
}

function hash(value: string): string { return createHash('sha256').update(value).digest('hex'); }
