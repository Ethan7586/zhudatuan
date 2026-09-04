import type { ConsoleContext } from '../../../entity/session/ConsoleSession';
import type { ExperiencePort } from '../public';
export class ReadApplication {
  constructor(private readonly port: ExperiencePort) {}
  execute(context: ConsoleContext, application: string, signal?: AbortSignal) {
    if (!application) throw new Error('EXPERIENCE_APPLICATION_REQUIRED');
    return this.port.application(context, application, signal);
  }
}
