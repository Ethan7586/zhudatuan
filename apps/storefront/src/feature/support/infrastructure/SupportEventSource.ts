import type { StorefrontSession } from '../../../entity/session';
import type { SupportEvent, SupportGateway } from './SupportGateway';

export class SupportEventSource {
  constructor(private readonly gateway: SupportGateway) {}
  async listen(session: StorefrontSession, conversation: string, receive: (event: SupportEvent) => void, signal: AbortSignal, lastEventId?: string): Promise<void> {
    const stream = this.gateway.events(session, conversation, signal, lastEventId);
    try { for await (const event of stream) receive(event); }
    finally { stream.close(); }
  }
}
