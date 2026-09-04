import { isConsumerTarget, type OperationInputFor, type OperationOutputFor } from '@shop/contract';
import type { ExecutionContext } from '../../../../foundation/application/HandlerContext';
import type { OperationReply } from '../../../../foundation/application/OperationHandler';
import { bodyRecord, integerField } from '../../../../foundation/application/Validation';
import type { WriteTransactionContext } from '../../../../foundation/persistence/TransactionContext';
import type { ReadStateStore, SupportEventStore } from '../port/SupportPersistence';
import type { ReadStateRepository } from '../port/SupportRepositories';
import type { ReadSupportContext } from './ReadSupportContext';

export class ManageReadState implements ReadStateRepository {
  constructor(private readonly support: ReadSupportContext, private readonly readstates: ReadStateStore, private readonly events: SupportEventStore) {}

  async manageReadState(context: WriteTransactionContext, input: OperationInputFor<'support.readstates.manage'>, execution: ExecutionContext<'support.readstates.manage'>): Promise<OperationReply<OperationOutputFor<'support.readstates.manage'>>> {
    const actor = await this.support.actor(context, execution);
    const value = await this.readstates.advance(context, {
      conversation: input.path.conversationid,
      membership: actor.membership,
      member: actor.member,
      scopes: actor.scopes,
      storefront: isConsumerTarget(actor.target),
      lastSequence: integerField(bodyRecord(input), 'lastSequence'),
    });
    await this.events.append(context, {
      type: 'support.readstate.updated', aggregateType: 'conversation', aggregate: value.state.conversation, scope: value.scope, trace: execution.traceId,
      payload: { ticketId: value.ticket, conversationId: value.state.conversation, memberId: actor.member, sequence: value.state.lastSequence, version: value.state.version },
    });
    return {
      status: 200,
      headers: { etag: `"${value.state.version}"` },
      body: { conversationId: value.state.conversation, lastSequence: value.state.lastSequence, version: value.state.version },
    };
  }
}
