import type { ConsoleContext } from '../../../entity/session/ConsoleSession';
import type { ExperiencePort } from '../public';
export class ReadApplications {
  constructor(private readonly port: ExperiencePort) {}
  execute(context: ConsoleContext, cursor?: string, signal?: AbortSignal) {
    return this.port.applications(context, cursor, signal);
  }
}
