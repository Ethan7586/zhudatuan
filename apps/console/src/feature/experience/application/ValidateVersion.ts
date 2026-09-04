import type { ConsoleContext } from '../../../entity/session/ConsoleSession';
import { assertOperationAccess } from '../../../shared/security/OperationAccess';
import { experienceOperations } from '../model/Experience';
import type { ExperiencePort } from '../public';
export class ValidateVersion {
  constructor(private readonly port: ExperiencePort) {}
  execute(context: ConsoleContext, version: string, identity: string, signal?: AbortSignal) {
    assertOperationAccess(context, experienceOperations.validate);
    return this.port.validateVersion(context, version, identity, signal);
  }
}
