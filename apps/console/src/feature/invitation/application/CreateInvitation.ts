import { createIdempotencyKey } from '@shop/sdk/context';
import type { ConsoleContext } from '../../../entity/session/ConsoleSession';
import type { InvitationGateway } from '../infrastructure/InvitationGateway';
import type { InvitationDraft } from '../model/InvitationDraft';

export class CreateInvitation {
  constructor(private readonly gateway: InvitationGateway) {}
  execute(context: ConsoleContext, draft: InvitationDraft, signal?: AbortSignal) {
    return this.gateway.create(context, draft, createIdempotencyKey(), signal);
  }
}
