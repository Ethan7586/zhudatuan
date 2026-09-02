import { PgTransactionAccess } from '../../../../adapter/database/PgTransactionAccess';
import { DomainError } from '../../../../foundation/domain/DomainError';
import type { WriteTransactionContext } from '../../../../foundation/persistence/TransactionContext';
import { ReadState } from '../../domain/model/ReadState';
import type { ReadStateStore } from '../../application/port/SupportPersistence';

export class PgReadStateRepository implements ReadStateStore {
  private readonly transactions = new PgTransactionAccess();

  async advance(
    context: WriteTransactionContext,
    input: Readonly<{ conversation: string; membership: string; member: string; scopes: readonly string[]; storefront: boolean; lastSequence: number }>
  ): Promise<Readonly<{ state: ReadState; ticket: string; scope: string }>> {
    const database = this.transactions.database(context);
    const target = await database.query<{ id: string; latest_sequence: number; ticket_id: string; scope_id: string }>(
      `select conversation.id,conversation.latest_sequence,ticket.id ticket_id,conversation.scope_id
      from support.conversation conversation join support.ticket ticket on ticket.conversation_id=conversation.id
      where conversation.id=$1 and conversation.scope_id=any($2::text[])
      and (not $4::boolean or conversation.member_id=$3) for update`,
      [input.conversation, input.scopes, input.member, input.storefront]
    );
    const conversation = target.rows[0];
    if (!conversation) throw new DomainError('RESOURCE_NOT_FOUND');
    if (input.lastSequence > Number(conversation.latest_sequence)) throw new DomainError('VALIDATION_FAILED', { field: 'lastSequence' });
    const result = await database.query<{ conversation_id: string; membership_id: string; last_sequence: number; version: number }>(
      `insert into support.readstate(conversation_id,membership_id,last_sequence,updated_at,version)
      values($1,$2,$3,clock_timestamp(),1)
      on conflict(conversation_id,membership_id) do update set
      last_sequence=greatest(support.readstate.last_sequence,excluded.last_sequence),
      updated_at=case when excluded.last_sequence>support.readstate.last_sequence then clock_timestamp() else support.readstate.updated_at end,
      version=case when excluded.last_sequence>support.readstate.last_sequence then support.readstate.version+1 else support.readstate.version end
      returning conversation_id,membership_id,last_sequence,version`,
      [input.conversation, input.membership, input.lastSequence]
    );
    const row = result.rows[0];
    if (!row) throw new Error('SUPPORT_READSTATE_UPDATE_FAILED');
    return Object.freeze({
      state: new ReadState(row.conversation_id, row.membership_id, Number(row.last_sequence), Number(row.version)),
      ticket: conversation.ticket_id,
      scope: conversation.scope_id,
    });
  }
}
