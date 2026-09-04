import type { StorefrontSession } from '../../../entity/session';
import type { SupportEvent } from '../model/SupportEvent';
import type { SupportPort } from '../public/SupportPort';

export class ListenSupportEvents {
  constructor(private readonly gateway: Pick<SupportPort, 'events'>) {}

  async execute(session: StorefrontSession, conversation: string, receive: (event: SupportEvent) => void, signal: AbortSignal, lastEventId?: string): Promise<void> {
    const stream = this.gateway.events(session, conversation, signal, lastEventId);
    try {
      for await (const event of stream) receive(event);
    } finally {
      stream.close();
    }
  }
}
