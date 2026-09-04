import type { ConsoleContext } from '../../../entity/session/ConsoleSession';
import { assertOperationAccess } from '../../../shared/security/OperationAccess';
import { experienceOperations } from '../model/Experience';
import type { ExperiencePort } from '../public';
export class PublishVersion {
  constructor(private readonly port: ExperiencePort) {}
  execute(context: ConsoleContext, version: string, applicationVersion: number, identity: string, signal?: AbortSignal) {
    assertOperationAccess(context, experienceOperations.publish);
    return this.port.publishVersion(context, version, applicationVersion, identity, signal);
  }
}
