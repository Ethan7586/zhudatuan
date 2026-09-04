import type { ConsoleContext } from '../../../entity/session/ConsoleSession';
import { assertOperationAccess } from '../../../shared/security/OperationAccess';
import { experienceOperations } from '../model/Experience';
import type { ExperiencePort } from '../public';
export class RestoreVersion {
  constructor(private readonly port: ExperiencePort) {}
  execute(context: ConsoleContext, version: string, applicationVersion: number, identity: string, signal?: AbortSignal) {
    assertOperationAccess(context, experienceOperations.restore);
    return this.port.restoreVersion(context, version, applicationVersion, '控制台恢复历史装修版本', identity, signal);
  }
}
