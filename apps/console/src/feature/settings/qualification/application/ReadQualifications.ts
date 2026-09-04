import type { ConsoleContext } from '../../../../entity/session/ConsoleSession';
import type { QualificationPort } from '../public';

export class ReadQualifications {
  constructor(private readonly port: Pick<QualificationPort, 'read'>) {}
  execute(context: ConsoleContext, cursor?: string, signal?: AbortSignal) {
    return this.port.read(context, cursor, signal);
  }
}
