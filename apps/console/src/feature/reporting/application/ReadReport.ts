import type { ConsoleContext } from '../../../entity/session/ConsoleSession';
import type { ReportFilter } from '../model/Report';
import type { ReportingPort } from '../public';

export class ReadReport {
  constructor(private readonly port: ReportingPort) {}
  execute(context: ConsoleContext, filter: ReportFilter, signal?: AbortSignal) {
    return this.port.read(context, filter, signal);
  }
}
