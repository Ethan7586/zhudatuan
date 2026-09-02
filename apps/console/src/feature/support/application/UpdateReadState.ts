import type { ConsoleContext } from '../../../entity/session/ConsoleSession';
import type { SupportGateway } from '../infrastructure/SupportGateway';

export class UpdateReadState {
  constructor(private readonly gateway: SupportGateway) {}
  execute(context: ConsoleContext, conversation: string, sequence: number) { return this.gateway.read(context, conversation, sequence); }
}
