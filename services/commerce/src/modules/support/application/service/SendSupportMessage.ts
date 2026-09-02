import { randomUUID } from 'node:crypto';
import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { ExecutionContext } from '../../../../foundation/application/HandlerContext';
import type { OperationReply } from '../../../../foundation/application/OperationHandler';
import { DomainError } from '../../../../foundation/domain/DomainError';
import { bodyRecord, textField } from '../../../../foundation/interface/Validation';
import type { KmsClient } from '../../../../foundation/infrastructure/KmsClient';
import type { ReadTransactionContext, WriteTransactionContext } from '../../../../foundation/persistence/TransactionContext';
import { Message } from '../../domain/model/Message';
import { MessagePolicy } from '../../domain/policy/MessagePolicy';
import { TicketPolicy } from '../../domain/policy/TicketPolicy';
import type { MessageSender, PreparedSupportOperation } from '../port/SupportRepositories';
import type {
  AgentStore,
  ConversationStore,
  EncryptedSupportMessage,
  EvidenceStore,
  MessageStore,
  StoredSupportMessage,
  SupportEventStore,
  SupportMessageTarget,
  TicketMessageStore,
} from '../port/SupportPersistence';
import type { ReadSupportContext, SupportActorContext } from './ReadSupportContext';

interface LoadedMessage {
  readonly actor: SupportActorContext;
  readonly target: SupportMessageTarget;
}

interface PreparedMessage {
  readonly loaded: LoadedMessage;
  readonly message: EncryptedSupportMessage;
  readonly attachmentIds: readonly string[];
}

export class SendSupportMessage implements MessageSender {
  private readonly messagesPolicy = new MessagePolicy();
  private readonly ticketsPolicy = new TicketPolicy();

  constructor(
    private readonly kms: KmsClient,
    private readonly support: ReadSupportContext,
    private readonly tickets: TicketMessageStore,
    private readonly conversations: ConversationStore,
    private readonly messages: MessageStore,
    private readonly evidence: EvidenceStore,
    private readonly agents: AgentStore,
    private readonly events: SupportEventStore
  ) {}

  async loadMessage(context: ReadTransactionContext, input: OperationInputFor<'support.messages.send'>, execution: ExecutionContext<'support.messages.send'>): Promise<PreparedSupportOperation> {
    const actor = await this.support.actor(context, execution);
    const target = await this.tickets.readMessageTarget(context, input.path.caseid, actor.scopes, actor.member, actor.target === 'storefront');
    return Object.freeze({ actor, target });
  }

  async prepareMessage(input: OperationInputFor<'support.messages.send'>, _execution: ExecutionContext<'support.messages.send'>, value: PreparedSupportOperation): Promise<PreparedSupportOperation> {
    const loaded = value as LoadedMessage;
    const wire = bodyRecord(input);
    const attachmentIds = wire.attachmentIds;
    const body = this.messagesPolicy.prepare({
      body: textField(wire, 'message', 4000),
      clientMessageId: textField(wire, 'clientMessageId', 128),
      attachmentIds: Array.isArray(attachmentIds) ? attachmentIds.map(String) : undefined,
    });
    const id = `message:${randomUUID()}`;
    const envelope = await this.kms.encrypt('pii', 'support/message', body.body, {
      scope: loaded.target.ticket.scope,
      conversation: loaded.target.conversation,
      messageId: id,
    });
    return Object.freeze({ loaded, attachmentIds: body.attachmentIds, message: Object.freeze({ id, clientMessageId: body.clientMessageId, ciphertext: envelope.ciphertext, fingerprint: envelope.fingerprint, keyVersion: envelope.keyVersion, body: body.body }) });
  }

  async sendMessage(
    context: WriteTransactionContext,
    input: OperationInputFor<'support.messages.send'>,
    execution: ExecutionContext<'support.messages.send'>,
    value: PreparedSupportOperation
  ): Promise<OperationReply<OperationOutputFor<'support.messages.send'>>> {
    const prepared = value as PreparedMessage;
    const actor = prepared.loaded.actor;
    const target = await this.tickets.lockMessageTarget(context, input.path.caseid, actor.scopes, actor.member, actor.target === 'storefront');
    if (target.ticket.id !== prepared.loaded.target.ticket.id || target.conversation !== prepared.loaded.target.conversation) throw new DomainError('VERSION_CONFLICT');
    this.ticketsPolicy.assertVersion(target.ticket, execution.expectedVersion);
    const authorType = actor.target === 'storefront' ? 'member' : 'agent';
    this.ticketsPolicy.assertWritable(target.ticket, authorType);
    if (authorType === 'agent') await this.agents.assertSender(context, actor.membership, target.ticket.scope);
    await this.evidence.assertReady(context, target.conversation, target.ticket.scope, prepared.attachmentIds);
    const replay = await this.messages.existing(context, target.conversation, actor.actor, prepared.message.clientMessageId);
    if (replay) {
      if (replay.bodyHash !== prepared.message.fingerprint) throw new DomainError('SUPPORT_CLIENT_MESSAGE_CONFLICT');
      return reply(replay, target.ticket.id, target.ticket.state, target.ticket.version, target.conversationVersion, prepared.message.body);
    }
    const conversation = await this.conversations.advance(context, target.conversation, target.conversationVersion).catch(() => {
      throw new DomainError('VERSION_CONFLICT');
    });
    const stored = await this.messages.append(context, {
      scope: target.ticket.scope,
      conversation: target.conversation,
      authorType,
      authorId: actor.actor,
      sequence: conversation.sequence,
      message: prepared.message,
      attachments: prepared.attachmentIds,
    });
    new Message(stored.id, stored.clientMessageId, stored.conversationId, stored.authorType, stored.authorId, stored.bodyHash, stored.sequence, stored.version, stored.createdAt);
    const ticket = await this.tickets.advanceMessage(context, target.ticket, execution.expectedVersion!, authorType);
    await this.events.history(context, target.ticket.id, target.ticket.scope, 'message', actor.actor, { message: stored.id, sequence: stored.sequence, state: ticket.state });
    await this.events.append(context, {
      type: 'support.message.sent',
      aggregateType: 'conversation',
      aggregate: target.conversation,
      scope: target.ticket.scope,
      trace: execution.traceId,
      payload: { ticketId: target.ticket.id, conversationId: target.conversation, messageId: stored.id, sequence: stored.sequence, version: conversation.version, memberId: target.member },
    });
    return reply(stored, ticket.id, ticket.state, ticket.version, conversation.version, prepared.message.body);
  }
}

function reply(
  stored: StoredSupportMessage,
  ticketId: string,
  state: OperationOutputFor<'support.messages.send'>['ticket']['state'],
  ticketVersion: number,
  conversationVersion: number,
  body: string
): OperationReply<OperationOutputFor<'support.messages.send'>> {
  return {
    status: 201,
    headers: { etag: `"${ticketVersion}"` },
    body: {
      message: {
        id: stored.id,
        clientMessageId: stored.clientMessageId,
        conversationId: stored.conversationId,
        authorType: stored.authorType,
        authorId: stored.authorId,
        body,
        sequence: stored.sequence,
        version: stored.version,
        createdAt: stored.createdAt,
      },
      ticket: { id: ticketId, state, version: ticketVersion },
      conversationVersion,
    },
  };
}
