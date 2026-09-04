import { PgTransactionAccess } from '../../../../adapter/database/PgTransactionAccess';
import type { WriteTransactionContext } from '../../../../foundation/persistence/TransactionContext';
import type { EncryptedSupportMessage, MessageStore, StoredSupportMessage } from '../../application/port/SupportPersistence';

export class PgMessageRepository implements MessageStore {
  private readonly transactions = new PgTransactionAccess();

  async existing(context: WriteTransactionContext, conversation: string, author: string, clientMessageId: string): Promise<StoredSupportMessage | null> {
    const result = await this.transactions.database(context).query<MessageRow>(
      `select id,client_message_id,conversation_id,author_type,author_id,kind,visibility,body_hash,sequence,version,created_at
      from support.message where conversation_id=$1 and author_id=$2 and client_message_id=$3`,
      [conversation, author, clientMessageId]
    );
    return result.rows[0] ? message(result.rows[0]) : null;
  }

  async append(
    context: WriteTransactionContext,
    input: Readonly<{ scope: string; conversation: string; authorType: MessageRow['author_type']; authorId: string; kind: MessageRow['kind']; visibility: MessageRow['visibility']; sequence: number; message: EncryptedSupportMessage; attachments: readonly string[] }>
  ): Promise<StoredSupportMessage> {
    const database = this.transactions.database(context);
    const result = await database.query<MessageRow>(
      `insert into support.message(id,client_message_id,scope_id,conversation_id,author_type,author_id,kind,visibility,body_ciphertext,
      body_hash,body_key_version,sequence,version,created_at)
      values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,1,clock_timestamp())
      returning id,client_message_id,conversation_id,author_type,author_id,kind,visibility,body_hash,sequence,version,created_at`,
      [
        input.message.id,
        input.message.clientMessageId,
        input.scope,
        input.conversation,
        input.authorType,
        input.authorId,
        input.kind,
        input.visibility,
        input.message.ciphertext,
        input.message.fingerprint,
        input.message.keyVersion,
        input.sequence,
      ]
    );
    const stored = result.rows[0];
    if (!stored) throw new Error('SUPPORT_MESSAGE_APPEND_FAILED');
    if (input.attachments.length > 0) {
      await database.query(
        `insert into support.messageevidence(message_id,evidence_id)
        select $1,evidence.id from support.evidence evidence where evidence.id=any($2::text[])
        order by evidence.id`,
        [input.message.id, input.attachments]
      );
    }
    return message(stored);
  }
}

interface MessageRow {
  readonly id: string;
  readonly client_message_id: string;
  readonly conversation_id: string;
  readonly author_type: 'member' | 'agent' | 'system';
  readonly author_id: string;
  readonly kind: 'text' | 'attachment' | 'system';
  readonly visibility: 'external' | 'internal';
  readonly body_hash: string;
  readonly sequence: number;
  readonly version: number;
  readonly created_at: string;
}

function message(row: MessageRow): StoredSupportMessage {
  return Object.freeze({
    id: row.id,
    clientMessageId: row.client_message_id,
    conversationId: row.conversation_id,
    authorType: row.author_type,
    authorId: row.author_id,
    kind: row.kind,
    visibility: row.visibility,
    bodyHash: row.body_hash,
    sequence: Number(row.sequence),
    version: Number(row.version),
    createdAt: new Date(row.created_at).toISOString(),
  });
}
