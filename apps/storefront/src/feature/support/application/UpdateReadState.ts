import { createIdempotencyKey } from '@shop/sdk';
import type { StorefrontSession } from '../../../entity/session';
import type { SupportGateway } from '../infrastructure/SupportGateway';

export class UpdateReadState {
  constructor(private readonly gateway: SupportGateway) {}
  execute(session: StorefrontSession, conversation: string, sequence: number) {
    return this.gateway.readstate(session, conversation, sequence, createIdempotencyKey());
  }
}
