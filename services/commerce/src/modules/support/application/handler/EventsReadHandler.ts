import { isConsumerTarget, type OperationInputFor, type OperationOutputFor } from '@shop/contract';
import type { FinalizeContext, HandlerContext, PrepareContext } from '../../../../foundation/application/HandlerContext';
import type { DurableCommit, DurableOperationHandler, OperationReply } from '../../../../foundation/application/OperationHandler';
import { StreamCapacity, type StreamLease } from '../../../../foundation/stream/StreamCapacity';
import { DomainError } from '../../../../foundation/domain/DomainError';
import type { RealtimePort, SupportRealtimeEvent, SupportReplayPort, SupportStreamPresenter } from '../port/RealtimePort';
import type { ReadSupportContext, SupportActorContext } from '../service/ReadSupportContext';

type Output = OperationOutputFor<'support.events.read'>;
type Reply = OperationReply<Output>;

interface PreparedStream {
  readonly actor: SupportActorContext;
  readonly conversation: string | null;
  readonly cursor: string | null;
  readonly replay: readonly SupportRealtimeEvent[];
  readonly lease: StreamLease;
}

type LoadedStream = Omit<PreparedStream, 'lease'>;

export class EventsReadHandler implements DurableOperationHandler<'support.events.read', PreparedStream, PreparedStream, 'read', LoadedStream> {
  readonly operation = 'support.events.read' as const;
  readonly mode = 'read' as const;

  constructor(
    private readonly support: ReadSupportContext,
    private readonly realtime: RealtimePort,
    private readonly replay: SupportReplayPort,
    private readonly presenter: SupportStreamPresenter,
    private readonly capacity = new StreamCapacity()
  ) {}

  async load(input: OperationInputFor<'support.events.read'>, context: HandlerContext<'support.events.read'>): Promise<LoadedStream> {
    const actor = await this.support.actor(context.transaction, context);
    const conversation = typeof input.query?.conversationId === 'string' ? input.query.conversationId : null;
    const requested = context.headers['last-event-id'] ?? null;
    try {
      await this.realtime.validate(actor.scopes, requested);
      return Object.freeze({ actor, conversation, cursor: requested, replay: Object.freeze([]) });
    } catch (cause) {
      if (!(cause instanceof DomainError) || cause.code !== 'SUPPORT_EVENT_CURSOR_EXPIRED' || requested === null) throw cause;
      const restored = await this.replay.replay(context.transaction, { scopes: actor.scopes, member: actor.member, storefront: isConsumerTarget(actor.target), conversation, cursor: requested });
      return Object.freeze({ actor, conversation, cursor: restored.resumeCursor, replay: restored.events });
    }
  }

  prepare(_input: OperationInputFor<'support.events.read'>, _context: PrepareContext<'support.events.read'>, loaded: LoadedStream): Promise<PreparedStream> {
    return Promise.resolve(Object.freeze({ ...loaded, lease: this.capacity.acquire(loaded.actor.scopes) }));
  }

  commit(_input: OperationInputFor<'support.events.read'>, prepared: PreparedStream, _context: HandlerContext<'support.events.read'>): Promise<DurableCommit<PreparedStream, Output>> {
    return Promise.resolve({ checkpoint: prepared, response: { status: 200, body: {} as Output } });
  }

  finalize(_input: OperationInputFor<'support.events.read'>, prepared: PreparedStream, _context: FinalizeContext<'support.events.read'>): Promise<Reply> {
    try {
      return Promise.resolve(this.presenter.present({
        scopes: prepared.actor.scopes,
        member: prepared.actor.member,
        storefront: isConsumerTarget(prepared.actor.target),
        conversation: prepared.conversation,
        cursor: prepared.cursor,
        replay: prepared.replay,
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
