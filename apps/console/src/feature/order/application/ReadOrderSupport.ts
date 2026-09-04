import type { ConsoleContext } from '../../../entity/session/ConsoleSession';
import type { OrderPort } from '../public';

export class ReadOrderSupport {
  constructor(private readonly gateway: Pick<OrderPort, 'support'>) {}

  execute(context: ConsoleContext, reference: string, signal?: AbortSignal) {
    return this.gateway.support(context, reference, signal);
  }
}
