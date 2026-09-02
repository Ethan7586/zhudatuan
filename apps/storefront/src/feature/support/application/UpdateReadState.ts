import { createIdempotencyKey } from '@shop/sdk';
import type { StorefrontSession } from '../../../shared/api/Session';
import { supportGateway, type SupportGateway } from '../infrastructure/SupportGateway';

export class UpdateReadState {
  constructor(private readonly gateway: SupportGateway = supportGateway) {}
  execute(session: StorefrontSession, conversation: string, sequence: number) {
    return this.gateway.readstate(session, conversation, sequence, createIdempotencyKey());
  }
}
