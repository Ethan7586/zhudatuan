import type { ConsoleContext } from '../../../entity/session/ConsoleSession';
import type { ReportingPort } from '../public';

export class ReadDimensions {
  constructor(private readonly port: ReportingPort) {}

  execute(context: ConsoleContext, signal?: AbortSignal) {
    return this.port.readDimensions(context, signal);
  }
}
