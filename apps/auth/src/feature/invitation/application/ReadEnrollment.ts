import type { InvitationGateway } from '../infrastructure/InvitationGateway';

export class ReadEnrollment {
  constructor(private readonly gateway: InvitationGateway) {}
  execute(id: string, signal?: AbortSignal) { return this.gateway.read(id, signal); }
}
