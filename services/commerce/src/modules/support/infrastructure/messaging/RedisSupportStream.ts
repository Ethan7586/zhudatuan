import { DomainError } from '../../../../platform/error/DomainError';
import type { EventStream } from '../../../../platform/messaging/EventStream';
import type { RealtimePort, SupportRealtimeEvent } from '../../application/port/RealtimePort';

export class RedisSupportStream implements RealtimePort {
  constructor(private readonly streams: EventStream) {}

  publish(event: SupportRealtimeEvent): Promise<string> {
    return this.streams.append(event.scopeId, JSON.stringify(event));
  }

  async validate(scopes: readonly string[], cursor: string | null): Promise<void> {
    try {
      await this.streams.validate(scopes, cursor);
    } catch (cause) {
      mapStreamError(cause, new AbortController().signal);
    }
  }

  async *read(input: Readonly<{ scopes: readonly string[]; member: string; storefront: boolean; conversation: string | null; cursor: string | null; signal: AbortSignal }>): AsyncIterable<SupportRealtimeEvent> {
    const scopes = new Set(input.scopes);
    try {
      for await (const entry of this.streams.read(input.scopes, input.cursor, input.signal)) {
        const event = parse(entry.id, entry.stream, entry.value);
        if (!scopes.has(event.scopeId)) continue;
        if (input.conversation && event.conversationId !== input.conversation) continue;
        if (input.storefront && event.memberId !== input.member) continue;
        yield event;
      }
    } catch (cause) {
      mapStreamError(cause, input.signal);
    }
  }
}

function mapStreamError(cause: unknown, signal: AbortSignal): never | void {
  const message = cause instanceof Error ? cause.message : '';
  if (message === 'EVENT_STREAM_CURSOR_EXPIRED' || message === 'SUPPORT_EVENT_CURSOR_EXPIRED') throw new DomainError('SUPPORT_EVENT_CURSOR_EXPIRED');
  if (!signal.aborted) throw new DomainError('SUPPORT_STREAM_UNAVAILABLE');
}

function parse(id: string, scope: string, value: string): SupportRealtimeEvent {
  const parsed = JSON.parse(value) as SupportRealtimeEvent;
  if (!parsed || typeof parsed !== 'object' || parsed.id === undefined || parsed.scopeId !== scope || typeof parsed.ticketId !== 'string' || typeof parsed.conversationId !== 'string') throw new Error('SUPPORT_STREAM_EVENT_INVALID');
  return Object.freeze({ ...parsed, id });
}
