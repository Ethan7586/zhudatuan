import type { ConsoleContext } from '../../../entity/session/ConsoleSession';
import type { SupportPort } from '../public';

export class UpdateReadState {
  constructor(private readonly gateway: SupportPort) {}
  execute(context: ConsoleContext, conversation: string, sequence: number) { return this.gateway.updateRead(context, conversation, sequence); }
}
