import type { StorefrontSession } from '../../../entity/session';
import type { SupportPort } from '../public/SupportPort';

export class UpdateReadState {
  constructor(private readonly gateway: Pick<SupportPort, 'readstate'>) {}
  execute(session: StorefrontSession, conversation: string, sequence: number) {
    return this.gateway.readstate(session, conversation, sequence);
  }
}
