import { PgTransactionAccess } from '../../../../adapter/database/PgTransactionAccess';
import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { ExecutionContext } from '../../../../foundation/application/HandlerContext';
import type { OperationReply } from '../../../../foundation/application/OperationHandler';
import { keysetPage, queryPage } from '../../../../foundation/interface/Validation';
import type { KmsClient } from '../../../../foundation/infrastructure/KmsClient';
import type { ObjectStore } from '../../../../foundation/infrastructure/ObjectStore';
import type { ReadTransactionContext, WriteTransactionContext } from '../../../../foundation/persistence/TransactionContext';
import { mapParallel } from '../../../../foundation/performance/Parallel';
import type { MessageReader } from '../../application/port/SupportRepositories';
import type { ConversationStore, SupportContextView } from '../../application/port/SupportPersistence';
import type { ReadSupportContext } from '../../application/service/ReadSupportContext';

interface MessageRecord {
  readonly id: string;
  readonly client_message_id: string;
  readonly conversation_id: string;
  readonly scope_id: string;
  readonly author_type: 'member' | 'agent';
  readonly author_id: string;
  readonly body_ciphertext: string;
  readonly sequence: number;
  readonly version: number;
  readonly created_at: string;
}

interface EvidenceRecord {
  readonly id: string;
  readonly message_id: string | null;
  readonly original_name: string;
  readonly content_type: string;
  readonly size_bytes: number;
  readonly state: 'pending' | 'clean' | 'rejected';
  readonly object_ref: string;
  readonly created_at: string;
}

interface MessageReadCheckpoint {
  readonly messages: readonly MessageRecord[];
  readonly evidence: readonly EvidenceRecord[];
  readonly count: number;
  readonly nextCursor?: string;
  readonly conversationVersion: number;
  readonly latestSequence: number;
  readonly lastReadSequence: number;
  readonly supportContext: SupportContextView;
}

export class PgConversationRepository implements MessageReader, ConversationStore {
  private readonly transactions = new PgTransactionAccess();

  constructor(
    private readonly kms: KmsClient,
    private readonly objects: ObjectStore,
    private readonly support: ReadSupportContext
  ) {}

  async advance(context: WriteTransactionContext, conversation: string, expectedVersion: number): Promise<Readonly<{ sequence: number; version: number }>> {
    const result = await this.transactions.database(context).query<{ latest_sequence: number; version: number }>(
      `update support.conversation set latest_sequence=latest_sequence+1,version=version+1,updated_at=clock_timestamp()
      where id=$1 and version=$2 returning latest_sequence,version`,
      [conversation, expectedVersion]
    );
    const row = result.rows[0];
    if (!row) throw new Error('SUPPORT_CONVERSATION_VERSION_CONFLICT');
    return Object.freeze({ sequence: Number(row.latest_sequence), version: Number(row.version) });
  }

  async readMessages(
    context: ReadTransactionContext,
    input: OperationInputFor<'support.messages.read'>,
    execution: ExecutionContext<'support.messages.read'>
  ): Promise<OperationReply<OperationOutputFor<'support.messages.read'>>> {
    const actor = await this.support.actor(context, execution);
    const page = queryPage(input, 200);
    const database = this.transactions.database(context);
    const conversation = await database.query<{ id: string; scope_id: string; member_id: string; version: number; latest_sequence: number; last_read_sequence: number }>(
      `select conversation.id,conversation.scope_id,conversation.member_id,conversation.version,conversation.latest_sequence,
      coalesce(readstate.last_sequence,0) last_read_sequence
      from support.ticket ticket join support.conversation conversation on conversation.id=ticket.conversation_id
      left join support.readstate readstate on readstate.conversation_id=conversation.id and readstate.membership_id=$3
      where ticket.id=$1 and ticket.scope_id=any($2::text[])
      and (not $4::boolean or conversation.member_id=$5)`,
      [input.path.caseid, actor.scopes, actor.membership, actor.target === 'storefront', actor.member]
    );
    const selected = conversation.rows[0];
    if (!selected) throw new Error('SUPPORT_CONVERSATION_NOT_READABLE');
    const supportContext = await this.support.view(context, selected.scope_id, selected.member_id, actor.target === 'storefront');
    const result = await database.query<MessageRecord>(
      `select message.id,message.client_message_id,message.conversation_id,message.scope_id,message.author_type,message.author_id,
      message.body_ciphertext,message.sequence,message.version,message.created_at
      from support.message message where message.conversation_id=$1
      and ($2::bigint is null or (message.sequence,message.id)<($2::bigint,$3))
      order by message.sequence desc,message.id desc limit $4`,
      [selected.id, page.sort, page.id, page.fetch]
    );
    const paged = keysetPage(result.rows, page, 'sequence');
    const evidence = await database.query<EvidenceRecord>(
      `select evidence.id,messageevidence.message_id,evidence.original_name,evidence.content_type,evidence.size_bytes,
      evidence.state,evidence.object_ref,evidence.created_at from support.evidence evidence
      left join support.messageevidence messageevidence on messageevidence.evidence_id=evidence.id
      where evidence.conversation_id=$1 order by evidence.created_at,evidence.id`,
      [selected.id]
    );
    return {
      status: 200,
      body: {
        messages: paged.items,
        evidence: evidence.rows,
        count: paged.count,
        ...(paged.nextCursor ? { nextCursor: paged.nextCursor } : {}),
        conversationVersion: Number(selected.version),
        latestSequence: Number(selected.latest_sequence),
        lastReadSequence: Number(selected.last_read_sequence),
        supportContext,
      } as never,
    };
  }

  async finalizeMessages(
    _input: OperationInputFor<'support.messages.read'>,
    _execution: ExecutionContext<'support.messages.read'>,
    response: OperationReply<OperationOutputFor<'support.messages.read'>>
  ): Promise<OperationReply<OperationOutputFor<'support.messages.read'>>> {
    const checkpoint = response.body as unknown as MessageReadCheckpoint;
    const [items, attachments] = await Promise.all([
      mapParallel(checkpoint.messages, 16, async (message) => ({
        id: message.id,
        clientMessageId: message.client_message_id,
        conversationId: message.conversation_id,
        authorType: message.author_type,
        authorId: message.author_id,
        body: await this.kms.decrypt('pii', 'support/message', message.body_ciphertext, { scope: message.scope_id, conversation: message.conversation_id, messageId: message.id }),
        sequence: Number(message.sequence),
        version: Number(message.version),
        createdAt: new Date(message.created_at).toISOString(),
      })),
      mapParallel(checkpoint.evidence, 8, async (evidence) => {
        const download = evidence.state === 'clean' ? await this.objects.authorize(evidence.object_ref, 300) : undefined;
        return {
          id: evidence.id,
          messageId: evidence.message_id,
          name: evidence.original_name,
          contentType: evidence.content_type,
          sizeBytes: Number(evidence.size_bytes),
          state: evidence.state,
          ...(download ? { download } : {}),
          createdAt: new Date(evidence.created_at).toISOString(),
        };
      }),
    ]);
    return {
      ...response,
      body: {
        items: items.reverse(),
        attachments,
        count: checkpoint.count,
        ...(checkpoint.nextCursor ? { nextCursor: checkpoint.nextCursor } : {}),
        conversationVersion: checkpoint.conversationVersion,
        latestSequence: checkpoint.latestSequence,
        lastReadSequence: checkpoint.lastReadSequence,
        context: { ...checkpoint.supportContext, orders: [...checkpoint.supportContext.orders], benefits: [...checkpoint.supportContext.benefits] },
      },
    };
  }
}
