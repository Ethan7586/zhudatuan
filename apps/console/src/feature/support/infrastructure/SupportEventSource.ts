import type { ConsoleContext } from '../../../entity/session/ConsoleSession';
import type { SupportEvent } from './SupportGateway';
import type { SupportGateway } from './SupportGateway';

export class SupportEventSource {
  constructor(private readonly gateway: SupportGateway) {}
  async listen(context: ConsoleContext, receive: (event: SupportEvent) => void, signal: AbortSignal, conversationId?: string): Promise<void> {
    const stream = this.gateway.events(context, conversationId, signal);
    try { for await (const event of stream) receive(event); }
    finally { stream.close(); }
  }
}
