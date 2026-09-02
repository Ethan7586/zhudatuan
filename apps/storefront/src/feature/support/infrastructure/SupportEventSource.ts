import type { StorefrontSession } from '../../../shared/api/Session';
import { supportGateway, type SupportEvent, type SupportGateway } from './SupportGateway';

export class SupportEventSource {
  constructor(private readonly gateway: SupportGateway = supportGateway) {}
  async listen(session: StorefrontSession, conversation: string, receive: (event: SupportEvent) => void, signal: AbortSignal): Promise<void> {
    const stream = this.gateway.events(session, conversation, signal);
    try { for await (const event of stream) receive(event); }
    finally { stream.close(); }
  }
}
