import type { ConsoleContext } from '../../../entity/session/ConsoleSession';
import type { OrderPort } from '../public';

export class ReadOrder {
  constructor(private readonly port: OrderPort) {}
  execute(context: ConsoleContext, reference: string, signal?: AbortSignal) {
    return this.port.order(context, reference, signal);
  }
}
