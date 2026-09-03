import type { InvitationPort } from '../public/InvitationPort';

export class ReadEnrollment {
  constructor(private readonly port: InvitationPort) {}
  execute(id: string, signal?: AbortSignal) { return this.port.read(id, signal); }
}
