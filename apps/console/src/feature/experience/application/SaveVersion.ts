import type { ConsoleContext } from '../../../entity/session/ConsoleSession';
import { assertOperationAccess } from '../../../shared/security/OperationAccess';
import { experienceOperations, type VersionDraft } from '../model/Experience';
import type { ExperiencePort } from '../public';
export class SaveVersion {
  constructor(private readonly port: ExperiencePort) {}
  execute(context: ConsoleContext, draft: VersionDraft, identity: string, signal?: AbortSignal) {
    assertOperationAccess(context, experienceOperations.save);
    return this.port.saveVersion(context, draft, identity, signal);
  }
}
