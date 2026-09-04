import type { ConsoleContext } from '../../../entity/session/ConsoleSession';
import { assertOperationAccess } from '../../../shared/security/OperationAccess';
import { experienceOperations } from '../model/Experience';
import type { ExperiencePort } from '../public';
export class PublishVersion {
  constructor(private readonly port: ExperiencePort) {}
  execute(context: ConsoleContext, version: string, applicationVersion: number, proof: string, identity: string, signal?: AbortSignal) {
    assertOperationAccess(context, experienceOperations.publish, proof);
    return this.port.publishVersion(context, version, applicationVersion, proof, identity, signal);
  }
}
