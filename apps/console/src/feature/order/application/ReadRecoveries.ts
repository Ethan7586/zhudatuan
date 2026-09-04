import type { ConsoleContext } from '../../../entity/session/ConsoleSession';
import type { OrderPort } from '../public';

export class ReadRecoveries {
  constructor(private readonly port: Pick<OrderPort, 'recoveries'>) {}
  execute(context: ConsoleContext, reference?: string, signal?: AbortSignal) {
    return this.port.recoveries(context, reference, signal);
  }
}
