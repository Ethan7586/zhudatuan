import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { FinalizeContext, HandlerContext, PrepareContext } from '../../../../foundation/application/HandlerContext';
import type { DurableCommit, DurableOperationHandler, OperationReply } from '../../../../foundation/application/OperationHandler';
import { StreamCapacity, type StreamLease } from '../../../../foundation/stream/StreamCapacity';
import type { RealtimePort, SupportStreamPresenter } from '../port/RealtimePort';
import type { ReadSupportContext, SupportActorContext } from '../service/ReadSupportContext';

type Output = OperationOutputFor<'support.events.read'>;
type Reply = OperationReply<Output>;

interface PreparedStream {
  readonly actor: SupportActorContext;
  readonly conversation: string | null;
  readonly cursor: string | null;
  readonly lease: StreamLease;
}

export class EventsReadHandler implements DurableOperationHandler<'support.events.read', PreparedStream, PreparedStream, 'read', SupportActorContext> {
  readonly operation = 'support.events.read' as const;
  readonly mode = 'read' as const;

  constructor(
    private readonly support: ReadSupportContext,
    private readonly realtime: RealtimePort,
    private readonly presenter: SupportStreamPresenter,
    private readonly capacity = new StreamCapacity()
  ) {}

  load(_input: OperationInputFor<'support.events.read'>, context: HandlerContext<'support.events.read'>): Promise<SupportActorContext> {
    return this.support.actor(context.transaction, context);
  }

  async prepare(input: OperationInputFor<'support.events.read'>, context: PrepareContext<'support.events.read'>, actor: SupportActorContext): Promise<PreparedStream> {
    const conversation = typeof input.query?.conversationId === 'string' ? input.query.conversationId : null;
    const cursor = context.headers['last-event-id'] ?? null;
    await this.realtime.validate(actor.scopes, cursor);
    return Object.freeze({ actor, conversation, cursor, lease: this.capacity.acquire(actor.scopes) });
  }

  commit(_input: OperationInputFor<'support.events.read'>, prepared: PreparedStream, _context: HandlerContext<'support.events.read'>): Promise<DurableCommit<PreparedStream, Output>> {
    return Promise.resolve({ checkpoint: prepared, response: { status: 200, body: {} as Output } });
  }

  finalize(_input: OperationInputFor<'support.events.read'>, prepared: PreparedStream, _context: FinalizeContext<'support.events.read'>): Promise<Reply> {
    try {
      return Promise.resolve(this.presenter.present({
        scopes: prepared.actor.scopes,
        member: prepared.actor.member,
        storefront: prepared.actor.target === 'storefront',
        conversation: prepared.conversation,
        cursor: prepared.cursor,
        release: () => prepared.lease.release(),
      }));
    } catch (cause) {
      prepared.lease.release();
      throw cause;
    }
  }

  discard(prepared: PreparedStream): Promise<void> {
    prepared.lease.release();
    return Promise.resolve();
  }
}
